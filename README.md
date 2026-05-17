# Railbound 求解器与编辑器

这是一个基于 React + Vite 的网页端 Railbound 关卡编辑、模拟和求解工具。项目目标是把关卡搭建、路径验证、搜索求解和动画回放放在同一个本地页面里，便于快速验证复杂机关关卡。

## 快速启动

```bash
npm install
npm run dev
```

打开 Vite 输出的本地地址即可使用。生产构建命令：

```bash
npm run build
npm run preview
```

## 关键内容

- 编辑器支持空轨铺设区、固定轨道、普通火车、零号火车、终点、站台、隧道、触发器、关卡、颜色变轨 T 和自变 T。
- 模拟器负责按步推进车厢，校验轨道端口、进站方向、到站顺序、碰撞、机关状态、站台接客和超时；零号火车可移动和触发机关，但不能进终点，通关瞬间会做短前瞻安全检查。
- 求解器运行在 Web Worker 中，先做双向可达性剪枝，再尝试 CSP 路径枚举，必要时回退到 DFS 搜索。
- UI、共享规则和 Worker 求���实现已经分层：React 组件只负责编辑、渲染和 Worker 调度；常用规则、模拟、剪枝在逻辑层；低频求解细节在 Worker 文件。
- 当前测试脚本主要是调试用例和回归片段，集中在 `scratch/` 以及少量根目录脚本，还不是完整自动化测试套件。

## 项目结构

```text
.
├── main.jsx                  # React 挂载入口
├── railbound-solver-v3.jsx   # 单页编辑器、SVG 渲染、交互和 Worker 调度
├── railbound-rules.js        # 核心规则层：模拟器、碰撞检测、可达性剪枝、错误报告
├── railbound-worker.js       # Web Worker 求解实现：CSP + DFS 搜索
├── railbound-worker-code.js  # Worker 创建入口（Vite worker bundling）
├── railbound-logic.js        # 常用共享规则（轻量）
├── index.html                # Vite HTML 模板
├── package.json              # npm 脚本与依赖
├── scratch/                  # 临时验证和历史调试脚本
├── test/                     # 回归测试
└── docs/                     # 拆分后的项目文档
```

## 模拟器错误报告

`simulate()` 返回的结果对象包含完整的错误诊断信息，用于快速定位问题。

### 返回结构

```js
{
  ok: false,                    // 是否通关
  reason: "端口不匹配",          // 人类可读原因（中文）
  steps: 5,                     // 发生错误的步数
  arrived: ["1"],               // 已到达终点的车名
  history: [...],               // 完整步进历史
  detail: {                     // ★ 结构化错误详情（机器可读）
    errorCode: 'PORT_MISMATCH', // 错误码
    car: '3',                   // 出错的车
    cell: '4,2',                // 出错的格子
    track: 'NE',                // 当前轨道
    entry: 'S',                 // 进入方向
    // ... 其他上下文字段
  }
}
```

### 错误码一览

| errorCode | 含义 | 关键字段 |
|-----------|------|----------|
| `NO_TRACK` | 车到达无轨道的空格 | `car`, `cell`, `x`, `y`, `isAutoSwitch` |
| `PORT_MISMATCH` | 车进入方向与轨道端口不匹配 | `car`, `cell`, `track`, `entry`, `isAutoSwitch`, `isLocked` |
| `TUNNEL_ENTRY` | 车以错误方向进入隧道 | `car`, `cell`, `entry`, `expected` |
| `CELL_COLLISION` | 两辆车占据同一格 | `cars[]`, `cell` |
| `TUNNEL_COLLISION` | 隧道入口/出口冲突 | `car`, `cells[]` |
| `TAILING` | 追尾（一辆车紧跟另一辆同向行驶） | `leader`, `follower`, `leaderCell`, `followerCell`, `direction` |
| `OUT_OF_BOUNDS` | 车驶出地图边界 | `car`, `from`, `target` |
| `ZERO_AT_GOAL` | ���号车进入终点（不允许） | `car`, `from` |
| `WRONG_GOAL_DIR` | 车以错误方向进入终点 | `car`, `actual`, `expected` |
| `WRONG_ORDER` | 车到达顺序不正确 | `car`, `arrived[]`, `expected[]` |
| `UNSERVED_PLATFORM` | 车未完成接客任务即进站 | `car` |
| `UNSERVED_PLATFORMS` | 通关时仍有未接客站台 | — |
| `PLATFORM_MISMATCH` | 站台接客需求不匹配 | `car`, `cell` |
| `ZERO_UNSAFE` | 零号车前瞻检查失败 | `zeroDetail` |
| `TIMEOUT` | 超过最大步数仍未通关 | `maxSteps` |

### 快速格式化

```js
import { simulate, formatSimError } from "./railbound-rules.js";

const result = simulate(puzzle, placed);
console.log(formatSimError(result));
// ❌ 追尾 | step=10 | code=TAILING | leader=0.1 follower=1 | dir=W | positions: 3@(4,6)E 2@(5,7)S ...
```

## 求解器架构

```text
onmessage(puzzle)
  → filterBlanks()          # 双向可达性剪枝
  → puzzleHasDynamicState() # 特性检测
  ├─ 普通关卡 → solveCSP() → solveDFS() 回退
  └─ 有零号车 → 直接走 CSP+DFS 通道（使用 zeroSafetyLookahead 验证）
```

### 碰撞检测

模拟器检查三种碰撞类型：
1. **格子碰撞** (CELL_COLLISION)：两辆车占据同一格子
2. **隧道碰撞** (TUNNEL_COLLISION)：隧道入口/出口位置冲突
3. **追尾** (TAILING)：一辆车紧跟另一辆同方向行驶的车

> **注意**：曲线/T 型轨道上反向通过的列车不构成碰撞。两辆车可以在曲线轨道上同时反向通过同一对格子，因为它们在物理上走的是不同的轨道分支。

## 文档导航

- [架构说明](docs/architecture.md)：模块边界、数据流、求解流程和主要技术债。
- [关卡数据格式](docs/puzzle-format.md)：导入导出的 JSON 结构、字段含义和示例。
- [开发与测试](docs/development.md)：本地命令、调试脚本现状、后续整理建议。

## 维护重点

1. 日常改规则先看 `railbound-rules.js`；只有改求解路径枚举、CSP 合并、DFS 回退或 Worker 消息时才看 `railbound-worker.js`。
2. 关卡 JSON 同时兼容 `goalEntry` / `goal_entry`、`maxSteps` / `max_steps` 等新旧字段；改格式时要保留导入兼容。
3. 机关相关状态会影响模拟和求解两个路径，修改时应同时覆盖普通模拟、Worker 求解和导入导出。
4. 错误排查时使用 `formatSimError(result)` 快速定位失败原因，或检查 `result.detail` 获取结构化错误上下文。

## 调试技巧

### 定位模拟错误

```js
import { simulate, formatSimError } from "./railbound-rules.js";

const result = simulate(puzzle, placed);
if (!result.ok) {
  console.log(formatSimError(result));       // 单行摘要
  console.log(result.detail);                // 结构化详情
  console.log(result.history);               // 完整步进轨迹
  // 打印出错步的所有车辆位置
  const failStep = result.history[result.steps];
  failStep?.forEach(c => console.log(`  ${c.name} @ (${c.x},${c.y}) entry=${c.entry}`));
}
```

### 按错误码过滤

```js
if (result.detail?.errorCode === 'TAILING') {
  console.log(`追尾: ${result.detail.leader} → ${result.detail.follower}`);
  console.log(`位置: ${result.detail.leaderCell} / ${result.detail.followerCell}`);
}
```

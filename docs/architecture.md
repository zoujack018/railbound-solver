# 架构说明

## 总览

项目是一个纯前端单页应用：

```text
index.html
  -> main.jsx
    -> railbound-solver-v3.jsx
      -> railbound-logic.js
      -> railbound-worker-code.js
        -> SOLVER_WORKER_CODE -> Web Worker
```

主线程负责编辑器、SVG 渲染、用户交互、导入导出和动画回放。求解计算通过 `railbound-worker-code.js` 中的 `createWorkerBlob()` 把 `SOLVER_WORKER_CODE` 包装成 Worker URL，在后台线程执行，避免阻塞页面。

## 模块职责

### `main.jsx`

React 挂载入口，只做一件事：把 `App` 渲染到 `#root`。

### `railbound-solver-v3.jsx`

UI 与交互层，主要职责：

- 管理网格尺寸、工具选择、轨道选择、机关颜色、求解结果、回放进度等 React 状态。
- 使用 `TrackSVG` 绘制轨道、T 轨、车厢、终点、站台、隧道和机关。
- 在 `buildP()` 中把编辑器内部网格状态转换成求解器使用的 puzzle JSON。
- `doSolve()` 从 `railbound-worker-code.js` 创建多个 Worker，并聚合进度、候选解和最终状态。
- `doSim()` 调用 `simulate()` 做主线程模拟和回放历史生成。
- `doExport()` / `doImport()` 处理剪贴板 JSON。
- `doReach()` 展示 `forwardReachable()`、`backwardReachable()` 和 `filterBlanks()` 的剪枝结果。

### `railbound-logic.js`

核心规则层，主要职责：

- 轨道常量：`TRACKS`、`T_META`、`T_SWITCH_PAIRS`、`OPPOSITE`、`DELTA`。
- 轨道查询：`exitPort()`、`TRACKS_BY_ENTRY`、`BASIC_BY_ENTRY`、`TRACKS_BY_EXIT`。
- 地图构建：`buildTunnelMap()`、`buildTSwitchMap()`、`buildAutoSwitchMap()`。
- 状态轨道：`effectiveTrackAt()` 统一处理固定轨、颜色变轨 T、自变 T。
- 站台规则：`buildPlatformState()`、`platformPickupForCar()`、`carNeedsPassengers()`。
- 模拟器：`simulate(puzzle, placed)` 按步推进车厢并返回通关状态和 history。
- 可达性剪枝：`forwardReachable()`、`backwardReachable()`、`filterBlanks()`。

这个文件是日常排查规则和模拟问题时的首选入口。不要把 Worker 内部搜索细节重新塞回这里。

### `railbound-worker-code.js`

低频求解实现层，主要职责：

- 导出 `SOLVER_WORKER_CODE`，用于生成浏览器 Web Worker。
- 复制 Worker 运行所需的轨道常量和共享 helper 到 Worker 字符串中。
- 实现 CSP 路径枚举、轨道合并、T 轨一致性校验、快速碰撞预检和 DFS 回退。
- 实现 Worker 的 `self.onmessage` 求解入口。

只有在修改求解搜索策略、路径枚举、CSP/DFS 性能或 Worker 消息协议时才优先看这个文件。

## 数据流

1. 用户在 UI 网格中放置对象。
2. `buildP()` 把 UI cell 转换成 puzzle JSON。
3. 模拟时，`simulate(puzzle, placed)` 直接在主线程运行。
4. 求解时，`doSolve()` 先调用 `filterBlanks()` 估算剪枝量，再通过 `createWorkerBlob()` 启动多个 Worker。
5. Worker 收到 `{ type: "solve", puzzle, seed, maxTracksHint }` 后执行搜索。
6. Worker 通过 `progress`、`solution`、`done` 消息回传状态。
7. UI 用 `simulate()` 验证候选解，生成回放历史并渲染到 SVG 网格。

## 求解流程

Worker 内部的流程可以概括为：

1. `filterBlanks()` 做双向可达性剪枝，减少候选铺轨格。
2. 对较小问题尝试 CSP 路径枚举：
   - 枚举每辆车可行路径。
   - 根据路径使用情况合并轨道。
   - 对 T 轨端口使用做一致性校验。
3. 如果 CSP 溢出、未找到解或遇到自变 T 等 CSP 难以完整建模的情况，回退到 DFS：
   - 动态铺设基础轨。
   - 必要时把已铺基础轨升级为 T 轨。
   - 在每步模拟中同步处理碰撞、机关、站台和到站顺序。
4. 如果启用最少轨道模式，Worker 会持续接受更低 cost 的候选解，最终返回最优已知解。

## 关键规则

- 车厢字段中的 `entry` 表示车厢进入当前格子的端口，不是车头朝向；UI 中的 facing 会在 `buildP()` 中转换成 `OPPOSITE[facing]`。
- `name: "0"` 或 `role: "zero"` 表示零号火车。零号火车像普通火车一样移动、占位、碰撞、触发机关，但不计入 `order`，不需要接客，且不能进入终点。
- 终点字段 `goalEntry` / `goal_entry` 表示车厢进入终点格的方向要求。
- 隧道必须同色成对，每个端点有 `facing`，车厢只能从匹配方向进入。
- 触发器会切换同色关卡，也会切换同色变轨 T。
- 当车厢占据某个颜色的关卡时，该颜色触发切换会被抑制，避免脚下关卡瞬间改变。
- 自变 T 在车厢从该格开出后切换到配对 T 轨。
- 站台本身占独立格，`dir` 指向相邻道路格；指定车到达该目标格后接客并等待。
- 所有普通火车按顺序到站且站台需求完成后，剩余零号火车会执行短前瞻安全检查；默认 3 步内不进终点、不出界、不无轨、不碰撞，或提前进入循环，即可通关。

## 主要技术债

- `railbound-worker-code.js` 仍通过模板字符串维护 Worker 代码，缺少构建期类型检查和语法高亮。
- Worker 内仍复制了一份模拟和规则 helper；改核心规则时要同时确认主线程与 Worker 是否一致。
- `scratch/` 中有大量历史调试脚本，部分脚本复制了旧版逻辑，不能当作权威测试。
- 根目录 `test_bug.js` 引用了当前未导出的 `solveRailbound`，需要整理或删除。
- UI 文件仍是单个大组件，后续可按工具面板、网格画布、回放面板拆分。

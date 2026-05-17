# 开发与测试

## 本地命令

```bash
npm install
npm run dev
npm run build
npm run preview
```

项目使用 Vite，入口是 `index.html` -> `main.jsx`。

## 调试入口

常用代码入口：

- `railbound-solver-v3.jsx`：调 UI、交互、导入导出、回放和 Worker 调度。
- `railbound-logic.js`：日常优先看的共享规则入口；调轨道常量、模拟器、碰撞、机关、站台和可达性剪枝。
- `railbound-worker-code.js`：低频查看的求解实现；只在改 Worker、CSP 路径枚举、轨道合并、DFS 回退或搜索性能时进入。
- `scratch/test_solver.js`：用 Node 直接 eval Worker 代码验证求解流程。
- `scratch/test_reach.js`：查看前向/后向可达性结果。
- `scratch/test_collision.js`、`scratch/test_snake.js`、`scratch/test_detour.js`：模拟特定路径与碰撞场景。
- `scratch/test_solver_autoswitch.js`：验证自变 T 相关求解。
- `test-barrier.js`：排查触发器和关卡联动场景，当前输出包含预期中的失败路径分析。

## 运行单个调试脚本

```bash
node scratch/test_solver.js
node scratch/test_reach.js
node test-barrier.js
```

这些脚本不是统一测试套件，输出主要用于人工判断。修改核心规则后，至少应运行与改动相关的脚本，并执行一次构建：

```bash
npm run build
```

## 当前测试现状

- `scratch/` 中有多份历史调试脚本，部分脚本复制了旧版轨道常量和模拟逻辑。
- 根目录 `test_bug.js` 当前引用了未导出的 `solveRailbound`，不能作为可运行测试入口。
- 没有配置 Vitest/Jest，也没有 npm test 脚本。

## 建议整理顺序

1. 把可运行且仍有价值的脚本迁移到 `tests/fixtures/` 和 `tests/*.test.js`。
2. 给 `simulate()` 建立最小回归测试：基础轨道、碰撞、进站方向、到站顺序、隧道、关卡、站台、变轨 T、自变 T。
3. 给 `filterBlanks()` 建立固定输入输出测试，避免剪枝误删可行格。
4. 把 Worker 求解封装成可在 Node 中调用的函数，减少 `eval(SOLVER_WORKER_CODE)` 调试方式。
5. 增加 `npm test`，让 README 中的验证流程可以自动执行。

## 修改规则时的检查清单

- 同一规则是否同时存在于主线程 `simulate()` 和 `SOLVER_WORKER_CODE`？
- 如果只改 UI、导入导出、主线程模拟或剪枝，优先限制在 `railbound-solver-v3.jsx` 和 `railbound-logic.js`。
- 如果改到路径枚举、CSP、DFS、Worker 进度消息或求解性能，再进入 `railbound-worker-code.js`。
- 导入导出是否保留旧字段兼容？
- UI 中放置的 cell 是否能被 `buildP()` 正确转换？
- Worker 候选解是否会再经过主线程 `simulate()` 验证？
- 是否需要更新 `docs/puzzle-format.md` 中的字段说明？

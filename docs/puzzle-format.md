# 关卡数据格式

编辑器导出的 JSON 是核心逻辑层使用的 puzzle 对象。坐标以左上角为 `(0, 0)`，`x` 向右递增，`y` 向下递增。格子 key 使用 `"x,y"` 字符串。

## 顶层字段

```json
{
  "width": 5,
  "height": 4,
  "fixed": { "0,1": "-", "1,1": "ES" },
  "blanks": [[2, 1], [3, 1]],
  "cars": [{ "name": "1", "x": 0, "y": 1, "entry": "W" }],
  "goal": [4, 1],
  "goal_entry": "W",
  "order": ["1"],
  "max_steps": 50,
  "tunnels": [],
  "triggers": [],
  "barriers": [],
  "tsw_triggers": [],
  "tswitches": [],
  "autoSwitches": [],
  "platforms": []
}
```

字段说明：

- `width` / `height`：网格尺寸。
- `fixed`：固定轨道映射，key 是 `"x,y"`，value 是轨道名。
- `blanks`：允许求解器铺轨的格子列表。
- `cars`：车厢起点。`entry` 是进入当前格子的端口，车头实际朝向是 `OPPOSITE[entry]`。
- `goal`：终点坐标 `[x, y]`。
- `goal_entry` / `goalEntry`：进站方向。代码同时兼容蛇形和驼峰字段。
- `order`：到站顺序，通常按车号升序。
- `max_steps` / `maxSteps`：模拟最大步数。
- `tunnels`：隧道端点，按颜色成对。
- `triggers`：普通触发器，切换同色关卡。
- `barriers`：关卡，按颜色受触发器影响。
- `tsw_triggers` / `tswTriggers`：变轨 T 触发器；当前 UI 的普通触发器会同时写入 `triggers` 和 `tsw_triggers`。
- `tswitches`：颜色变轨 T。
- `autoSwitches` / `auto_switches`：自变 T。
- `platforms`：站台接客需求。

## 轨道名

基础轨道：

```text
|  -  NE  ES  SW  WN
```

T 轨：

```text
T_NE_S  T_NE_W  T_ES_N  T_ES_W
T_SW_N  T_SW_E  T_WN_E  T_WN_S
```

`T_SWITCH_PAIRS` 定义 T 轨切换配对：

```text
T_NE_S <-> T_ES_N
T_NE_W <-> T_WN_E
T_ES_W <-> T_SW_E
T_SW_N <-> T_WN_S
```

## 方向字段

方向统一使用：

```text
N  E  S  W
```

注意两类方向容易混淆：

- `cars[].entry`：车厢进入当前起点轨道格的端口。
- `goal_entry`：车厢进入终点格时要求的端口。
- UI 中的“朝向”是车头方向，导出时会转换成 `entry = OPPOSITE[facing]`。

## 零号火车

零号火车写法：

```json
{ "name": "0", "role": "zero", "x": 1, "y": 2, "entry": "W" }
```

规则：

- `name: "0"` 或 `role: "zero"` 都会被识别为零号火车。
- 零号火车会正常沿轨道移动、占位、参与碰撞检测，并触发触发器、变轨 T 和自变 T。
- 零号火车不计入 `order`，不会接客，也不能进入终点。
- 所有普通火车完成 `order` 且站台需求完成后，模拟器会继续前瞻零号火车若干步；默认 3 步内不进终点、不出界、不无轨、不碰撞即可通关，若提前检测到循环也判定安全。
- `zeroSafetySteps` / `zero_safety_steps`：可选，调整通关瞬间零号火车前瞻步数，默认 `3`。
- UI 的“起点”工具下有“普通火车”和“零号火车”两个选项，默认是普通火车；零号火车固定编号为 `0`。

## 隧道

隧道必须成对：

```json
{
  "color": "#e74c3c",
  "cells": [
    { "x": 0, "y": 0, "facing": "E" },
    { "x": 5, "y": 4, "facing": "N" }
  ]
}
```

车厢在隧道端点格时，必须从端点 `facing` 方向进入。传送到另一端后，会从另一端 `facing` 指向的相邻格驶出。

## 触发器与关卡

```json
"triggers": [{ "x": 2, "y": 2, "color": "red" }],
"barriers": [{ "x": 2, "y": 0, "color": "red", "initialState": "closed" }]
```

- 车厢经过 trigger 后切换同色 barrier。
- `initialState` 可为 `closed` 或 `open`。
- 如果某颜色 barrier 被车厢占据，该颜色本步切换会被抑制。

## 站台

```json
"platforms": [{ "x": 3, "y": 5, "dir": "N", "car": "2" }]
```

站台格本身不是道路。`dir` 指向相邻道路格，指定车厢进入目标道路格时完成接客，并产生等待时间。指定车未完成接客前不能进站。

## 导入兼容

导入逻辑会兼容部分旧字段：

- `goal_entry` 和 `goalEntry`
- `max_steps` 和 `maxSteps`
- `tsw_triggers` 和 `tswTriggers`
- `autoSwitches` 和 `auto_switches`
- 旧 T 轨名通过 `OLD_T_MAP` 映射到当前 T 轨名

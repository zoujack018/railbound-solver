import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { simulate } from "../railbound-logic.js";
import { SOLVER_WORKER_CODE } from "../railbound-worker-code.js";

function solveWithWorker(puzzle) {
  const messages = [];
  const self = {
    postMessage(msg) {
      messages.push(msg);
    },
    close() {},
  };
  new Function("self", `${SOLVER_WORKER_CODE}\nreturn self;`)(self);
  const started = performance.now();
  self.onmessage({ data: { type: "solve", puzzle, seed: 0, maxTracksHint: 0 } });
  const elapsedMs = performance.now() - started;
  const solutions = messages.filter(m => m.type === "solution").map(m => m.solution);
  const done = messages.find(m => m.type === "done");
  assert(done, "worker must post a done message");
  assert(solutions.length > 0, `expected solution for method ${done.method}`);
  const finalSolution = solutions.at(-1);
  const cspMatch = done.method.match(/csp=(\d+)/);
  const cspOnlyMatch = done.method.match(/^csp\(slack=/);
  const cspCost = cspMatch ? Number(cspMatch[1]) : (cspOnlyMatch ? finalSolution.__cost : solutions[0].__cost);
  const placed = { ...finalSolution };
  delete placed.__cost;
  const result = simulate(puzzle, placed);
  assert.equal(result.ok, true, `simulate failed: ${result.reason}`);
  return {
    method: done.method,
    info: done.info || "",
    elapsedMs,
    cspCost,
    finalCost: finalSolution.__cost,
    result,
  };
}

const testA = {
  width: 5,
  height: 3,
  fixed: { "0,1": "-" },
  blanks: [[1, 1], [2, 1], [3, 1]],
  cars: [{ name: "1", x: 0, y: 1, entry: "W" }],
  goal: [4, 1],
  goal_entry: "W",
  order: ["1"],
  max_steps: 30,
  tunnels: [],
  triggers: [],
  barriers: [{ x: 2, y: 1, color: "#e8584a", initialState: "open" }],
  tsw_triggers: [],
  tswitches: [],
  autoSwitches: [],
  platforms: [],
};

const testB = {
  width: 5,
  height: 3,
  fixed: {
    "0,0": "-",
    "2,0": "-",
    "3,0": "T_ES_W",
    "0,2": "-",
    "1,2": "-",
  },
  blanks: [[1, 0], [2, 2], [3, 2], [3, 1]],
  cars: [
    { name: "1", x: 0, y: 0, entry: "W" },
    { name: "2", x: 0, y: 2, entry: "W" },
  ],
  goal: [4, 0],
  goal_entry: "W",
  order: ["1", "2"],
  max_steps: 30,
  tunnels: [],
  triggers: [
    { x: 1, y: 2, color: "red" },
    { x: 3, y: 1, color: "red" },
  ],
  barriers: [{ x: 2, y: 0, color: "red", initialState: "closed" }],
  tsw_triggers: [],
  tswitches: [],
  autoSwitches: [],
  platforms: [],
};

const testC = {
  width: 6,
  height: 5,
  fixed: { "0,0": "|", "0,1": "|", "2,2": "|" },
  blanks: [[1, 0], [2, 0], [3, 0], [4, 0], [1, 1], [2, 1], [3, 1], [4, 1], [0, 2], [1, 2], [3, 2], [4, 2], [0, 3], [1, 3], [4, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]],
  cars: [{ name: "1", x: 0, y: 0, entry: "N" }, { name: "2", x: 0, y: 1, entry: "N" }],
  goal: [5, 2],
  goal_entry: "W",
  order: ["1", "2"],
  max_steps: 150,
  tunnels: [],
  triggers: [{ x: 2, y: 2, color: "#e8584a" }],
  barriers: [],
  tsw_triggers: [{ x: 2, y: 2, color: "#e8584a" }],
  tswitches: [{ x: 2, y: 3, color: "#e8584a", track: "T_WN_E" }, { x: 3, y: 3, color: "#e8584a", track: "T_WN_E" }],
  autoSwitches: [],
  platforms: [],
};

const a = solveWithWorker(testA);
assert(a.method.startsWith("csp("), `Test A should trust CSP, got ${a.method}`);
assert.equal(a.finalCost, 3, "Test A cost");

const b = solveWithWorker(testB);
assert(b.method.includes("csp+dfs") || b.method.includes("dfs(csp-bound="), `Test B should refine after CSP, got ${b.method}`);
assert(b.finalCost <= b.cspCost, `Test B final cost ${b.finalCost} should be <= CSP cost ${b.cspCost}`);

const c = solveWithWorker(testC);
assert.equal(c.finalCost, 11, "Test C final cost");
assert(c.method.includes("csp+dfs") || c.method.includes("dfs(csp-bound="), `Test C should refine after CSP, got ${c.method}`);

for (const [name, r] of [["A", a], ["B", b], ["C", c]]) {
  console.log(`Test ${name}: cost=${r.finalCost}, cspCost=${r.cspCost}, method=${r.method}, time=${r.elapsedMs.toFixed(1)}ms`);
}

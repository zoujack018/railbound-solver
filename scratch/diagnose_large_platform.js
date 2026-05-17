import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { simulate } from "../railbound-logic.js";
import { SOLVER_WORKER_CODE } from "../railbound-worker-code.js";

export const puzzle = {
  width: 7,
  height: 7,
  fixed: { "1,1": "|", "4,1": "-", "4,3": "-", "1,5": "|", "4,5": "-" },
  blanks: [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [2, 1], [3, 1], [5, 1], [6, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [1, 3], [2, 3], [3, 3], [5, 3], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [2, 5], [3, 5], [5, 5], [6, 5], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6]],
  cars: [{ name: "1", x: 4, y: 1, entry: "W" }, { name: "2", x: 4, y: 3, entry: "E" }, { name: "3", x: 4, y: 5, entry: "W" }],
  goal: [6, 3],
  goal_entry: "W",
  order: ["1", "2", "3"],
  max_steps: 150,
  tunnels: [],
  triggers: [],
  barriers: [],
  tsw_triggers: [],
  tswitches: [],
  autoSwitches: [],
  platforms: [{ x: 0, y: 1, dir: "E", car: "3" }, { x: 0, y: 5, dir: "E", car: "1" }],
};

// Paste pic exports here as placed dictionaries, for example:
// const pic1 = { "1,0": "ES" };
const pic1 = null;
const pic2 = null;
const pic3 = null;

function placedCost(placed) {
  return Object.keys(placed).length;
}

function verifyPlaced(label, placed) {
  if (!placed) {
    console.log(`${label}: skipped (paste placed dict into this file to verify)`);
    return null;
  }
  const result = simulate(puzzle, placed);
  console.log(`${label}: cost=${placedCost(placed)}, ok=${result.ok}, reason=${result.reason}, steps=${result.steps}`);
  assert.equal(result.ok, true, `${label} must simulate OK`);
  return { label, placed, cost: placedCost(placed), result };
}

function runSolver(maxPaths) {
  const messages = [];
  const self = {
    postMessage(msg) {
      messages.push(msg);
      if (msg.type === "progress" && (msg.cspInfo || msg.pruned !== undefined)) {
        console.log(`[maxPaths=${maxPaths}] progress`, msg);
      }
      if (msg.type === "solution") {
        console.log(`[maxPaths=${maxPaths}] solution cost=${msg.solution.__cost}`);
      }
      if (msg.type === "done") {
        console.log(`[maxPaths=${maxPaths}] done`, {
          method: msg.method,
          info: msg.info,
          alternates: msg.alternates?.length || 0,
        });
      }
    },
    close() {},
  };
  new Function("self", `${SOLVER_WORKER_CODE}\nreturn self;`)(self);
  const started = performance.now();
  self.onmessage({ data: { type: "solve", puzzle: { ...puzzle, maxPaths }, seed: 0, maxTracksHint: 0 } });
  const elapsedMs = performance.now() - started;
  const done = messages.find(m => m.type === "done");
  const solutions = messages.filter(m => m.type === "solution").map(m => m.solution);
  const final = solutions.at(-1) || null;
  console.log(`[maxPaths=${maxPaths}] summary`, {
    cost: final?.__cost ?? null,
    method: done?.method || null,
    info: done?.info || null,
    alternates: done?.alternates?.length || 0,
    elapsedMs: Number(elapsedMs.toFixed(1)),
  });
  return { maxPaths, messages, done, solutions, final, elapsedMs };
}

verifyPlaced("pic1", pic1);
verifyPlaced("pic2", pic2);
verifyPlaced("pic3", pic3);

const maxPaths = Number(process.env.MAX_PATHS_EXP || 10000);
runSolver(maxPaths);

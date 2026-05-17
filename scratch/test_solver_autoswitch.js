// Test: verify the solver can now find a solution for the autoSwitch puzzle
// Runs the solver worker code directly via eval (Node.js doesn't have Worker)

import { SOLVER_WORKER_CODE } from "../railbound-worker-code.js";

const puzzle = {
  width: 6, height: 4,
  fixed: { "0,1": "-", "1,1": "-" },
  blanks: [[2,0],[3,0],[4,0],[4,1],[0,2],[1,2],[4,2],[0,3],[1,3],[2,3],[3,3],[4,3]],
  cars: [
    { name: "2", x: 0, y: 1, entry: "W" },
    { name: "1", x: 1, y: 1, entry: "W" }
  ],
  goal: [5, 2], goal_entry: "W",
  order: ["1", "2"],
  max_steps: 150,
  tunnels: [], triggers: [], barriers: [],
  tsw_triggers: [], tswitches: [],
  autoSwitches: [
    { x: 2, y: 1, track: "T_ES_W" },
    { x: 3, y: 1, track: "T_SW_N" },
    { x: 2, y: 2, track: "T_ES_N" },
    { x: 3, y: 2, track: "T_WN_E" }
  ],
  platforms: []
};

// Mock the `self` and `postMessage` for the worker
const messages = [];
const self = {
  postMessage(msg) {
    messages.push(msg);
    if (msg.type === 'progress') {
      if (msg.pruned !== undefined) console.log(`Pruned: ${msg.pruned} blanks`);
      if (msg.cspInfo) console.log(`CSP info: ${msg.cspInfo}`);
    } else if (msg.type === 'solution') {
      console.log(`✅ Solution found! Cost: ${msg.solution.__cost}`);
      const sol = { ...msg.solution };
      delete sol.__cost;
      console.log('Tracks:', JSON.stringify(sol, null, 2));
    } else if (msg.type === 'done') {
      console.log(`Done. Method: ${msg.method}`);
      if (msg.info) console.log(`Info: ${msg.info}`);
    }
  },
  close() {}
};

// Make self available globally
globalThis.self = self;

// Evaluate the worker code
const fn = new Function('self', SOLVER_WORKER_CODE + '\nreturn self;');
fn(self);

// Trigger the solve
console.log("Starting solver for autoSwitch puzzle...");
const startTime = Date.now();
self.onmessage({ data: { type: 'solve', puzzle, seed: 0 } });
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

console.log(`\nCompleted in ${elapsed}s`);

const hasSolution = messages.some(m => m.type === 'solution');
const doneMsg = messages.find(m => m.type === 'done');
if (hasSolution) {
  console.log("✅ TEST PASSED: Solution found");
} else {
  console.log("❌ TEST FAILED: No solution found");
  console.log("Method:", doneMsg?.method);
}

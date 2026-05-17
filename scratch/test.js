import { simulate, filterBlanks } from "../railbound-logic.js";
import { SOLVER_WORKER_CODE } from "../railbound-worker-code.js";
import fs from "fs";

// Create puzzle matching the image
const W = 7, H = 5;
const puzzle = {
  width: W, height: H,
  fixed: {
    "3,0": "-",
    "3,4": "-",
    "5,1": "|",
    "5,2": "T_ES_N",
    "5,3": "|"
  },
  blanks: [
    [1,0], [2,0],
    [1,1], [2,1],
    [1,3], [2,3],
    [1,4], [2,4]
  ],
  cars: [
    { name: "1", x: 3, y: 0, entry: "E" }, // moving W
    { name: "2", x: 3, y: 4, entry: "E" }  // moving W
  ],
  goal: [6, 2],
  goalEntry: "W",
  order: ["1", "2"],
  maxSteps: 50,
  tunnels: [
    { color: "#e74c3c", cells: [{ x: 0, y: 0, facing: "E" }, { x: 5, y: 4, facing: "N" }] },
    { color: "#3498db", cells: [{ x: 0, y: 4, facing: "E" }, { x: 5, y: 0, facing: "S" }] }
  ]
};

const placed = {
  "2,4": "-",
  "1,4": "-",
  "2,0": "T_SW_E",
  "1,0": "T_SW_E",
  "1,1": "NE",
  "2,1": "WN"
};

console.log("=== SIMULATE ===");
const res = simulate(puzzle, placed);
console.log(res);

console.log("\n=== SOLVER ===");
// Since the worker code is a string, we can eval it by mocking self
global.self = {
  postMessage: (msg) => {
    if (msg.type === "progress") {} // ignore
    else console.log("[Worker]", msg);
  },
  onmessage: null
};
eval(SOLVER_WORKER_CODE);

self.onmessage({
  data: {
    type: "solve",
    puzzle: puzzle,
    seed: 0,
    maxTracksHint: 0
  }
});

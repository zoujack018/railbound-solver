import { SOLVER_WORKER_CODE } from "../railbound-worker-code.js";

const W = 7, H = 5;
const puzzle = {
  width: W, height: H,
  fixed: { "3,0": "-", "3,4": "-", "5,1": "|", "5,2": "T_ES_N", "5,3": "|" },
  blanks: [[1,0], [2,0], [1,1], [2,1], [1,3], [2,3], [1,4], [2,4]],
  cars: [{ name: "1", x: 3, y: 0, entry: "E" }, { name: "2", x: 3, y: 4, entry: "E" }],
  goal: [6, 2], goalEntry: "W", order: ["1", "2"], maxSteps: 50,
  tunnels: [
    { color: "#e74c3c", cells: [{ x: 0, y: 0, facing: "E" }, { x: 5, y: 4, facing: "N" }] },
    { color: "#3498db", cells: [{ x: 0, y: 4, facing: "E" }, { x: 5, y: 0, facing: "S" }] }
  ]
};

global.self = {
  postMessage: (msg) => {
    if (msg.type === "solution") {
      console.log("SOLUTION FOUND!", msg.solution);
    }
    if (msg.type === "progress" && msg.cspInfo) {
      console.log("CSP INFO", msg.cspInfo);
    }
    if (msg.info) console.log("INFO", msg.info);
  },
  onmessage: null
};

const modifiedCode = SOLVER_WORKER_CODE.replace(
  "const sols=solveDFS(fpz,1,minTracks,budget,seed||0,bs,meta);",
  "const sols=solveDFS(fpz,1,false,999,seed||0,bs,meta);"
);
eval(modifiedCode);

self.onmessage({
  data: {
    type: "solve",
    puzzle: puzzle,
    seed: 0,
    maxTracksHint: 0,
  }
});

import fs from "fs";

// Simple puzzle WITHOUT zero car — make sure the normal path is unaffected
const pz = {
  width: 3, height: 3,
  fixed: { "0,0": "-", "1,0": "-" },
  blanks: [[0, 1], [1, 1], [0, 2], [1, 2]],
  cars: [{ name: "1", x: 0, y: 0, entry: "W" }],
  goal: [2, 0], goalEntry: "W", order: ["1"],
  maxSteps: 20, tunnels: [], triggers: [], barriers: [],
  tsw_triggers: [], tswitches: [], autoSwitches: [], platforms: []
};

global.self = {
  postMessage: (msg) => { if (msg.type === "done" || msg.type === "solution") console.log(msg); },
  onmessage: null
};

import("../railbound-worker.js").then(() => {
  self.onmessage({ data: { type: "solve", puzzle: pz, seed: 0, maxTracksHint: 0 } });
});

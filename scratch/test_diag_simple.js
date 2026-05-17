import fs from "fs";
const pz = {
  width: 3, height: 1,
  fixed: { "0,0": "-" },
  blanks: [[1, 0]],
  cars: [
    { name: "1", x: 0, y: 0, entry: "W" },
    { name: "0", role: "zero", x: 2, y: 0, entry: "E" }
  ],
  goal: [2, 0], goal_entry: "W", order: ["1"]
};

global.self = {
  postMessage: (msg) => { console.log(msg); },
  onmessage: null
};

import("../railbound-worker.js").then(() => {
  self.onmessage({ data: { type: "solve", puzzle: pz, seed: 0, maxTracksHint: 0 } });
});

import fs from "fs";

const pz = JSON.parse(fs.readFileSync("scratch/test_zero_aware.json", "utf8"));

global.self = {
  postMessage: (msg) => {
    console.log(msg);
  },
  onmessage: null
};

import("../railbound-worker.js").then(() => {
  self.onmessage({
    data: {
      type: "solve",
      puzzle: pz,
      seed: 0,
      maxTracksHint: 0,
    }
  });
});

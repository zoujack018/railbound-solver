import { pk, simulate } from "../railbound-rules.js";

const puzzle = {
  "width": 9, "height": 9,
  "fixed": { "4,1": "|", "1,4": "-", "7,4": "-", "3,7": "|", "6,8": "T_NE_W", "7,8": "T_NE_W" },
  "blanks": [[3,1],[5,1],[3,2],[4,2],[5,2],[1,3],[2,3],[3,3],[5,3],[6,3],[7,3],[2,4],[4,4],[6,4],[1,5],[2,5],[3,5],[5,5],[6,5],[7,5],[3,6],[4,6],[5,6],[3,8],[4,8]],
  "cars": [
    { "name": "3", "x": 4, "y": 1, "entry": "N" },
    { "name": "2", "x": 1, "y": 4, "entry": "W" },
    { "name": "1", "x": 7, "y": 4, "entry": "E" },
    { "name": "0.1", "x": 3, "y": 7, "entry": "S", "role": "zero" }
  ],
  "goal": [8, 8], "goal_entry": "W",
  "order": ["1", "2", "3"],
  "max_steps": 300, "zero_safety_steps": 3,
  "tunnels": [
    { "color": "#3498db", "cells": [{ "x": 4, "y": 0, "facing": "S" }, { "x": 7, "y": 7, "facing": "S" }] },
    { "color": "#f39c12", "cells": [{ "x": 0, "y": 4, "facing": "E" }, { "x": 6, "y": 7, "facing": "S" }] },
    { "color": "#2ecc71", "cells": [{ "x": 8, "y": 4, "facing": "W" }, { "x": 5, "y": 7, "facing": "S" }] }
  ],
  "triggers": [], "barriers": [], "tsw_triggers": [], "tswitches": [],
  "autoSwitches": [
    { "x": 4, "y": 3, "track": "T_ES_W" },
    { "x": 3, "y": 4, "track": "T_SW_N" },
    { "x": 5, "y": 4, "track": "T_NE_S" },
    { "x": 4, "y": 5, "track": "T_NE_W" },
    { "x": 5, "y": 8, "track": "T_WN_E" }
  ],
  "platforms": []
};

const correctSolution = {
  "3,2": "ES", "4,2": "T_WN_E", "5,2": "SW",
  "3,3": "T_NE_S", "5,3": "T_WN_S",
  "2,4": "T_SW_E", "4,4": "|", "6,4": "-",
  "2,5": "NE", "3,5": "T_NE_W", "5,5": "T_WN_S",
  "3,6": "ES", "4,6": "-", "5,6": "WN",
  "3,8": "NE", "4,8": "-"
};

console.log("=== Testing correct solution with fixed tailing check ===");
const r = simulate(puzzle, correctSolution);
console.log(`Result: ok=${r.ok} reason="${r.reason}" steps=${r.steps}`);
if (!r.ok) console.log(`  detail: ${JSON.stringify(r.detail)}`);

if (r.ok && r.history) {
  console.log("\nStep-by-step:");
  const names = ["0.1", "1", "2", "3"];
  for (let i = 0; i < r.history.length; i++) {
    const step = r.history[i];
    const parts = names.map(n => {
      const c = step.find(c => c.name === n);
      return c ? `(${c.x},${c.y})${c.entry}` : "done  ";
    });
    console.log(`  ${String(i).padStart(3)}: ${parts.join("  ")}`);
  }
  console.log(`\n✅ CORRECT SOLUTION PASSES! ${r.arrived.join(",")}`);
}

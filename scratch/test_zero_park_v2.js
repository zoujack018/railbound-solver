import { pk, simulate, formatSimError } from "../railbound-rules.js";

// Test 1: Zero car parks WITH track — track exits to dead-end (next cell has no track)
console.log("=== Test 1: Zero car parks WITH track (dead-end exit) ===");
const miniPuzzle1 = {
  width: 5, height: 3,
  fixed: { "0,0": "-", "1,0": "-", "2,0": "-", "3,0": "-", "0,1": "-" },
  blanks: [[1,1],[2,1]],
  cars: [
    { name: "1", x: 0, y: 0, entry: "W" },
    { name: "0.1", x: 0, y: 1, entry: "W", role: "zero" },
  ],
  goal: [4, 0], goal_entry: "W",
  order: ["1"],
  max_steps: 20, zero_safety_steps: 3,
  tunnels: [], triggers: [], barriers: [],
  tsw_triggers: [], tswitches: [], autoSwitches: [], platforms: []
};

// Place track at BOTH (1,1) and (2,1). Zero goes (0,1)→(1,1)→(2,1).
// At (2,1) with "-", exit E leads to (3,1) — no track there → parks at (2,1).
const placed1 = { "1,1": "-", "2,1": "-" };
const r1 = simulate(miniPuzzle1, placed1);
console.log(formatSimError(r1));
if (r1.ok) {
  console.log("✅ PASS: Zero car parked WITH track, normal car reached goal");
  if (r1.history) {
    for (let i = 0; i < Math.min(r1.history.length, 8); i++) {
      const zeroCar = r1.history[i].find(c => c.name === "0.1");
      if (zeroCar) {
        console.log(`  Step ${i}: zero@(${zeroCar.x},${zeroCar.y})${zeroCar.entry} parked=${!!zeroCar.parked}`);
      }
    }
  }
} else {
  console.log(`❌ FAIL: ${r1.reason}`);
  if (r1.detail) console.log(`  detail: ${JSON.stringify(r1.detail)}`);
}

// Test 2: Zero car on cell with NO track → must FAIL (not park)
console.log("\n=== Test 2: Zero car on cell with NO track → must fail ===");
const placed2 = { "1,1": "-" }; // only (1,1) has track, zero exits to (2,1) with no track
// Zero goes (0,1)→(1,1)→(2,1). At (2,1) no track → should park at (1,1) since next cell dead-end.
// Wait: with the new model, zero at (1,1) with "-", exit E goes to (2,1). (2,1) has no track.
// So zero parks at (1,1), not at (2,1). This should still work!
const r2 = simulate(miniPuzzle1, placed2);
console.log(formatSimError(r2));
if (r2.ok) {
  console.log("✅ PASS: Zero car parked at dead-end (1,1), not on empty (2,1)");
  if (r2.history) {
    for (let i = 0; i < Math.min(r2.history.length, 8); i++) {
      const zeroCar = r2.history[i].find(c => c.name === "0.1");
      if (zeroCar) {
        console.log(`  Step ${i}: zero@(${zeroCar.x},${zeroCar.y})${zeroCar.entry} parked=${!!zeroCar.parked}`);
      }
    }
  }
} else {
  console.log(`❌ FAIL: ${r2.reason}`);
  if (r2.detail) console.log(`  detail: ${JSON.stringify(r2.detail)}`);
}

// Test 3: Zero car WITHOUT any track at its start position → must fail
console.log("\n=== Test 3: Zero car starts at cell with no track → must fail ===");
const miniPuzzle3 = {
  width: 5, height: 3,
  fixed: { "0,0": "-", "1,0": "-", "2,0": "-", "3,0": "-" },
  blanks: [[0,1],[1,1]],
  cars: [
    { name: "1", x: 0, y: 0, entry: "W" },
    { name: "0.1", x: 0, y: 1, entry: "W", role: "zero" },
  ],
  goal: [4, 0], goal_entry: "W",
  order: ["1"],
  max_steps: 20, zero_safety_steps: 3,
  tunnels: [], triggers: [], barriers: [],
  tsw_triggers: [], tswitches: [], autoSwitches: [], platforms: []
};

// No track placed for zero car at all
const r3 = simulate(miniPuzzle3, {});
console.log(formatSimError(r3));
if (!r3.ok) {
  console.log("✅ PASS: Zero car correctly fails with no track (not parked on empty)");
} else {
  console.log("❌ FAIL: Zero car should NOT pass with no track at starting cell");
}

// Test 4: Zero car parks when exit leads OOB (edge of grid)
console.log("\n=== Test 4: Zero car parks when exit leads OOB ===");
const miniPuzzle4 = {
  width: 3, height: 3,
  fixed: { "0,0": "-", "1,0": "-" },
  blanks: [[0,1]],
  cars: [
    { name: "1", x: 0, y: 0, entry: "W" },
    { name: "0.1", x: 0, y: 1, entry: "N", role: "zero" },
  ],
  goal: [2, 0], goal_entry: "W",
  order: ["1"],
  max_steps: 20, zero_safety_steps: 3,
  tunnels: [], triggers: [], barriers: [],
  tsw_triggers: [], tswitches: [], autoSwitches: [], platforms: []
};

// Place "|" at (0,1): zero enters from N, exits S to (0,2) — but wait, entry N exits S.
// Actually TRACKS["|"] = { N: "S", S: "N" }. Entry N → exit S. Goes to (0,2). No track there.
// Actually zero starts at (0,1) entry N, which means it came from the south.
// "|" entry N → exit S. Delta S = [0,1]. So nx=0, ny=2. That's (0,2) which is in bounds.
// Let me use a different approach. Put the zero car at edge facing outward.
const miniPuzzle4b = {
  width: 3, height: 2,
  fixed: { "0,0": "-", "1,0": "-" },
  blanks: [[0,1]],
  cars: [
    { name: "1", x: 0, y: 0, entry: "W" },
    { name: "0.1", x: 0, y: 1, entry: "N", role: "zero" },
  ],
  goal: [2, 0], goal_entry: "W",
  order: ["1"],
  max_steps: 20, zero_safety_steps: 3,
  tunnels: [], triggers: [], barriers: [],
  tsw_triggers: [], tswitches: [], autoSwitches: [], platforms: []
};

// Place "|" at (0,1): zero enters N→exit S. Goes to (0,2) which is OOB (height=2).
// → Zero should park at (0,1).
const placed4 = { "0,1": "|" };
const r4 = simulate(miniPuzzle4b, placed4);
console.log(formatSimError(r4));
if (r4.ok) {
  console.log("✅ PASS: Zero car parked when exit leads OOB");
  if (r4.history) {
    for (let i = 0; i < Math.min(r4.history.length, 8); i++) {
      const zeroCar = r4.history[i].find(c => c.name === "0.1");
      if (zeroCar) {
        console.log(`  Step ${i}: zero@(${zeroCar.x},${zeroCar.y})${zeroCar.entry} parked=${!!zeroCar.parked}`);
      }
    }
  }
} else {
  console.log(`❌ FAIL: ${r4.reason}`);
  if (r4.detail) console.log(`  detail: ${JSON.stringify(r4.detail)}`);
}

// Test 5: Regression — trace_zero puzzle
console.log("\n=== Test 5: Regression — trace_zero puzzle ===");
const traceZeroPuzzle = {
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

const r5 = simulate(traceZeroPuzzle, correctSolution);
console.log(formatSimError(r5));
if (r5.ok) {
  console.log(`✅ Regression PASS: trace_zero puzzle passes (steps=${r5.steps})`);
} else {
  console.log("❌ Regression FAIL");
  // Show what zero car was doing
  if (r5.history) {
    const lastFew = r5.history.slice(Math.max(0, r5.steps - 3));
    for (let i = Math.max(0, r5.steps - 3); i <= r5.steps; i++) {
      const step = r5.history[i];
      if (!step) continue;
      const zero = step.find(c => c.name === "0.1");
      if (zero) console.log(`  Step ${i}: zero@(${zero.x},${zero.y})${zero.entry} parked=${!!zero.parked}`);
    }
  }
}

console.log("\n=== All tests done ===");

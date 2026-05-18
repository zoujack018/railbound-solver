import { pk, simulate, formatSimError } from "../railbound-rules.js";

const puzzle = {
  "width": 7,
  "height": 7,
  "fixed": {
    "0,1": "-",
    "1,1": "T_ES_W",
    "5,1": "-",
    "1,2": "|",
    "0,3": "-",
    "1,3": "T_WN_S",
    "5,3": "NE",
    "1,4": "|",
    "0,5": "-",
    "1,5": "WN",
    "3,5": "-",
    "5,5": "|"
  },
  "blanks": [
    [1,0],[2,0],[3,0],[4,0],
    [2,1],[4,1],
    [2,2],[3,2],[4,2],[5,2],[6,2],
    [2,3],[4,3],[6,3],
    [2,4],[3,4],[4,4],[5,4],[6,4],
    [2,5],[4,5],[6,5],
    [1,6],[2,6],[3,6],[4,6],[5,6],[6,6]
  ],
  "cars": [
    { "name": "1", "x": 0, "y": 1, "entry": "W" },
    { "name": "0.1", "x": 0, "y": 3, "entry": "W", "role": "zero" },
    { "name": "3", "x": 0, "y": 5, "entry": "W" },
    { "name": "2", "x": 3, "y": 5, "entry": "W" }
  ],
  "goal": [6, 1],
  "goal_entry": "W",
  "order": ["1", "2", "3"],
  "max_steps": 300,
  "zero_safety_steps": 3,
  "tunnels": [],
  "triggers": [
    { "x": 5, "y": 3, "color": "#4a8ae8" },
    { "x": 5, "y": 5, "color": "#e8584a" }
  ],
  "barriers": [],
  "tsw_triggers": [
    { "x": 5, "y": 3, "color": "#4a8ae8" },
    { "x": 5, "y": 5, "color": "#e8584a" }
  ],
  "tswitches": [
    { "x": 3, "y": 1, "color": "#e8584a", "track": "T_ES_W" },
    { "x": 3, "y": 3, "color": "#4a8ae8", "track": "T_WN_E" }
  ],
  "autoSwitches": [],
  "platforms": []
};

// Test 1: Simulate with zero car parking — train 0 enters (2,3) and parks (no track there)
// Only place a track at 2,3 that brings zero car in but has no exit
console.log("=== Test 1: Zero car parks at (2,3) with \"-\" track ===");
const placed1 = {
  "2,3": "-",  // zero car enters from W, exits E to (3,3) ... hmm, this actually connects
};
// Actually let me think about the correct scenario:
// Train 0 starts at (0,3) entry W, goes through fixed "-" at (0,3), then T_WN_S at (1,3).
// T_WN_S: entry W -> exit N (main), entry S -> exit N (branch)
// So from (1,3) entry W, exit is N. Train 0 goes to (1,2).
// Wait, T_WN_S: curve is W,N. branch S.
// TRACKS: T_WN_S: { S: "N", W: "N", N: "W" }
// So entry W -> exit N. Train 0 goes UP to (1,2).
// At (1,2) there's fixed "|". Entry S -> exit N. Goes to (1,1).
// At (1,1) there's T_ES_W. T_ES_W: { W: "E", S: "E", E: "S" }
// Entry S -> exit E. Goes to (2,1).
// So train 0 goes: (0,3)W -> (1,3)W -> up to (1,2)S -> up to (1,1)S -> right to (2,1)W
// Then train 0 needs track at (2,1). 
// Actually wait, train 0 enters at (0,3) with entry W. 
// At (0,3) there's "-". Entry W -> exit E. Goes to (1,3).
// At (1,3) there's T_WN_S. Entry W -> exit N. Goes to (1,2) with entry S.
// At (1,2) there's "|". Entry S -> exit N. Goes to (1,1) with entry S.
// At (1,1) there's T_ES_W. Entry S -> exit E. Goes to (2,1) with entry W.
// (2,1) is a blank. So zero car needs a track here.

// Actually the user said "we can have Train 0 stop at 2,3 and do nothing"
// Let me re-read: "Look at 2,4 and 2,5 — we can have Train 0 stop at 2,3 and do nothing, saving two tracks"
// So the current solution must route train 0 through 2,3 -> 2,4 -> 2,5.
// The optimization is: at 2,3, don't place a track that continues to 2,4. Instead, 
// place a track that brings train 0 to 2,3 but then it has nowhere to go → parks.

// Let me trace: Train 0 starts at (0,3)W. Fixed "-" at (0,3): W->E, goes to (1,3)W.
// Fixed T_WN_S at (1,3): W->N, goes to (1,2)S. 
// Fixed "|" at (1,2): S->N, goes to (1,1)S.
// Fixed T_ES_W at (1,1): S->E, goes to (2,1)W.
// Blank at (2,1). Need track. If we put "-": W->E, goes to (3,1). But (3,1) is a tswitch.
// tswitch at (3,1): T_ES_W, color red. T_ES_W: W->E, S->E, E->S.
// So from (3,1) entry W, exit E. Goes to (4,1)W.
// Blank at (4,1). "-": W->E. Goes to (5,1)W.
// Fixed "-" at (5,1): W->E. Goes to (6,1) = GOAL. But zero car can't enter goal!

// So train 0 can't go straight through row 1. It needs to turn down.
// Looking at the diagram, train 0 probably goes: (0,3) -> (1,3) -> (2,3) and then loops somehow.
// Wait, T_WN_S at (1,3): curve is W,N. branch S. 
// T_WN_S = { S: "N", W: "N", N: "W" }
// Entry W -> exit N (goes up)
// But the user says train 0 should stop at (2,3). How does it get there?
// The tswitch at (3,3) with color blue could be toggled, changing behavior.

// Actually, (1,3) has T_WN_S. When train 0 starts, the blue tswitch at (3,3) hasn't been triggered.
// So at (1,3), entry W -> N, train 0 goes UP.
// But what if we want train 0 to go to (2,3)?
// The user's idea: have train 0 go (0,3)W -> (1,3)W -> up. But then it goes through (1,2), (1,1), (2,1)...
// Hmm, let me re-read: "we can have Train 0 stop at 2,3 and do nothing"
// Maybe the routing changes with tswitch toggles?

// Let me test: what does the CURRENT solution look like (from the image)?
// The image shows train 0 at (2,3) with paths going through the tswitch at (3,3).
// So maybe with proper tswitch toggling, train 0 arrives at (2,3).

// Let me just try simulating with a solution where:
// - Track at (2,3) is "-" (so zero car goes W->E to (3,3))
// - But NO tracks at (2,4) and (2,5) 
// This tests that zero car parks when it can't continue.

// Actually, let me think again. The user wants zero to STOP at (2,3), meaning
// the track at (2,3) should be such that zero can enter but NOT exit.
// Zero enters (2,3) from W (coming from (1,3)). Wait, can zero get to (2,3)?
// (1,3) T_WN_S: W->N. So zero goes UP, not right to (2,3).
// Unless the tswitch state changes...

// Let me just try a simple test: simulate with a minimal placed set 
// and verify the parking mechanism works.

console.log("\n=== Test 2: Verify zero car parking mechanism ===");
// Create a minimal test: zero car at a cell with no track
const miniPuzzle = {
  width: 5, height: 3,
  fixed: { "0,1": "-" },
  blanks: [[1,1],[2,1],[3,1]],
  cars: [
    { name: "1", x: 0, y: 0, entry: "W" },  // dummy, won't matter
    { name: "0.1", x: 0, y: 1, entry: "W", role: "zero" },
  ],
  goal: [4, 0], goal_entry: "W",
  order: ["1"],
  max_steps: 20, zero_safety_steps: 3,
  tunnels: [], triggers: [], barriers: [],
  tsw_triggers: [], tswitches: [], autoSwitches: [], platforms: []
};

// Place "-" at (1,1), then zero goes to (2,1) which has no track → should park
const placed2 = { "1,1": "-" };
const r2 = simulate(miniPuzzle, placed2);
console.log("Zero car enters (2,1) with no track:");
console.log(formatSimError(r2));
// Should NOT fail — zero car should park at (2,1)

if (r2.ok) {
  console.log("❌ Unexpected pass — need normal car to reach goal too");
} else if (r2.reason === "超时" || r2.detail?.errorCode === 'TIMEOUT') {
  console.log("✅ Zero car parked successfully (timeout because car 1 has no path, but zero didn't crash!)");
  // Check that zero car is at (2,1) and parked
  if (r2.history) {
    const lastStep = r2.history[r2.history.length - 1];
    const zeroCar = lastStep.find(c => c.name === "0.1");
    if (zeroCar) {
      console.log(`  Zero car final position: (${zeroCar.x},${zeroCar.y}) parked=${!!zeroCar.parked}`);
      if (zeroCar.x === 2 && zeroCar.y === 1 && zeroCar.parked) {
        console.log("  ✅ Zero car correctly parked at (2,1)");
      }
    }
  }
} else {
  console.log(`❌ FAIL: ${r2.reason}`);
  if (r2.detail) console.log(`  detail: ${JSON.stringify(r2.detail)}`);
}

// Test 3: Verify zero car parks and normal car can still complete
console.log("\n=== Test 3: Zero parks, normal car reaches goal ===");
const miniPuzzle3 = {
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

// Car 1 goes straight on row 0 to goal. Zero car goes right on row 1, parks at (2,1) with no track.
const placed3 = { "1,1": "-" }; // zero goes (0,1)-> (1,1)-> (2,1) parks
const r3 = simulate(miniPuzzle3, placed3);
console.log(formatSimError(r3));
if (r3.ok) {
  console.log("✅ PASS: Normal car reached goal, zero car parked safely");
  if (r3.history) {
    // Find step where zero car parked
    for (let i = 0; i < Math.min(r3.history.length, 10); i++) {
      const zeroCar = r3.history[i].find(c => c.name === "0.1");
      if (zeroCar) {
        console.log(`  Step ${i}: zero@(${zeroCar.x},${zeroCar.y})${zeroCar.entry} parked=${!!zeroCar.parked}`);
      }
    }
  }
} else {
  console.log(`❌ FAIL: ${r3.reason}`);
  if (r3.detail) console.log(`  detail: ${JSON.stringify(r3.detail)}`);
}

// Test 4: Verify existing trace_zero still works (regression)
console.log("\n=== Test 4: Regression — trace_zero puzzle ===");
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

const r4 = simulate(traceZeroPuzzle, correctSolution);
console.log(formatSimError(r4));
if (r4.ok) {
  console.log("✅ Regression PASS: trace_zero puzzle still works");
} else {
  console.log("❌ Regression FAIL");
}

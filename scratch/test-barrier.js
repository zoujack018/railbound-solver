import { simulate, pk } from './railbound-logic.js';

// ============================
// Test: Exact buildP() output format
// Puzzle layout (5x3):
// Row 0: [Car1"-"] ["-"] [barrier"-" closed red] ["-"] [Goal]
// Row 1: ["-"]     ["-"] ["-"]                   []    []  
// Row 2: [Car2"-"] ["-"] [trigger"-" red]         []    []
//
// Car1 goes East, hits closed barrier at (2,0), waits
// Car2 goes East, hits trigger at (2,1) → opens barrier
// Car1 resumes, reaches goal
// ============================

const puzzle = {
  width: 5, height: 3,
  fixed: {
    // Car1 path (row 0) - car track + all tracks including barrier
    "0,0": "-", "1,0": "-", "2,0": "-", "3,0": "-",
    // Car2 path (row 1) - need to actually reach trigger
    // Wait - car2 is at row 2, but puzzle is only 3 rows high
    "0,2": "-", "1,2": "-", "2,2": "-",
  },
  blanks: [],
  cars: [
    { name: "1", x: 0, y: 0, entry: "W" },
    { name: "2", x: 0, y: 2, entry: "W" },
  ],
  goal: [4, 0],
  goalEntry: "W",
  order: ["1", "2"],  // Car1 must arrive first
  maxSteps: 20,
  triggers: [{ x: 2, y: 2, color: "red" }],
  barriers: [{ x: 2, y: 0, color: "red", initialState: "closed" }],
};

console.log("=== Full scenario test ===");
const r = simulate(puzzle, {});
console.log("ok:", r.ok, "reason:", r.reason, "steps:", r.steps);
console.log("arrived:", r.arrived);
for (let i = 0; i < r.history.length; i++) {
  console.log(`Step ${i}:`, r.history[i].map(c => `${c.name}@(${c.x},${c.y})`).join(", "));
}

// Problem: Car2 goes to (3,2) but there's no track there!
// Car2 has no place to go after trigger.
// In a real Railbound puzzle, Car2 would need a path to goal or 
// would go off somewhere. Let's fix: Car2 also needs to reach the goal.

console.log("\n=== Full scenario with Car2 path to goal ===");
const puzzle2 = {
  width: 5, height: 3,
  fixed: {
    "0,0": "-", "1,0": "-", "2,0": "-", "3,0": "-",
    "0,2": "-", "1,2": "-", "2,2": "-", "3,2": "WN", // Car2 turns up
    "3,1": "|", // goes up
    // Car2 enters row 0 at (3,0) but that's already fixed as "-"
    // Actually (3,2) WN: W→N, so car enters from W exits N
    // Goes to (3,1) with entry S, track "|" S→N 
    // Goes to (3,0) with entry S, track "-" only has E↔W... fail!
  },
  blanks: [],
  cars: [
    { name: "1", x: 0, y: 0, entry: "W" },
    { name: "2", x: 0, y: 2, entry: "W" },
  ],
  goal: [4, 0],
  goalEntry: "W",
  order: ["1", "2"],
  maxSteps: 20,
  triggers: [{ x: 2, y: 2, color: "red" }],
  barriers: [{ x: 2, y: 0, color: "red", initialState: "closed" }],
};

const r2 = simulate(puzzle2, {});
console.log("ok:", r2.ok, "reason:", r2.reason, "steps:", r2.steps);
console.log("arrived:", r2.arrived);
for (let i = 0; i < Math.min(r2.history.length, 15); i++) {
  console.log(`Step ${i}:`, r2.history[i].map(c => `${c.name}@(${c.x},${c.y})`).join(", "));
}

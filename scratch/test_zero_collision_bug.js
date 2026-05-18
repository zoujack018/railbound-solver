/**
 * Brute-force search for discrepancies between quickCollisionCheck
 * results and simulate() results when zero cars are involved.
 * 
 * Strategy: Generate many small puzzles with zero + normal car,
 * apply random track placements, and check if quickCollisionCheck
 * agrees with simulate().
 */
import { pk, simulate, isZeroCar, exitPort, BASIC_TRACKS } from "../railbound-rules.js";

const messages = [];
globalThis.self = { postMessage: m => messages.push(m), close: () => {} };
await import("../railbound-worker.js");

// Extract quickCollisionCheck by solving and checking solutions
function solve(puzzle) {
  messages.length = 0;
  self.onmessage({ data: { type: "solve", puzzle, seed: 0 } });
  return {
    done: messages.find(m => m.type === "done"),
    solutions: messages.filter(m => m.type === "solution").map(m => m.solution),
  };
}

let discrepancies = 0, total = 0;

// Test many configurations
const configs = [
  // Zero and normal on same row
  { zx: 0, zy: 0, ze: "W", nx: 2, ny: 0, ne: "W", gx: 4, gy: 0, ge: "W", w: 5, h: 1, blanks: [[1,0],[3,0]] },
  { zx: 0, zy: 0, ze: "W", nx: 3, ny: 0, ne: "W", gx: 4, gy: 0, ge: "W", w: 5, h: 1, blanks: [[1,0],[2,0]] },
  // Zero and normal on different rows
  { zx: 0, zy: 0, ze: "W", nx: 0, ny: 1, ne: "W", gx: 3, gy: 1, ge: "W", w: 4, h: 2, blanks: [[1,0],[2,0],[1,1],[2,1]] },
  // Head-on potential
  { zx: 0, zy: 0, ze: "W", nx: 3, ny: 0, ne: "E", gx: 0, gy: 1, ge: "N", w: 4, h: 2, blanks: [[1,0],[2,0],[0,1],[1,1]] },
];

for (const cfg of configs) {
  const puzzle = {
    width: cfg.w, height: cfg.h,
    cars: [
      { name: "0", role: "zero", x: cfg.zx, y: cfg.zy, entry: cfg.ze },
      { name: "1", role: "normal", x: cfg.nx, y: cfg.ny, entry: cfg.ne }
    ],
    order: ["1"],
    goal: [cfg.gx, cfg.gy], goalEntry: cfg.ge,
    fixed: {
      [pk(cfg.zx, cfg.zy)]: "-",
      [pk(cfg.nx, cfg.ny)]: "-",
    },
    blanks: cfg.blanks,
    tunnels: [], barriers: [], triggers: [],
    tswitches: [], tsw_triggers: [], auto_switches: [],
    platforms: [], maxSteps: 15,
  };

  const result = solve(puzzle);
  
  for (const sol of result.solutions) {
    total++;
    const placed = {};
    for (const k in sol) if (k !== "__cost") placed[k] = sol[k];
    const r = simulate(puzzle, placed);
    if (!r.ok) {
      console.log("DISCREPANCY! Solver accepted but simulate rejects:");
      console.log("  Config:", JSON.stringify(cfg));
      console.log("  Placed:", JSON.stringify(placed));
      console.log("  simulate:", r.reason, r.detail?.errorCode);
      discrepancies++;
    }
  }
}

console.log(`\nChecked ${total} solutions, found ${discrepancies} discrepancies.`);
if (discrepancies > 0) {
  console.log("✗ BUG CONFIRMED: Solver produces solutions that fail simulate()!");
  process.exit(1);
} else {
  console.log("✓ All solver solutions agree with simulate()");
  process.exit(0);
}

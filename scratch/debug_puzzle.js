/**
 * We have a confirmed zero-car cycle. Now brute-force the remaining blanks
 * to find a complete solution for all 4 cars.
 * 
 * Zero cycle tracks:
 * '3,6': '|', '3,5': 'T_NE_S', '2,4': 'NE', '2,3': 'ES', '3,3': 'T_ES_W',
 * '5,3': 'T_SW_E', '6,4': 'T_WN_E', '6,3': 'SW', '5,5': 'WN', '4,4': '|',
 * '3,8': 'NE', '4,8': '-'
 */
import { exitPort, simulate, pk, BASIC_TRACKS, T_TRACKS } from "./railbound-rules.js";
import fs from "fs";

const pz = JSON.parse(fs.readFileSync("scratch/test_zero_aware.json", "utf8"));
const ALL_TRACKS = [...BASIC_TRACKS, ...T_TRACKS];

// Fixed zero-cycle tracks
const zeroCycle = {
  '3,6': '|', '3,5': 'T_NE_S',
  '2,4': 'NE', '2,3': 'ES', '3,3': 'T_ES_W',
  '5,3': 'T_SW_E', '6,4': 'T_WN_E', '6,3': 'SW',
  '5,5': 'WN', '4,4': '|',
  '3,8': 'NE', '4,8': '-',
};

// Remaining blanks not yet placed
const allBlanks = pz.blanks.map(b => pk(b[0], b[1]));
const remaining = allBlanks.filter(k => !zeroCycle[k]);
console.log("Remaining blanks:", remaining.length, remaining);

// Some of these blanks might be needed by normal cars:
// Car 3: (4,1)→(4,2)→... 
// Car 2: (1,4)→(2,4)NE(zero)→(2,3)ES(zero) but car2 enters (2,4) from W, NE: W→? N.
//   NE doesn't accept W! exitPort('NE','W') = null.
// 
// So the zero cycle track at (2,4)=NE conflicts with car2!
// Car 2 at (1,4)- exits E→(2,4) entry W. NE: W→null. Car2 crashes!
//
// This means the zero cycle needs to use a track at (2,4) that ALSO accepts W.
// Need (2,4) to accept entry E (from zero car) AND entry W (from car 2).
// Options: '-': E→W, W→E (good for both directions, but sends zero WEST to (1,4)→tunnel→goal!)
// T tracks accepting both E and W:
// T_NE_W: E→N, W→E  (zero E→N, car2 W→E)
// T_ES_W: E→S, W→E  (zero E→S→(2,5), car2 W→E→(3,4))
// T_SW_E: E→W, W→S  (zero E→W, car2 W→S)
// T_WN_E: E→W, W→N  (zero E→W, car2 W→N)

// T_NE_W: zero at (2,4) entry E→N→(2,3). Car2 at (2,4) entry W→E→(3,4) auto.
// This is perfect! Zero goes north, car2 goes east to the auto-switch.
// Let me update:

const zeroCycleV2 = { ...zeroCycle, '2,4': 'T_NE_W' };

// But wait — re-check zero cycle with (2,4)=T_NE_W instead of NE
// NE: E→N. T_NE_W: E→N. Same exit for zero car! ✓
// And car2: W→E→(3,4) auto. ✓

// Check (5,3) T_SW_E — car3 might also use this cell.
// If car3 at (4,2)NE→(5,2)→(5,3)T_SW_E entry? Depends on (5,2) track.

// Car 2: (1,4)-→(2,4)T_NE_W W→E→(3,4) auto T_SW_N (state may vary) 
// state0: W→S → (3,5)T_NE_S entry N → N→E → (4,5) auto entry W
// Wait, (3,4) auto entry W: T_SW_N state0: W→S. Goes to (3,5).
// But (3,5) is T_NE_S. Entry N: exitPort('T_NE_S','N')=E → (4,5) auto.
// (4,5) T_NE_W state0: entry W→E → (5,5)WN entry W → exitPort('WN','W')=N → (5,4) auto
// Hmm, WN: W→N. (5,5) entry W→N→(5,4) entry S.
// (5,4) auto T_NE_S state? depends on zero toggle history.

// This is getting very complex with timing. Let me just brute-force remaining blanks.

// There are 13 remaining blanks. 14^13 = 11 trillion — way too many.
// But many blanks may not be needed. Let me try with subsets.

// Key blanks for car routing:
// (4,2): car3 needs this
// (5,2): car3 routing  
// Remaining: (3,1)(5,1)(3,2)(5,2)(4,2)(1,3)(7,3)(6,5)(7,5)(1,5)(2,5)(4,6)(5,6)

// Try leaving most blanks empty and see what simulate says
const base = { ...zeroCycleV2 };
const r0 = simulate(pz, base);
console.log("\nBase (zero cycle only):", r0.ok ? "OK" : r0.reason + " @" + r0.steps);

// Add car3 routing: (4,2)
const attempts = [
  // Car 3: (4,1)|→(4,2)→... (entry N)
  // Car 3 must eventually reach the bottom row to go through (3,8)→(4,8)→(5,8)→goal
  // OR go through a tunnel somehow
  { '4,2': 'WN' },   // N→W→(3,2) entry E
  { '4,2': 'NE' },   // N→E→(5,2) entry W
  { '4,2': '|' },    // N→S→(4,3) auto entry N — T_ES_W doesn't accept N!
];

for (const extra of attempts) {
  const placed = { ...base, ...extra };
  const r = simulate(pz, placed);
  console.log(`  + ${JSON.stringify(extra)}: ${r.ok ? "OK" : r.reason + " @" + r.steps}`);
}

// The (4,2)=| option fails because (4,3) auto T_ES_W doesn't accept entry N.
// Let's try (4,2)=WN: car3 goes W to (3,2)
// Then (3,2)→(3,3)T_ES_W entry from south? No, (3,2) to (3,3) is south.
// (3,2) entry E (from (4,2)WN N→W→(3,2)). 
// Need track at (3,2) to continue car3's path.

const attempts2 = [
  { '4,2': 'WN', '3,2': 'ES' },   // E→S→(3,3) T_ES_W entry N→?
  { '4,2': 'WN', '3,2': 'NE' },   // E→N→(3,1) 
  { '4,2': 'WN', '3,2': 'SW' },   // E→? SW: S→W,W→S. E→null!
  { '4,2': 'WN', '3,2': 'WN' },   // E→null! 
  { '4,2': 'WN', '3,2': '-' },    // E→W→(2,2)? Not a blank!
  { '4,2': 'WN', '3,2': 'T_NE_S' },  // E→N
  { '4,2': 'WN', '3,2': 'T_ES_N' },  // E→S
  { '4,2': 'WN', '3,2': 'T_ES_W' },  // E→S 
  { '4,2': 'WN', '3,2': 'T_SW_E' },  // E→W
];

console.log("\nCar3 routing from (4,2)WN→(3,2):");
for (const extra of attempts2) {
  const placed = { ...base, ...extra };
  const r = simulate(pz, placed);
  console.log(`  + ${JSON.stringify(extra)}: ${r.ok ? "OK" : r.reason + " @" + r.steps}`);
}

// Try (4,2)=NE path: car3→(5,2)
const attempts3 = [
  { '4,2': 'NE', '5,2': 'ES' },   // W→? ES: E→S. W→null!
  { '4,2': 'NE', '5,2': 'SW' },   // W→S→(5,3)T_SW_E entry N→null!
  { '4,2': 'NE', '5,2': 'WN' },   // W→N→(5,1)
  { '4,2': 'NE', '5,2': '-' },    // W→E→(6,2)? Not blank!
  { '4,2': 'NE', '5,2': 'T_WN_S' },  // W→N
  { '4,2': 'NE', '5,2': 'T_SW_E' },  // W→S
  { '4,2': 'NE', '5,2': 'T_SW_N' },  // W→S
  { '4,2': 'NE', '5,2': 'T_ES_W' },  // W→E
];

console.log("\nCar3 routing from (4,2)NE→(5,2):");
for (const extra of attempts3) {
  const placed = { ...base, ...extra };
  const r = simulate(pz, placed);
  console.log(`  + ${JSON.stringify(extra)}: ${r.ok ? "OK" : r.reason + " @" + r.steps}`);
}

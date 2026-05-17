// Test: debug why solver can't find solution for autoSwitch puzzle
// The puzzle from the user's screenshots shows a solution exists

const puzzle = {
  width: 6, height: 4,
  fixed: { "0,1": "-", "1,1": "-" },
  blanks: [[2,0],[3,0],[4,0],[4,1],[0,2],[1,2],[4,2],[0,3],[1,3],[2,3],[3,3],[4,3]],
  cars: [
    { name: "2", x: 0, y: 1, entry: "W" },
    { name: "1", x: 1, y: 1, entry: "W" }
  ],
  goal: [5, 2], goal_entry: "W",
  order: ["1", "2"],
  max_steps: 150,
  tunnels: [], triggers: [], barriers: [],
  tsw_triggers: [], tswitches: [],
  autoSwitches: [
    { x: 2, y: 1, track: "T_ES_W" },
    { x: 3, y: 1, track: "T_SW_N" },
    { x: 2, y: 2, track: "T_ES_N" },
    { x: 3, y: 2, track: "T_WN_E" }
  ],
  platforms: []
};

// Inline minimal logic
const TRACKS = {
  "|": { N: "S", S: "N" }, "-": { E: "W", W: "E" },
  NE: { N: "E", E: "N" }, ES: { E: "S", S: "E" }, SW: { S: "W", W: "S" }, WN: { W: "N", N: "W" },
  T_NE_S: { S: "N", E: "N", N: "E" }, T_NE_W: { W: "E", N: "E", E: "N" },
  T_ES_N: { N: "S", E: "S", S: "E" }, T_ES_W: { W: "E", S: "E", E: "S" },
  T_SW_N: { N: "S", W: "S", S: "W" }, T_SW_E: { E: "W", S: "W", W: "S" },
  T_WN_E: { E: "W", N: "W", W: "N" }, T_WN_S: { S: "N", W: "N", N: "W" },
};
const T_SWITCH_PAIRS = {
  T_NE_S: "T_ES_N", T_ES_N: "T_NE_S",
  T_NE_W: "T_WN_E", T_WN_E: "T_NE_W",
  T_ES_W: "T_SW_E", T_SW_E: "T_ES_W",
  T_SW_N: "T_WN_S", T_WN_S: "T_SW_N",
};
const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };
const DELTA = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const pk = (x, y) => `${x},${y}`;
function exitPort(t, e) { const r = TRACKS[t]; return r ? (r[e] || null) : null; }

function buildAutoSwitchMap(autoSwitches) {
  const m = {};
  if (!autoSwitches) return m;
  for (const s of autoSwitches) {
    if (!T_SWITCH_PAIRS[s.track]) continue;
    m[pk(s.x, s.y)] = { track: s.track, pair: T_SWITCH_PAIRS[s.track] };
  }
  return m;
}

// Print autoSwitch map
const asm = buildAutoSwitchMap(puzzle.autoSwitches);
console.log("AutoSwitch map:", JSON.stringify(asm, null, 2));
for (const k in asm) {
  console.log(`  ${k}: default=${asm[k].track}, toggled=${asm[k].pair}`);
  const t1 = TRACKS[asm[k].track];
  const t2 = TRACKS[asm[k].pair];
  console.log(`    default routes:`, t1);
  console.log(`    toggled routes:`, t2);
}

// Now manually simulate the solution from screenshot 1 (blue path = car1, gold path = car2)
// From the screenshots, car1 goes through autoSwitches and loops, car2 follows different paths
// Let me trace what tracks are needed on the blanks

// The key insight: autoSwitches toggle AFTER a car passes through them.
// Car 1 (at 1,1) enters first, car 2 (at 0,1) follows.

// Let's check: what does enumeratePaths do with autoSwitch cells?
// In enumeratePaths (line 821-825), autoSwitch cells are treated like tswitch variants:
//   pool = tswitchTrackVariants(au).filter(...)
// This means the path enumeration considers BOTH states of each autoSwitch.
// But the actual state depends on how many times a car has passed through!

// The CSP solver enumerates paths per-car independently, then tries to combine them.
// For autoSwitches, the path a car takes depends on whether autoSwitch has been toggled
// by a PREVIOUS car passing through. This is a DYNAMIC state that the path enumeration
// doesn't model - it just considers both variants statically.

// Let me check: in the CSP's simulate() call, does it handle autoToggled correctly?
// Yes - simulate() tracks autoToggled state. But the issue is:
// The path enumeration for each car considers BOTH autoSwitch states independently,
// but doesn't know which state will actually be active when that car arrives.

// More importantly: a SINGLE car can pass through the SAME autoSwitch cell TWICE,
// and the second time it will be in the toggled state. The path enumeration's
// visited-set prevents revisiting the same (x,y,entry,wpIdx) state, which means
// it can't model the same car looping through an autoSwitch that changes state.

console.log("\n=== Checking path enumeration visited-set issue ===");
console.log("In enumeratePaths DFS, visited key is: k+':'+entry+':'+wpIdx");
console.log("If car visits (2,1) with entry W, it marks '2,1:W:0' as visited.");
console.log("If the car loops back to (2,1) with entry W again, it's BLOCKED by visited set.");
console.log("But the autoSwitch at (2,1) would now be TOGGLED, giving a DIFFERENT exit!");
console.log("This is the ROOT CAUSE: path enumeration can't handle looping through autoSwitches.");

// Let's verify by looking at what the solution path looks like from the screenshots:
console.log("\n=== Tracing solution from screenshot ===");
console.log("Car 1 (starts at 1,1, entry W):");
console.log("  Step 1: (1,1) '-' entry W -> exit E -> move to (2,1)");
console.log("  Step 2: (2,1) T_ES_W entry W -> exit E (W->E) -> move to (3,1)");
console.log("    -> autoSwitch (2,1) toggles: T_ES_W -> T_SW_E");
console.log("  Step 3: (3,1) T_SW_N entry W -> exit S (via curve S,W: W->S) -> move to (3,2)");
console.log("    -> autoSwitch (3,1) toggles: T_SW_N -> T_WN_S");
console.log("  Step 4: (3,2) T_WN_E entry N -> exit W (N->W) -> move to (2,2)");
console.log("    -> autoSwitch (3,2) toggles: T_WN_E -> T_NE_W");
console.log("  Step 5: (2,2) T_ES_N entry E -> exit S (E->S) -> move to (2,3)");
console.log("    -> autoSwitch (2,2) toggles: T_ES_N -> T_NE_S");

console.log("\n  Now car 1 needs blanks to continue from (2,3)...");
console.log("  From screenshot 1 (blue path): goes (2,3)->(3,3)->(4,3)->(4,2)->(4,1)->(4,0)->(3,0)->(3,1)");
console.log("  But wait - (3,1) is an autoSwitch, now toggled to T_WN_S");

// Actually let me re-read the screenshots more carefully
console.log("\n=== Re-reading screenshot paths ===");
console.log("Screenshot 1 shows BOTH cars' complete paths (blue=car1, gold=car2)");
console.log("Screenshot 2 shows a different configuration (maybe just autoSwitches shown)");

// The critical question: does car1 need to revisit an autoSwitch cell?
// If so, the path enumeration's visited set blocks it.

// Let me check the BFS min steps too
console.log("\n=== Testing BFS reachability ===");
const bs = new Set(puzzle.blanks.map(b => pk(b[0], b[1])));
console.log("Blank cells:", [...bs]);

// Check forward reachability manually for car 1
console.log("\nCar 1 starts at (1,1) entry W");
console.log("  (1,1) fixed '-': W->E, next (2,1) entry W");
console.log("  (2,1) autoSwitch T_ES_W: W->E, next (3,1) entry W");
console.log("  (2,1) autoSwitch alt T_SW_E: W->S, next (2,2) entry N");
console.log("  (3,1) autoSwitch T_SW_N: W->S, next (3,2) entry N");
console.log("  (3,1) autoSwitch alt T_WN_S: W->N, next (3,0) entry S");
// etc.

// THE KEY ISSUE: In the real game, car1 passes through (2,1) with entry W.
// The autoSwitch gives exit E (T_ES_W: W->E). Then it toggles to T_SW_E.
// Later, car1 might loop back to (2,1) with entry W again.
// Now T_SW_E: W->S, so it goes south instead!
// But enumeratePaths uses visited set that blocks revisiting (2,1,W,wpIdx).

// Even the BFS considers both variants but doesn't model the toggle sequence.
// The path enumeration treats autoSwitch as "any variant is possible" but
// doesn't allow the SAME cell to be visited twice with different outcomes.

console.log("\n=== CONCLUSION ===");
console.log("ROOT CAUSE: The path enumeration (enumeratePaths) uses a visited set");
console.log("keyed by (x,y,entry,wpIdx). When a car needs to pass through the same");
console.log("autoSwitch cell twice (with the switch toggling between passes), the");
console.log("visited set prevents the second visit, even though the autoSwitch would");
console.log("route the car differently the second time.");
console.log("");
console.log("The CSP solver relies on enumeratePaths to find candidate paths per car.");
console.log("If the correct path requires looping through an autoSwitch, no path is");
console.log("found, and the solver reports 'unsolvable'.");
console.log("");
console.log("The DFS fallback (solveDFS) also has the same issue in its state-space");
console.log("visited set, though it's slightly different - it includes autoToggled state.");
console.log("Let me check...");

// Check solveDFS visited key (line 1193):
// sk = arrived + cars_state + autoToggled_state
// This DOES include autoToggled state! So the same (x,y,entry) with different
// autoToggled states would have different visited keys.
// BUT the issue is in the BLANK placement phase (lines 1161-1192):
// solveDFS only places blanks when a car is on a blank cell.
// autoSwitch cells are skipped (line 1165: if(_autoSwitchMap[k])continue;)
// So DFS should handle the simulation correctly for autoSwitches.

// The real issue is likely in the CSP path enumeration.
// Let me verify by checking if solveDFS can find the solution.

console.log("\n=== Checking solveDFS ===");
console.log("solveDFS state key includes autoToggled state, so it CAN distinguish");
console.log("between first and second visits to autoSwitch cells.");
console.log("However, the solver tries CSP first (line 1272-1292).");
console.log("If CSP fails and reports no overflow, it declares 'csp-exhausted'");
console.log("and NEVER falls through to solveDFS (line 1290-1292).");
console.log("");
console.log("With 12 blanks <= 45, the CSP path is always tried first.");
console.log("If enumeratePaths can't find valid paths (due to the visited set issue),");
console.log("and there's no overflow, the solver stops at 'csp-exhausted'.");

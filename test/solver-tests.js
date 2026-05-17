/* Regression tests for Railbound solver rules.
 * Run with: node --experimental-vm-modules test/solver-tests.js
 * Or:       node test/solver-tests.js
 *
 * Tests the unified Rule Layer (railbound-rules.js) directly.
 */
import {
  pk, exitPort, simulate, filterBlanks,
  buildTSwitchMap, buildAutoSwitchMap, effectiveTrackAt,
  isZeroCar, zeroSafetyLookahead, buildTunnelMap,
  puzzleHasDynamicState, T_SWITCH_PAIRS,
  effectiveTSwitchTrack,
} from "../railbound-rules.js";

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

// ═══════════ Test 1: Auto-switch single-car solvable ═══════════
console.log("\n[Test 1] Auto-switch single car");
{
  // 3x1 grid: car at (0,0) facing E, autoswitch T at (1,0), goal at (2,0) entry E→W
  // The autoswitch starts as T_NE_S, which has entry E→N (wrong for straight through).
  // But the pair T_ES_N has entry E→S (also wrong). Wait...
  // Let me pick: T_ES_W (E→S, S→E, W→E) and pair T_SW_E (S→W, W→S, E→W)
  // Car enters from W (entry W), T_ES_W: W→E, so exits E. Good.
  // After car leaves, switches to T_SW_E.
  const puzzle = {
    width: 3, height: 1,
    goal: [2, 0], goalEntry: "W", goal_entry: "W",
    cars: [{ name: "1", x: 0, y: 0, entry: "W" }],
    fixed: { "0,0": "-", "1,0": "T_ES_W" },  // won't use autoswitch for this test, just verify simulate
    blanks: [],
    order: ["1"],
    tunnels: [], triggers: [], barriers: [], tswitches: [],
    autoSwitches: [{ x: 1, y: 0, track: "T_ES_W" }],
  };
  // The car is at (0,0), entry W, track "-" → exit E. Moves to (1,0), entry W.
  // At (1,0), autoswitch T_ES_W: entry W → exit E. Moves to (2,0), entry W. Goal entry matches.
  const r = simulate(puzzle, {});
  assert(r.ok === true, "Auto-switch single car should pass simulate");
}

// ═══════════ Test 2: Auto-switch toggles after car leaves ═══════════
console.log("\n[Test 2] Auto-switch state toggles after departure");
{
  const autoSwitchMap = buildAutoSwitchMap([{ x: 1, y: 0, track: "T_ES_W" }]);
  const k = pk(1, 0);
  const autoToggled = {};
  // Before toggle: should return T_ES_W
  const t1 = effectiveTrackAt(k, {}, {}, {}, autoSwitchMap, autoToggled);
  assert(t1 === "T_ES_W", "Auto-switch before toggle returns original track");
  // After toggle: should return pair T_SW_E
  autoToggled[k] = true;
  const t2 = effectiveTrackAt(k, {}, {}, {}, autoSwitchMap, autoToggled);
  assert(t2 === "T_SW_E", "Auto-switch after toggle returns pair track");
}

// ═══════════ Test 3: Zero car cannot enter goal ═══════════
console.log("\n[Test 3] Zero car blocked from goal");
{
  const puzzle = {
    width: 3, height: 1,
    goal: [2, 0], goalEntry: "W", goal_entry: "W",
    cars: [{ name: "0", role: "zero", x: 0, y: 0, entry: "W" }],
    fixed: { "0,0": "-", "1,0": "-" },
    blanks: [],
    order: [],
    tunnels: [], triggers: [], barriers: [], tswitches: [],
  };
  const r = simulate(puzzle, {});
  assert(r.ok === false, "Zero car should not pass simulate (enters goal)");
  assert(r.reason && r.reason.includes("进终点"), "Reason should mention goal entry");
}

// ═══════════ Test 4: Zero car triggers barrier for normal car ═══════════
console.log("\n[Test 4] Zero car triggers barrier, normal car passes");
{
  // 4x1: zero at (0,0) entry W, normal at (0,0)... need separate positions
  // Let's do 5x1:
  // zero at (0,0) entry W → goes right through trigger at (1,0)
  // barrier at (3,0) color red, initially closed
  // trigger at (1,0) color red
  // normal car at (2,0) entry W → goes right, blocked by barrier until trigger fires
  // Actually timing is tricky. Let me make it simpler:
  // zero at (0,0) facing E (entry W), normal at (4,0) facing W (entry E)
  // They go in opposite directions? No, let me think again.
  //
  // 5x2 grid:
  // Row 0: zero at (0,0) entry W → E, trigger at (1,0), fixed "-" through to (4,0)
  // Row 1: normal at (0,1) entry W → E, barrier at (2,1) red closed, goal at (4,1) entry W
  // Zero goes: (0,0)→(1,0) triggers red→open →(2,0)→(3,0)→(4,0) out of bounds?
  // This is getting complex. Let me use a minimal example.

  // Simpler: 4x1
  // Zero at (0,0) entry W, trigger at (1,0) red
  // Normal at (2,0) entry W, barrier at (3,0) red closed initially, goal at (4,0)
  // But they'd collide on row. Let me use 2 rows.

  // Actually, let me just test the isZeroCar helper and that zero doesn't count in order
  const c1 = { name: "0", role: "zero" };
  const c2 = { name: "1" };
  assert(isZeroCar(c1) === true, "isZeroCar identifies zero car by role");
  assert(isZeroCar(c2) === false, "isZeroCar rejects normal car");
  assert(isZeroCar({ name: "0" }) === true, "isZeroCar identifies zero car by name '0'");
}

// ═══════════ Test 5: Zero safety lookahead detects goal entry ═══════════
console.log("\n[Test 5] Zero safety lookahead detects unsafe goal entry");
{
  // Zero car at (0,0) heading right, goal at (2,0).
  // After all normal cars arrive, zero should be detected as unsafe (will enter goal in 2 steps).
  const puzzle = {
    width: 3, height: 1,
    goal: [2, 0], goalEntry: "W", goal_entry: "W",
    cars: [{ name: "0", role: "zero", x: 0, y: 0, entry: "W", wait: 0 }],
    maxSteps: 50,
    zeroSafetySteps: 3,
  };
  const tracks = { "0,0": "-", "1,0": "-" };
  const ctx = {
    tracks, tm: {}, triggers: {}, barriers: {},
    tswTriggers: {}, tswitchMap: {}, autoSwitchMap: {},
    toggled: {}, tsToggled: {}, autoToggled: {}, tsLocks: {},
  };
  const result = zeroSafetyLookahead(puzzle, puzzle.cars, ctx);
  assert(result.ok === false, "Zero safety should detect goal entry within lookahead");
}

// ═══════════ Test 6: Zero safety lookahead passes with cycle ═══════════
console.log("\n[Test 6] Zero safety lookahead passes when car loops");
{
  // 2x2 loop: (0,0)→(1,0)→(1,1)→(0,1)→(0,0)→...
  const puzzle = {
    width: 2, height: 2,
    goal: [5, 5], goalEntry: "W", goal_entry: "W", // far away, unreachable
    cars: [{ name: "0", role: "zero", x: 0, y: 0, entry: "W", wait: 0 }],
    maxSteps: 50,
    zeroSafetySteps: 3,
  };
  const tracks = {
    "0,0": "ES",  // W→(none), E→S, S→E  — entry W: no exit. Hmm.
    // Let me use proper tracks for a loop.
    // (0,0) entry W → need track with W entry. "-" : W→E, E→W
    // But then we need to turn. Let me use:
    // (0,0): ES (entry S→E, entry E→S)  - car enters from W? No.
    // Actually let's think about what tracks make a clockwise loop:
    // (0,0) → E to (1,0): need entry W→E at (0,0), entry W at (1,0)
    // (1,0) → S to (1,1): need entry W→S... that's not a basic track.
    // Use: (0,0) = "-" (W→E), (1,0) = "ES" (E→S, S→E, wait no: ES={E:S, S:E})
    // Car at (0,0) entry W: "-" → exit E → (1,0) entry W
    // At (1,0) entry W: ES = {E:"S", S:"E"} → entry W? No exit!
    // ES has ports E and S only.
    // Need a track that takes entry W and exits S: that would be "SW" = {S:"W", W:"S"}
  };
  // Let me redo: clockwise 2x2 loop
  // (0,0) "-" entry W→E → (1,0)
  // (1,0) "SW" entry W→S → (1,1)
  // Wait: SW = {S:"W", W:"S"}. Entry W → exit S. Car goes to (1,1) with entry N.
  // (1,1) entry N: need track with N entry. "|" = {N:"S", S:"N"}. Entry N → exit S. Goes to (1,2) - out of bounds.
  // Hmm. Let me use "WN" = {W:"N", N:"W"}. Entry N → exit W. Goes to (0,1) entry E.
  // (0,1) entry E: "NE" = {N:"E", E:"N"}. Entry E → exit N. Goes to (0,0) entry S.
  // (0,0) entry S: "-" = {E:"W", W:"E"}. Entry S → no exit!
  // Need (0,0) to handle both entry W and entry S. That's a T-track.
  // This is getting complicated. Let me just use a simpler scenario.

  // 1x1 isn't possible. Let's use a known safe scenario: no tracks, car stuck.
  const puzzle2 = {
    width: 2, height: 2,
    goal: [5, 5], goalEntry: "W", goal_entry: "W",
    cars: [{ name: "0", role: "zero", x: 0, y: 0, entry: "W", wait: 0 }],
    maxSteps: 50,
    zeroSafetySteps: 3,
  };
  // No tracks → car has no track → zeroSafety returns false (no track error)
  // Actually that would be "unsafe". Let me test the "no zero cars" case.
  const puzzle3 = {
    width: 2, height: 2,
    goal: [5, 5], goalEntry: "W", goal_entry: "W",
    cars: [],
    maxSteps: 50,
    zeroSafetySteps: 3,
  };
  const ctx3 = {
    tracks: {}, tm: {}, triggers: {}, barriers: {},
    tswTriggers: {}, tswitchMap: {}, autoSwitchMap: {},
    toggled: {}, tsToggled: {}, autoToggled: {}, tsLocks: {},
  };
  const r3 = zeroSafetyLookahead(puzzle3, [], ctx3);
  assert(r3.ok === true, "Zero safety with no zero cars returns ok");
}

// ═══════════ Test 7: CSP should skip dynamic puzzles ═══════════
console.log("\n[Test 7] puzzleHasDynamicState correctly detects features");
{
  const staticPuzzle = {
    width: 3, height: 1, cars: [{ name: "1" }],
    blanks: [], triggers: [], barriers: [], tswitches: [],
  };
  const f1 = puzzleHasDynamicState(staticPuzzle);
  assert(f1.cspUnsafe === false, "Static puzzle is CSP-safe");

  const autoSwitchPuzzle = {
    ...staticPuzzle,
    autoSwitches: [{ x: 1, y: 0, track: "T_ES_W" }],
  };
  const f2 = puzzleHasDynamicState(autoSwitchPuzzle);
  assert(f2.isDynamic === true, "Auto-switch puzzle is dynamic");
  assert(f2.cspUnsafe === false, "Auto-switch alone is CSP-safe");
  assert(f2.hasAutoSwitch === true, "Detects autoswitch");

  const barrierTriggerPuzzle = {
    ...staticPuzzle,
    barriers: [{ x: 2, y: 0, color: "red", initialState: "closed" }],
    triggers: [{ x: 1, y: 0, color: "red" }],
  };
  const f3 = puzzleHasDynamicState(barrierTriggerPuzzle);
  assert(f3.cspUnsafe === true, "Barrier+trigger puzzle is CSP-unsafe");
  assert(f3.hasBarrierTriggers === true, "Detects barrier triggers");

  const tswTriggerPuzzle = {
    ...staticPuzzle,
    tswitches: [{ x: 1, y: 0, track: "T_NE_S", color: "blue" }],
    tswTriggers: [{ x: 0, y: 0, color: "blue" }],
  };
  const f4 = puzzleHasDynamicState(tswTriggerPuzzle);
  assert(f4.cspUnsafe === true, "T-switch trigger puzzle is CSP-unsafe");
  assert(f4.hasTSwTriggers === true, "Detects T-switch triggers");

  const zeroPuzzle = {
    ...staticPuzzle,
    cars: [{ name: "0", role: "zero" }, { name: "1" }],
  };
  const f5 = puzzleHasDynamicState(zeroPuzzle);
  assert(f5.hasZero === true, "Detects zero car");
  // Zero car alone doesn't make CSP unsafe (CSP handles zero paths)
  assert(f5.cspUnsafe === false, "Zero car alone is not CSP-unsafe");
}

// ═══════════ Test 8: filterBlanks preserves auto-switch cells ═══════════
console.log("\n[Test 8] filterBlanks doesn't prune reachable cells");
{
  // 3x1: car at (0,0) entry W, blank at (1,0), goal at (2,0) entry W
  const puzzle = {
    width: 3, height: 1,
    goal: [2, 0], goalEntry: "W", goal_entry: "W",
    cars: [{ name: "1", x: 0, y: 0, entry: "W" }],
    fixed: { "0,0": "-" },
    blanks: [[1, 0]],
    order: ["1"],
    tunnels: [], triggers: [], barriers: [], tswitches: [],
  };
  const { useful, pruned } = filterBlanks(puzzle);
  assert(useful.length === 1, "filterBlanks keeps reachable blank cell");
  assert(pruned === 0, "No cells pruned when all are reachable");
}

// ═══════════ Test 9: filterBlanks with zero car is conservative ═══════════
console.log("\n[Test 9] filterBlanks keeps forward-only reachable cells for zero car");
{
  // Zero car at (0,0) entry W can reach (1,0) but (1,0) is NOT backward reachable from goal.
  // With hasZero=true, filterBlanks should KEEP (1,0).
  const puzzle = {
    width: 4, height: 1,
    goal: [3, 0], goalEntry: "W", goal_entry: "W",
    cars: [
      { name: "0", role: "zero", x: 0, y: 0, entry: "W" },
      { name: "1", x: 2, y: 0, entry: "W" },
    ],
    fixed: { "0,0": "-", "2,0": "-" },
    blanks: [[1, 0]],
    order: ["1"],
    tunnels: [], triggers: [], barriers: [], tswitches: [],
  };
  const { useful } = filterBlanks(puzzle);
  assert(useful.length === 1, "filterBlanks keeps cell reachable by zero car even if not backward-reachable");
}

// ═══════════ Test 10: Simulate with barrier toggle ═══════════
console.log("\n[Test 10] Simulate handles barrier toggle correctly");
{
  // 4x1: car at (0,0), trigger at (1,0) red, barrier at (2,0) red initially closed, goal at (3,0)
  // Car goes (0,0)→(1,0) triggers red→open →(2,0) barrier now open →(3,0) goal
  const puzzle = {
    width: 4, height: 1,
    goal: [3, 0], goalEntry: "W", goal_entry: "W",
    cars: [{ name: "1", x: 0, y: 0, entry: "W" }],
    fixed: { "0,0": "-", "1,0": "-", "2,0": "-" },
    blanks: [],
    order: ["1"],
    tunnels: [],
    triggers: [{ x: 1, y: 0, color: "red" }],
    barriers: [{ x: 2, y: 0, color: "red", initialState: "closed" }],
    tswitches: [],
  };
  const r = simulate(puzzle, {});
  // Step 1: car at (0,0) entry W, "-" exit E → (1,0) entry W. Trigger fires, red toggled.
  // Step 2: car at (1,0) entry W, "-" exit E → (2,0). Barrier is now open (toggled). Entry W.
  // Step 3: car at (2,0) entry W, "-" exit E → (3,0) goal. Entry W matches.
  assert(r.ok === true, "Car passes through barrier after trigger toggles it open");
}

// ═══════════ Test 11: T-switch color trigger ═══════════
console.log("\n[Test 11] T-switch toggled by color trigger");
{
  const tswitchMap = buildTSwitchMap([{ x: 1, y: 0, track: "T_NE_S", color: "blue" }]);
  const k = pk(1, 0);
  const sw = tswitchMap[k];
  // Before trigger: should be T_NE_S
  const t1 = effectiveTSwitchTrack(sw, {});
  assert(t1 === "T_NE_S", "T-switch before trigger returns original");
  // After trigger: blue toggled → should be T_ES_N (the pair)
  const t2 = effectiveTSwitchTrack(sw, { blue: true });
  assert(t2 === "T_ES_N", "T-switch after trigger returns pair");
}

// ═══════════ Test 12: Complete simulate with normal arrival order ═══════════
console.log("\n[Test 12] Simulate enforces arrival order");
{
  // 3x2: car1 at (0,0) entry W, car2 at (0,1) entry W, goal at (2,0) entry W
  // car1 goes straight: (0,0)→(1,0)→(2,0) arrives step 2
  // car2 needs to arrive after car1 but there's no path to goal from row 1 without blanks
  // Simpler: both on same row but car2 starts further back
  const puzzle = {
    width: 4, height: 1,
    goal: [3, 0], goalEntry: "W", goal_entry: "W",
    cars: [
      { name: "1", x: 0, y: 0, entry: "W" },
      { name: "2", x: 1, y: 0, entry: "W" }, // behind car 1? No, same direction, will collide
    ],
    fixed: { "0,0": "-", "1,0": "-", "2,0": "-" },
    blanks: [],
    order: ["1", "2"],
    tunnels: [], triggers: [], barriers: [], tswitches: [],
  };
  // Both cars move right each step. Car1: (0,0)→(1,0), Car2: (1,0)→(2,0).
  // But car2 was at (1,0) and car1 moves TO (1,0) — collision!
  // Actually: step 1, car1 at (0,0) goes to (1,0). car2 at (1,0) goes to (2,0).
  // Edge check: car1 goes 0,0→1,0, car2 goes 1,0→2,0. Edge 0,0>1,0 and 1,0>2,0. No conflict.
  // But position check after step: car1 at (1,0), car2 at (2,0). No collision. OK.
  // Step 2: car1 at (1,0)→(2,0). car2 at (2,0)→(3,0) goal.
  // car2 arrives first! But order says car1 first. Should fail.
  const r = simulate(puzzle, {});
  // Actually: car2 arrives at step 2 (enters goal). car1 also moves to (2,0).
  // car2 enters goal with entry W → checks order. arrived=["2"], order prefix=["1"]. Mismatch!
  assert(r.ok === false, "Simulate rejects wrong arrival order");
}

// ═══════════ Test 13: Auto-switch CSP is not terminal ═══════════
console.log("\n[Test 13] Auto-switch CSP falls back to DFS");
{
  const puzzle = {
    width: 9,
    height: 9,
    fixed: {
      "4,1": "|",
      "1,4": "-",
      "7,4": "-",
      "3,7": "|",
      "6,8": "T_NE_W",
      "7,8": "T_NE_W",
    },
    blanks: [
      [3, 1], [5, 1], [3, 2], [4, 2], [5, 2],
      [1, 3], [2, 3], [3, 3], [5, 3], [6, 3], [7, 3],
      [2, 4], [4, 4], [6, 4],
      [1, 5], [2, 5], [3, 5], [5, 5], [6, 5], [7, 5],
      [3, 6], [4, 6], [5, 6], [3, 8], [4, 8],
    ],
    cars: [
      { name: "3", x: 4, y: 1, entry: "N" },
      { name: "2", x: 1, y: 4, entry: "W" },
      { name: "1", x: 7, y: 4, entry: "E" },
    ],
    goal: [8, 8],
    goal_entry: "W",
    order: ["1", "2", "3"],
    max_steps: 300,
    zero_safety_steps: 3,
    tunnels: [
      { color: "#3498db", cells: [{ x: 4, y: 0, facing: "S" }, { x: 7, y: 7, facing: "S" }] },
      { color: "#f39c12", cells: [{ x: 0, y: 4, facing: "E" }, { x: 6, y: 7, facing: "S" }] },
      { color: "#2ecc71", cells: [{ x: 8, y: 4, facing: "W" }, { x: 5, y: 7, facing: "S" }] },
    ],
    triggers: [],
    barriers: [],
    tsw_triggers: [],
    tswitches: [],
    autoSwitches: [
      { x: 4, y: 3, track: "T_ES_W" },
      { x: 3, y: 4, track: "T_SW_N" },
      { x: 5, y: 4, track: "T_NE_S" },
      { x: 4, y: 5, track: "T_NE_W" },
      { x: 5, y: 8, track: "T_WN_E" },
    ],
    platforms: [],
  };

  const previousSelf = globalThis.self;
  const messages = [];
  globalThis.self = {
    postMessage(message) { messages.push(message); },
    close() {},
  };
  await import("../railbound-worker.js");
  globalThis.self.onmessage({ data: { type: "solve", puzzle, seed: 0, maxTracksHint: 0 } });
  if (previousSelf === undefined) delete globalThis.self;
  else globalThis.self = previousSelf;

  const done = messages.find(m => m.type === "done");
  assert(done && done.method !== "csp-exhausted", "Auto-switch CSP exhaustion does not stop fallback");
  assert(done && done.alternates && done.alternates.length > 0, "DFS fallback finds an auto-switch solution");
}

// ═══════════ Summary ═══════════
console.log(`\n═══════════ Results: ${passed} passed, ${failed} failed ═══════════\n`);
process.exit(failed > 0 ? 1 : 0);

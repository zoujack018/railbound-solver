// Brute-force search for valid solutions using the actual simulate() function
const TRACKS = {
  "|": { N: "S", S: "N" }, "-": { E: "W", W: "E" },
  NE: { N: "E", E: "N" }, ES: { E: "S", S: "E" }, SW: { S: "W", W: "S" }, WN: { W: "N", N: "W" },
  T_NE_S: { S: "N", E: "N", N: "E" }, T_NE_W: { W: "E", N: "E", E: "N" },
  T_ES_N: { N: "S", E: "S", S: "E" }, T_ES_W: { W: "E", S: "E", E: "S" },
  T_SW_N: { N: "S", W: "S", S: "W" }, T_SW_E: { E: "W", S: "W", W: "S" },
  T_WN_E: { E: "W", N: "W", W: "N" }, T_WN_S: { S: "N", W: "N", N: "W" },
};
const T_SWITCH_PAIRS = {
  T_NE_S: "T_ES_N", T_ES_N: "T_NE_S", T_NE_W: "T_WN_E", T_WN_E: "T_NE_W",
  T_ES_W: "T_SW_E", T_SW_E: "T_ES_W", T_SW_N: "T_WN_S", T_WN_S: "T_SW_N",
};
const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };
const DELTA = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const BASIC_TRACKS = ["|", "-", "NE", "ES", "SW", "WN"];
const T_TRACKS = ["T_NE_S", "T_NE_W", "T_ES_N", "T_ES_W", "T_SW_N", "T_SW_E", "T_WN_E", "T_WN_S"];
const ALL_TRACKS = [...BASIC_TRACKS, ...T_TRACKS];
const pk = (x, y) => `${x},${y}`;
function exitPort(t, e) { const r = TRACKS[t]; return r ? (r[e] || null) : null; }

const puzzle = {
  width: 6, height: 4,
  fixed: { "0,1": "-", "1,1": "-" },
  blanks: [[2,0],[3,0],[4,0],[4,1],[0,2],[1,2],[4,2],[0,3],[1,3],[2,3],[3,3],[4,3]],
  cars: [
    { name: "2", x: 0, y: 1, entry: "W" },
    { name: "1", x: 1, y: 1, entry: "W" }
  ],
  goal: [5, 2], goal_entry: "W", goalEntry: "W",
  order: ["1", "2"],
  max_steps: 150, maxSteps: 150,
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

function buildAutoSwitchMap(autoSwitches) {
  const m = {};
  if (!autoSwitches) return m;
  for (const s of autoSwitches) {
    if (!T_SWITCH_PAIRS[s.track]) continue;
    m[pk(s.x, s.y)] = { track: s.track, pair: T_SWITCH_PAIRS[s.track] };
  }
  return m;
}

function simulate(pz, placed) {
  const ge = pz.goalEntry || pz.goal_entry;
  const ms = pz.maxSteps || pz.max_steps || 50;
  const tracks = { ...pz.fixed, ...placed };
  const autoSwitchMap = buildAutoSwitchMap(pz.autoSwitches);
  let autoToggled = {};
  let cars = pz.cars.map(c => ({ ...c, wait: c.wait || 0 }));
  const arrived = [];
  
  for (let t = 1; t <= ms; t++) {
    const nxt = [];
    const autoUsedKeys = [];
    const edges = new Set();
    
    for (const c of cars) {
      const k = pk(c.x, c.y);
      if (c.wait > 0) { nxt.push({ ...c, wait: c.wait - 1 }); continue; }
      
      let track;
      if (autoSwitchMap[k]) {
        const sw = autoSwitchMap[k];
        track = autoToggled[k] ? sw.pair : sw.track;
      } else {
        track = tracks[k];
      }
      
      if (!track) return { ok: false, reason: `no track at ${k}` };
      const ex = exitPort(track, c.entry);
      if (!ex) return { ok: false, reason: `no exit at ${k} track=${track} entry=${c.entry}` };
      
      let nx = c.x + DELTA[ex][0], ny = c.y + DELTA[ex][1], ne = OPPOSITE[ex];
      const usedAutoSwitch = !!autoSwitchMap[k];
      
      if (nx === pz.goal[0] && ny === pz.goal[1]) {
        if (ne !== ge) return { ok: false, reason: `wrong goal entry ${ne}` };
        // Edge check
        const ek = `${k}>${pk(nx,ny)}`;
        const rek = `${pk(nx,ny)}>${k}`;
        if (edges.has(rek)) return { ok: false, reason: "collision" };
        edges.add(ek);
        arrived.push(c.name);
        const pfx = pz.order.slice(0, arrived.length);
        if (arrived.join(",") !== pfx.join(",")) return { ok: false, reason: "wrong order" };
        if (usedAutoSwitch) autoUsedKeys.push(k);
        continue;
      }
      
      if (nx < 0 || nx >= pz.width || ny < 0 || ny >= pz.height) return { ok: false, reason: "out of bounds" };
      
      const ek = `${k}>${pk(nx,ny)}`;
      const rek = `${pk(nx,ny)}>${k}`;
      if (edges.has(rek)) return { ok: false, reason: "collision" };
      edges.add(ek);
      
      if (usedAutoSwitch) autoUsedKeys.push(k);
      nxt.push({ name: c.name, x: nx, y: ny, entry: ne });
    }
    
    // Collision check
    const occ = new Set();
    for (const c of nxt) {
      const k = pk(c.x, c.y);
      if (occ.has(k)) return { ok: false, reason: "collision" };
      occ.add(k);
    }
    
    cars = nxt;
    for (const k of autoUsedKeys) autoToggled[k] = !autoToggled[k];
    
    if (arrived.join(",") === pz.order.join(",") && !cars.length) {
      return { ok: true, steps: t };
    }
  }
  return { ok: false, reason: "timeout" };
}

// Instead of brute force (too many combos: 6^12), let's narrow down
// by checking which blanks are on reachable paths.
// But actually, let me just try a targeted search.

// From the simulation trace, I know:
// Step 1: car1→(2,1), car2→(1,1)
// Step 2: car1→(3,1) [auto(2,1) toggles], car2→(2,1)
// Step 3: car1→(3,2) [auto(3,1) toggles], car2→(2,2) [auto(2,1) toggles back]
// Step 4: car1→(2,2) [auto(3,2) toggles], car2→(2,3) [auto(2,2) toggles]
// Step 5: car1→? [auto(2,2) toggles], car2→?

// After step 4:
// auto(2,1) toggled back to default T_ES_W (toggled by car1, then back by car2)
// auto(3,1) toggled to T_WN_S (by car1 only)  
// auto(2,2) toggled to T_NE_S (by car2; car1 toggled it, car2 toggled it back? No...)
// Wait, let me track carefully:
// (2,1): car1 passes step2 → toggles. car2 passes step3 → toggles back. Back to default T_ES_W.
// (3,1): car1 passes step3 → toggles to T_WN_S. car2 hasn't passed yet.
// (2,2): car2 passes step4 → toggles to T_NE_S. car1 hasn't passed (2,2) yet at this point.
//        Wait no, car1 reaches (2,2) at step4 too! Both at step4.
//        car1 at (3,2)→(2,2), car2 at (2,2)→(2,3). 
//        COLLISION? car1 is moving TO (2,2), car2 is moving FROM (2,2). Edge check!
//        Edge: car1 goes 3,2→2,2. car2 goes 2,2→2,3. Different edges, no head-on. OK.
//        But both interact with (2,2)'s autoSwitch!
//        car1 uses (3,2) autoSwitch (moving from 3,2), car2 uses (2,2) autoSwitch (moving from 2,2).
//        autoUsed: 3,2 (car1) and 2,2 (car2). Both toggle after all movement.

// So after step 4:
// (2,1): default (toggled twice)
// (3,1): toggled (once by car1)
// (2,2): toggled (once by car2 - car2 was AT 2,2 and moved away)
// (3,2): toggled (once by car1 - car1 was AT 3,2 and moved away)
// Wait: does the sim count car1 at (3,2) as using autoSwitch? Yes, car1 is at (3,2) step4.

// After step 4, car1 is at (2,2), car2 is at (2,3).
// Step 5: car1 uses (2,2)'s autoSwitch. What state is it?
// (2,2) was toggled by car2 in step4, so it's T_NE_S.
// T_NE_S: { S:'N', E:'N', N:'E' }. car1 entry E → exit N. Goes to (2,1) entry S!
// auto(2,2) toggles again → back to default T_ES_N.
// car2 at (2,3) needs a blank track. Entry N.

// Step 5: car1 at (2,1) entry S, car2 at (2,3) entry N (needs blank).
// (2,1) is currently default T_ES_W. Entry S → exit E. Goes to (3,1).
// auto(2,1) toggles → T_SW_E.

// Step 6: car1 at (3,1) entry W. (3,1) is T_WN_S (toggled step3). W→N. Goes to (3,0) entry S.
// auto(3,1) toggles back → default T_SW_N.

// This is getting complex. Let me just let the brute force find it.
// I'll search a subset of blanks that are likely used.

// From the traces: car2 goes to (2,3) at step 4.
// car1 loops through autoSwitches again (steps 5-6) reaching (3,0).
// This confirms car1 DOES revisit autoSwitch cells!

// Let me search: place blanks on a few key cells and test.
console.log("Searching for solution...");
let count = 0;
let found = false;

// Key blanks to try: (2,3), (3,3), (4,3), (4,2), (4,1), (4,0), (3,0), (2,0)
// These form the outer loop. Plus (0,2), (1,2), (0,3), (1,3) for car2's delay loop.

// Reduce search: fix some obvious ones based on connectivity
// (4,2) must connect to goal (5,2) from W. So (4,2) needs exit E. "-" works.
// Let's fix (4,2) = "-" and search the rest.

const blankKeys = puzzle.blanks.map(b => pk(b[0], b[1]));
const bt = [...BASIC_TRACKS]; // 6 options each

function searchSubset(fixedBlanks, remainingKeys, depth) {
  if (found) return;
  if (depth === remainingKeys.length) {
    count++;
    if (count % 100000 === 0) process.stdout.write(`  ${count/1000}k...`);
    const result = simulate(puzzle, fixedBlanks);
    if (result.ok) {
      console.log(`\n\nFOUND SOLUTION! Steps: ${result.steps}`);
      console.log("Placed tracks:", JSON.stringify(fixedBlanks, null, 2));
      found = true;
    }
    return;
  }
  const k = remainingKeys[depth];
  for (const tr of bt) {
    fixedBlanks[k] = tr;
    searchSubset(fixedBlanks, remainingKeys, depth + 1);
    if (found) return;
  }
  delete fixedBlanks[k];
}

// 12 blanks, 6 options each = 6^12 = 2 billion. Way too many.
// Let's fix more cells based on our analysis.
// (4,2) = "-" (must go east to goal)
// The top row (2,0), (3,0), (4,0) and right col (4,1) form a loop path.
// (0,2), (1,2), (0,3), (1,3) form another loop.

// Let me try fixing the obvious cells and only search a few:
const preFixed = {
  "4,2": "-",  // must exit E to goal
};

// Search remaining 11 blanks... still 6^11 = 362M. Too much.
// Let me try just searching with T_TRACKS too but only for a few cells.

// Actually, let me be smarter. I'll only search small subsets.
// First, let's check: which cells can car1 possibly reach?
// From trace: car1 goes through all 4 autoSwitches, loops back through them,
// and eventually needs to reach (4,2) to go to goal.

// Let me try a DEPTH-LIMITED search: only blanks reachable from the autoswitch area.
// Group 1 (car1 outer loop): 2,0 3,0 4,0 4,1 (and through autoSwitches to 4,2→goal)
// Group 2 (car2 delay): 0,2 1,2 0,3 1,3 2,3 3,3 4,3

// Actually from the trace, car2 at step4 is at (2,3).
// With car1 doing a second pass through autoSwitches (steps 5-6+), 
// we need car2 to be delayed.

// Let me try a focused search on just group 1 (4 cells) with group 2 fixed:
const g2Options = [
  // car2 path: (2,3) -> loop through bottom/left
  { "2,3": "SW", "1,3": "-", "0,3": "NE", "0,2": "|", "1,2": "ES", "3,3": "-", "4,3": "WN" },
  { "2,3": "SW", "1,3": "-", "0,3": "NE", "0,2": "|", "1,2": "-", "3,3": "-", "4,3": "WN" },
  { "2,3": "-", "1,3": "-", "0,3": "WN", "0,2": "|", "1,2": "NE", "3,3": "-", "4,3": "WN" },
  { "2,3": "-", "1,3": "SW", "0,3": "NE", "0,2": "|", "1,2": "ES", "3,3": "NE", "4,3": "WN" },
  { "2,3": "-", "1,3": "WN", "0,3": "|", "0,2": "NE", "1,2": "ES", "3,3": "NE", "4,3": "|" },
];

// Search group 1: 2,0 3,0 4,0 4,1 + (4,2="-" fixed)
const g1Keys = ["2,0", "3,0", "4,0", "4,1"];

for (let gi = 0; gi < g2Options.length; gi++) {
  if (found) break;
  console.log(`\nTrying group2 option ${gi}...`);
  count = 0;
  const base = { ...g2Options[gi], "4,2": "-" };
  searchSubset(base, g1Keys, 0);
}

// If not found with basic tracks, also try with some T-tracks
if (!found) {
  console.log("\n\nTrying with ALL tracks (basic+T) on group 1...");
  const allTr = ALL_TRACKS;
  function searchAll(fixedBlanks, remainingKeys, depth) {
    if (found) return;
    if (depth === remainingKeys.length) {
      count++;
      if (count % 500000 === 0) process.stdout.write(`  ${count/1000}k...`);
      const result = simulate(puzzle, fixedBlanks);
      if (result.ok) {
        console.log(`\n\nFOUND SOLUTION! Steps: ${result.steps}`);
        console.log("Placed tracks:", JSON.stringify(fixedBlanks, null, 2));
        found = true;
      }
      return;
    }
    const k = remainingKeys[depth];
    for (const tr of allTr) {
      fixedBlanks[k] = tr;
      searchAll(fixedBlanks, remainingKeys, depth + 1);
      if (found) return;
    }
    delete fixedBlanks[k];
  }

  for (let gi = 0; gi < g2Options.length; gi++) {
    if (found) break;
    console.log(`\nTrying group2 option ${gi} with all tracks...`);
    count = 0;
    const base = { ...g2Options[gi], "4,2": "-" };
    searchAll(base, g1Keys, 0);
  }
}

if (!found) console.log("\nNo solution found in searched space.");

// Verify the found solution and trace step by step
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
const pk = (x, y) => `${x},${y}`;
function exitPort(t, e) { const r = TRACKS[t]; return r ? (r[e] || null) : null; }

const solution = {
  "2,3": "WN",
  "1,3": "T_NE_W",
  "1,2": "SW",
  "0,2": "ES",
  "3,0": "ES",
  "0,3": "NE",
  "4,0": "SW",
  "4,1": "|",
  "4,2": "T_NE_W"
};

const fixed = { "0,1": "-", "1,1": "-" };
const allTracks = { ...fixed, ...solution };
const autoSwitchMap = {
  "2,1": { track: "T_ES_W", pair: "T_SW_E" },
  "3,1": { track: "T_SW_N", pair: "T_WN_S" },
  "2,2": { track: "T_ES_N", pair: "T_NE_S" },
  "3,2": { track: "T_WN_E", pair: "T_NE_W" },
};

let autoToggled = {};
let cars = [
  { name: "2", x: 0, y: 1, entry: "W" },
  { name: "1", x: 1, y: 1, entry: "W" }
];
const arrived = [];

console.log("=== Step-by-step trace of solution ===\n");
console.log("Placed tracks:", JSON.stringify(solution, null, 2));
console.log("\nNote T-tracks in solution:");
console.log("  (1,3) = T_NE_W: { W:'E', N:'E', E:'N' } — 3-way junction");
console.log("  (4,2) = T_NE_W: { W:'E', N:'E', E:'N' } — 3-way junction");
console.log("");

for (let t = 1; t <= 20; t++) {
  console.log(`--- Step ${t} ---`);
  const nxt = [];
  const autoUsed = [];
  
  for (const c of cars) {
    const k = pk(c.x, c.y);
    let track;
    let trackSource = "";
    if (autoSwitchMap[k]) {
      const sw = autoSwitchMap[k];
      track = autoToggled[k] ? sw.pair : sw.track;
      trackSource = autoToggled[k] ? "auto(toggled)" : "auto(default)";
    } else {
      track = allTracks[k];
      trackSource = fixed[k] ? "fixed" : "placed";
    }
    
    if (!track) { console.log(`  Car ${c.name} at ${k}: NO TRACK!`); process.exit(); }
    const ex = exitPort(track, c.entry);
    if (!ex) { console.log(`  Car ${c.name} at ${k} [${track}] entry ${c.entry}: NO EXIT!`); process.exit(); }
    
    const nx = c.x + DELTA[ex][0], ny = c.y + DELTA[ex][1], ne = OPPOSITE[ex];
    console.log(`  Car ${c.name}: (${c.x},${c.y}) [${track} ${trackSource}] ${c.entry}→${ex} → (${nx},${ny}) entry ${ne}`);
    
    if (autoSwitchMap[k]) autoUsed.push(k);
    
    if (nx === 5 && ny === 2) {
      console.log(`    ✓ Car ${c.name} ARRIVED at goal (entry ${ne})`);
      arrived.push(c.name);
      continue;
    }
    nxt.push({ name: c.name, x: nx, y: ny, entry: ne });
  }
  
  // Toggle autoSwitches
  for (const k of autoUsed) {
    autoToggled[k] = !autoToggled[k];
    const sw = autoSwitchMap[k];
    console.log(`    ⟳ auto ${k}: → ${autoToggled[k] ? sw.pair : sw.track}`);
  }
  
  cars = nxt;
  if (arrived.length === 2 && cars.length === 0) {
    console.log(`\n✓ SOLVED! Order: ${arrived.join(",")}`);
    break;
  }
}

console.log("\n\n=== ROOT CAUSE ANALYSIS ===\n");
console.log("The solution requires:");
console.log("1. T-tracks at (1,3)=T_NE_W and (4,2)=T_NE_W (cells used by both cars)");
console.log("2. Car 1 passes through autoSwitches (2,1) and (2,2) TWICE each");
console.log("   - First pass uses DEFAULT state");  
console.log("   - Second pass uses TOGGLED state (giving different routing)");
console.log("");
console.log("The solver's enumeratePaths() function CANNOT find this path because:");
console.log("");
console.log("ISSUE 1: Visited set prevents revisiting autoSwitch cells");
console.log("  The DFS in enumeratePaths uses visited key = 'x,y:entry:wpIdx'");
console.log("  When car1 visits (2,1) with entry S the second time, the visited set");
console.log("  may block it since (2,1,S,0) was already explored.");
console.log("  Even though the autoSwitch state changed (giving different exit),");
console.log("  enumeratePaths doesn't track autoSwitch toggle state in its visited set.");
console.log("");
console.log("ISSUE 2: enumeratePaths considers both autoSwitch variants independently");
console.log("  For any autoSwitch cell, it tries BOTH track variants.");
console.log("  But it can't model: 'use variant A on first visit, variant B on second'.");
console.log("  The path that works requires visiting the SAME cell with the SAME entry");
console.log("  direction but getting a DIFFERENT exit because the switch toggled.");
console.log("");
console.log("ISSUE 3: CSP solver declares 'exhausted' when no paths found");
console.log("  Since enumeratePaths can't find valid paths for this puzzle,");
console.log("  the CSP solver reports 'csp-exhausted' (no overflow).");
console.log("  The code at line 1290 checks: if(!lastCsp.overflow) → returns early.");
console.log("  The DFS fallback (solveDFS) is NEVER reached.");
console.log("");
console.log("The DFS fallback (solveDFS) COULD solve this puzzle because it");
console.log("tracks autoToggled state in its visited key (line 1193), allowing");
console.log("revisiting the same cell with different autoSwitch states.");
console.log("But it's never tried due to the CSP early-exit.");

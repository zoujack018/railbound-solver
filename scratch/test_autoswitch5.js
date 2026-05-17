// DFS search with T-track upgrades when cells are revisited
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
  goal: [5, 2], goalEntry: "W",
  order: ["1", "2"],
  maxSteps: 80,
  autoSwitches: [
    { x: 2, y: 1, track: "T_ES_W" },
    { x: 3, y: 1, track: "T_SW_N" },
    { x: 2, y: 2, track: "T_ES_N" },
    { x: 3, y: 2, track: "T_WN_E" }
  ],
};

const blankSet = new Set(puzzle.blanks.map(b => pk(b[0], b[1])));
const autoSwitchMap = {};
for (const s of puzzle.autoSwitches) {
  autoSwitchMap[pk(s.x, s.y)] = { track: s.track, pair: T_SWITCH_PAIRS[s.track] };
}
const fixed = puzzle.fixed;

let solutions = [];
let iterations = 0;
const MAX_ITER = 100000000;

// Get all possible tracks for a cell given an entry direction
// If cell already has a track, try to upgrade to T-track that supports both
function getTrackOptions(k, entry, placed) {
  if (!blankSet.has(k)) return [];
  const existing = placed[k];
  if (!existing) {
    // New cell: try all basic tracks
    return BASIC_TRACKS.filter(t => exitPort(t, entry) !== null);
  }
  // Existing track: check if it already supports this entry
  if (exitPort(existing, entry) !== null) {
    return [existing]; // Already works
  }
  // Need to upgrade to T-track
  const upgrades = [];
  // Find T-tracks that support both the existing track's entries AND the new entry
  for (const tt of T_TRACKS) {
    // Must support new entry
    if (!exitPort(tt, entry)) continue;
    // Must support all entries the existing track supports
    let compatible = true;
    for (const d of ["N", "E", "S", "W"]) {
      const oldExit = exitPort(existing, d);
      if (oldExit && exitPort(tt, d) !== oldExit) { compatible = false; break; }
    }
    if (compatible) upgrades.push(tt);
  }
  return upgrades;
}

function dfs(cars, arrived, step, placed, autoToggled, stateKey) {
  if (iterations++ > MAX_ITER) return;
  if (iterations % 10000000 === 0) console.log(`  ${iterations/1000000}M iterations...`);
  if (solutions.length >= 1) return;
  
  if (arrived.length === puzzle.order.length && cars.length === 0) {
    solutions.push({ ...placed });
    console.log(`FOUND SOLUTION at step ${step}!`);
    return;
  }
  if (step > puzzle.maxSteps) return;
  if (Object.keys(placed).length > 12) return;
  
  // Collect all cars that need track decisions
  const decisions = []; // [{car, k, options}]
  for (const c of cars) {
    if (c.wait > 0) continue;
    const k = pk(c.x, c.y);
    if (autoSwitchMap[k] || fixed[k]) continue; // no decision needed
    if (!blankSet.has(k)) continue; // not a blank cell
    
    const options = getTrackOptions(k, c.entry, placed);
    if (options.length === 0) return; // dead end
    if (options.length === 1 && options[0] === placed[k]) continue; // already decided
    decisions.push({ car: c, k, options });
  }
  
  if (decisions.length === 0) {
    // No decisions needed, just simulate one step
    doStep(cars, arrived, step, placed, autoToggled);
    return;
  }
  
  // Make decisions and then simulate
  function decide(di) {
    if (di === decisions.length) {
      doStep(cars, arrived, step, placed, autoToggled);
      return;
    }
    const { car, k, options } = decisions[di];
    const oldTrack = placed[k];
    for (const tr of options) {
      placed[k] = tr;
      decide(di + 1);
      if (solutions.length >= 1 || iterations > MAX_ITER) { 
        if (oldTrack) placed[k] = oldTrack; else delete placed[k]; 
        return; 
      }
    }
    if (oldTrack) placed[k] = oldTrack; else delete placed[k];
  }
  decide(0);
}

function doStep(cars, arrived, step, placed, autoToggled) {
  const tracks = { ...fixed, ...placed };
  const nxt = [];
  const autoUsed = [];
  const edges = new Set();
  const newArrived = [...arrived];
  
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
    
    if (!track) return;
    const ex = exitPort(track, c.entry);
    if (!ex) return;
    
    const nx = c.x + DELTA[ex][0], ny = c.y + DELTA[ex][1], ne = OPPOSITE[ex];
    const usedAuto = !!autoSwitchMap[k];
    
    if (nx === puzzle.goal[0] && ny === puzzle.goal[1]) {
      if (ne !== puzzle.goalEntry) return;
      const ek = `${k}>${pk(nx,ny)}`;
      if (edges.has(`${pk(nx,ny)}>${k}`)) return;
      edges.add(ek);
      newArrived.push(c.name);
      const pfx = puzzle.order.slice(0, newArrived.length);
      if (newArrived.join(",") !== pfx.join(",")) return;
      if (usedAuto) autoUsed.push(k);
      continue;
    }
    
    if (nx < 0 || nx >= puzzle.width || ny < 0 || ny >= puzzle.height) return;
    
    const nk = pk(nx, ny);
    // Check next cell is reachable (has or can have track)
    if (!fixed[nk] && !blankSet.has(nk) && !autoSwitchMap[nk]) return;
    
    const ek = `${k}>${nk}`;
    if (edges.has(`${nk}>${k}`)) return;
    edges.add(ek);
    
    if (usedAuto) autoUsed.push(k);
    nxt.push({ name: c.name, x: nx, y: ny, entry: ne });
  }
  
  const occ = new Set();
  for (const c of nxt) {
    const k = pk(c.x, c.y);
    if (occ.has(k)) return;
    occ.add(k);
  }
  
  const newAutoToggled = { ...autoToggled };
  for (const k of autoUsed) newAutoToggled[k] = !newAutoToggled[k];
  
  // State dedup
  const sk = newArrived.join(",") + "|" + nxt.map(c => 
    c.name+":"+c.x+","+c.y+","+c.entry+":"+(c.wait||0)
  ).sort().join("|") + "|A:" + Object.keys(newAutoToggled).filter(k => newAutoToggled[k]).sort().join(",");
  
  dfs(nxt, newArrived, step + 1, placed, newAutoToggled, sk);
}

console.log("Starting DFS search with T-track upgrades...");
const startTime = Date.now();
dfs(
  puzzle.cars.map(c => ({ ...c, wait: 0 })),
  [], 1, {}, {}
);

const elapsed = (Date.now() - startTime) / 1000;
console.log(`\nDone in ${elapsed.toFixed(1)}s. ${iterations} iterations. Found ${solutions.length} solutions.`);
if (solutions.length > 0) {
  for (const sol of solutions) {
    console.log("\nSolution placed tracks:", JSON.stringify(sol, null, 2));
  }
}

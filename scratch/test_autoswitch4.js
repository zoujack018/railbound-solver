// Broader search - enumerate all basic tracks on ALL 12 blanks
// 6^12 = 2B too much. But we can prune heavily.
// Strategy: use the actual simulate function but with early termination.

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
  autoSwitches: [
    { x: 2, y: 1, track: "T_ES_W" },
    { x: 3, y: 1, track: "T_SW_N" },
    { x: 2, y: 2, track: "T_ES_N" },
    { x: 3, y: 2, track: "T_WN_E" }
  ],
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
    let fail = false;
    
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
      
      if (!track) return { ok: false };
      const ex = exitPort(track, c.entry);
      if (!ex) return { ok: false };
      
      let nx = c.x + DELTA[ex][0], ny = c.y + DELTA[ex][1], ne = OPPOSITE[ex];
      const usedAuto = !!autoSwitchMap[k];
      
      if (nx === pz.goal[0] && ny === pz.goal[1]) {
        if (ne !== ge) return { ok: false };
        const ek = `${k}>${pk(nx,ny)}`;
        if (edges.has(`${pk(nx,ny)}>${k}`)) return { ok: false };
        edges.add(ek);
        arrived.push(c.name);
        const pfx = pz.order.slice(0, arrived.length);
        if (arrived.join(",") !== pfx.join(",")) return { ok: false };
        if (usedAuto) autoUsedKeys.push(k);
        continue;
      }
      
      if (nx < 0 || nx >= pz.width || ny < 0 || ny >= pz.height) return { ok: false };
      
      const ek = `${k}>${pk(nx,ny)}`;
      if (edges.has(`${pk(nx,ny)}>${k}`)) return { ok: false };
      edges.add(ek);
      
      if (usedAuto) autoUsedKeys.push(k);
      nxt.push({ name: c.name, x: nx, y: ny, entry: ne });
    }
    
    const occ = new Set();
    for (const c of nxt) {
      const k = pk(c.x, c.y);
      if (occ.has(k)) return { ok: false };
      occ.add(k);
    }
    
    cars = nxt;
    for (const k of autoUsedKeys) autoToggled[k] = !autoToggled[k];
    
    if (arrived.join(",") === pz.order.join(",") && !cars.length) {
      return { ok: true, steps: t };
    }
  }
  return { ok: false };
}

// Strategy: fix (4,2)="-" (must exit east to goal).
// Search ALL 6^11 = 362M for the remaining 11 blanks. Still too many.
// 
// Better: Use constraint propagation. Only place tracks on cells that 
// are actually visited during simulation. Leave others as null.
// Use DFS: simulate step by step, placing tracks only when a car needs them.

const blankSet = new Set(puzzle.blanks.map(b => pk(b[0], b[1])));
const autoSwitchMap = buildAutoSwitchMap(puzzle.autoSwitches);
const fixed = puzzle.fixed;

let solutions = [];
let iterations = 0;
const MAX_ITER = 50000000;

function dfs(cars, arrived, step, placed, autoToggled) {
  if (iterations++ > MAX_ITER) return;
  if (iterations % 5000000 === 0) console.log(`  ${iterations/1000000}M iterations...`);
  
  if (arrived.length === puzzle.order.length && cars.length === 0) {
    solutions.push({ ...placed });
    console.log(`FOUND SOLUTION at step ${step}! Placed:`, JSON.stringify(placed));
    return;
  }
  if (solutions.length >= 3) return;
  if (step > 50) return; // Limit steps to keep it manageable
  if (Object.keys(placed).length > 12) return;
  
  // Find cells that need tracks placed NOW (cars on blank cells)
  const needTrack = [];
  for (const c of cars) {
    if (c.wait > 0) continue;
    const k = pk(c.x, c.y);
    if (blankSet.has(k) && !placed[k] && !autoSwitchMap[k] && !fixed[k]) {
      needTrack.push(c);
    }
  }
  
  if (needTrack.length > 1) {
    // Multiple cars need tracks simultaneously - need to place all combos
    // For simplicity, handle up to 2
    if (needTrack.length > 2) return;
    const c1 = needTrack[0], c2 = needTrack[1];
    const k1 = pk(c1.x, c1.y), k2 = pk(c2.x, c2.y);
    if (k1 === k2) {
      // Same cell - find track that works for both entries
      for (const tr of BASIC_TRACKS) {
        if (exitPort(tr, c1.entry) && exitPort(tr, c2.entry)) {
          placed[k1] = tr;
          simStep(cars, arrived, step, placed, autoToggled);
          delete placed[k1];
          if (solutions.length >= 3 || iterations > MAX_ITER) return;
        }
      }
    } else {
      for (const tr1 of BASIC_TRACKS) {
        if (!exitPort(tr1, c1.entry)) continue;
        placed[k1] = tr1;
        for (const tr2 of BASIC_TRACKS) {
          if (!exitPort(tr2, c2.entry)) continue;
          placed[k2] = tr2;
          simStep(cars, arrived, step, placed, autoToggled);
          if (solutions.length >= 3 || iterations > MAX_ITER) { delete placed[k1]; delete placed[k2]; return; }
        }
        delete placed[k2];
        delete placed[k1];
      }
    }
    return;
  }
  
  if (needTrack.length === 1) {
    const c = needTrack[0];
    const k = pk(c.x, c.y);
    for (const tr of BASIC_TRACKS) {
      if (!exitPort(tr, c.entry)) continue;
      placed[k] = tr;
      simStep(cars, arrived, step, placed, autoToggled);
      delete placed[k];
      if (solutions.length >= 3 || iterations > MAX_ITER) return;
    }
    return;
  }
  
  // No tracks needed - just simulate
  simStep(cars, arrived, step, placed, autoToggled);
}

function simStep(cars, arrived, step, placed, autoToggled) {
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
    
    let nx = c.x + DELTA[ex][0], ny = c.y + DELTA[ex][1], ne = OPPOSITE[ex];
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
    
    const ek = `${k}>${pk(nx,ny)}`;
    if (edges.has(`${pk(nx,ny)}>${k}`)) return;
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
  
  dfs(nxt, newArrived, step + 1, placed, newAutoToggled);
}

console.log("Starting DFS search (step-by-step track placement)...");
dfs(
  puzzle.cars.map(c => ({ ...c, wait: 0 })),
  [], 1, {}, {}
);

console.log(`\nDone. ${iterations} iterations. Found ${solutions.length} solutions.`);
if (solutions.length > 0) {
  for (const sol of solutions) {
    console.log("Solution:", JSON.stringify(sol));
    // Verify
    const r = simulate(puzzle, sol);
    console.log("Verify:", r);
  }
}

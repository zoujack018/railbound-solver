/* railbound-worker.js — Solver Worker (real ES module, imported by Vite).
 * All game rules come from the shared Rule Layer (railbound-rules.js).
 * This file contains ONLY search-layer logic: CSP, DFS, path enumeration.
 */
import {
  TRACKS, OPPOSITE, DELTA, ALL_DIRS, BASIC_TRACKS, T_TRACKS, TRACK_NAMES, T_SWITCH_PAIRS,
  pk, exitPort,
  TRACKS_BY_ENTRY, BASIC_BY_ENTRY, TRACKS_BY_EXIT,
  buildTunnelMap, buildTSwitchMap, buildAutoSwitchMap,
  effectiveTSwitchTrack, effectiveAutoSwitchTrack, effectiveTrackAt,
  tswitchTrackVariants, occupiedBarrierColors,
  buildPlatformState, platformPickupForCar, carNeedsPassengers, allPlatformsServed,
  isZeroCar, requiredOrder, zeroSafetySteps, zeroSafetyLookahead,
  simulate, filterBlanks,
  blockedCellsForCar, carWaypoints,
  puzzleHasDynamicState,
} from "./railbound-rules.js";

// ═══════════ Search-layer constants ═══════════

const MAX_PATHS = 10000;
const MAX_ENUM_ITERS = 4000000;
const PATH_SLACK = 6;
const MAX_ALTERNATES = 5;
const CSP_BEAM_WIDTH = 2000;

// ═══════════ Search helpers ═══════════

function getPorts(tn) {
  const t = TRACKS[tn]; if (!t) return [];
  const p = new Set();
  for (const [e, x] of Object.entries(t)) { p.add(e); p.add(x); }
  return [...p];
}

function bfsMinSteps(car, pz, bs, waypoints = [], blocked = null) {
  const gx = pz.goal[0], gy = pz.goal[1], ge = pz.goalEntry || pz.goal_entry;
  const tm = buildTunnelMap(pz.tunnels);
  const tsm = buildTSwitchMap(pz.tswitches);
  const asm = buildAutoSwitchMap(pz.autoSwitches || pz.auto_switches);
  const startWp = waypoints[0] && car.x === waypoints[0].x && car.y === waypoints[0].y ? 1 : 0;
  const q = [[car.x, car.y, car.entry, startWp, 0]];
  const visited = new Set();
  for (let qi = 0; qi < q.length; qi++) {
    const [x, y, entry, wpIdx, steps] = q[qi];
    const sk = x + "," + y + "," + entry + "," + wpIdx;
    if (visited.has(sk)) continue; visited.add(sk);
    const k = pk(x, y);
    let exits = [];
    if (tm[k]) {
      if (entry !== tm[k].facing) continue;
      const p = tm[k].pair;
      exits = [{ nx: p.x + DELTA[p.facing][0], ny: p.y + DELTA[p.facing][1], ne: OPPOSITE[p.facing] }];
    } else {
      let pool;
      if (tsm[k]) pool = tswitchTrackVariants(tsm[k]);
      else if (asm[k]) pool = tswitchTrackVariants(asm[k]);
      else if (pz.fixed[k]) pool = [pz.fixed[k]];
      else if (bs.has(k)) pool = BASIC_BY_ENTRY[entry];
      else continue;
      const seenExit = new Set();
      for (const tr of pool) {
        const ex = exitPort(tr, entry);
        if (!ex || seenExit.has(ex)) continue;
        seenExit.add(ex);
        exits.push({ nx: x + DELTA[ex][0], ny: y + DELTA[ex][1], ne: OPPOSITE[ex] });
      }
    }
    for (const { nx, ny, ne } of exits) {
      const wp = waypoints[wpIdx];
      const nwp = wp && nx === wp.x && ny === wp.y ? wpIdx + 1 : wpIdx;
      if (nx === gx && ny === gy) { if (nwp >= waypoints.length && ne === ge) return steps + 1; continue; }
      if (nx < 0 || nx >= pz.width || ny < 0 || ny >= pz.height) continue;
      const nk = pk(nx, ny);
      if (blocked && blocked.has(nk)) continue;
      if (!pz.fixed[nk] && !bs.has(nk) && !tm[nk] && !tsm[nk] && !asm[nk]) continue;
      q.push([nx, ny, ne, nwp, steps + 1]);
    }
  }
  return Infinity;
}

function buildHeuristic(car, pz, bs, waypoints = [], blocked = null) {
  const gx = pz.goal[0], gy = pz.goal[1], ge = pz.goalEntry || pz.goal_entry;
  const tm = buildTunnelMap(pz.tunnels);
  const tsm = buildTSwitchMap(pz.tswitches);
  const asm = buildAutoSwitchMap(pz.autoSwitches || pz.auto_switches);
  const fwd = new Map();
  const startWp = waypoints[0] && car.x === waypoints[0].x && car.y === waypoints[0].y ? 1 : 0;
  const q = [[car.x, car.y, car.entry, startWp, 0]];
  let bestTotal = Infinity;
  for (let qi = 0; qi < q.length; qi++) {
    const [x, y, entry, wpIdx, steps] = q[qi];
    const sk = x + "," + y + "," + entry + "," + wpIdx;
    if (fwd.has(sk)) continue; fwd.set(sk, steps);
    if (steps >= bestTotal) continue;
    const k = pk(x, y);
    let exits = [];
    if (tm[k]) {
      if (entry !== tm[k].facing) continue;
      const p = tm[k].pair;
      exits = [{ nx: p.x + DELTA[p.facing][0], ny: p.y + DELTA[p.facing][1], ne: OPPOSITE[p.facing] }];
    } else {
      let pool;
      if (tsm[k]) pool = tswitchTrackVariants(tsm[k]);
      else if (asm[k]) pool = tswitchTrackVariants(asm[k]);
      else if (pz.fixed[k]) pool = [pz.fixed[k]];
      else if (bs.has(k)) pool = BASIC_BY_ENTRY[entry];
      else continue;
      const seenExit = new Set();
      for (const tr of pool) {
        const ex = exitPort(tr, entry);
        if (!ex || seenExit.has(ex)) continue;
        seenExit.add(ex);
        exits.push({ nx: x + DELTA[ex][0], ny: y + DELTA[ex][1], ne: OPPOSITE[ex] });
      }
    }
    for (const { nx, ny, ne } of exits) {
      const wp = waypoints[wpIdx];
      const nwp = wp && nx === wp.x && ny === wp.y ? wpIdx + 1 : wpIdx;
      if (nx === gx && ny === gy) { if (nwp >= waypoints.length && ne === ge) { if (steps + 1 < bestTotal) bestTotal = steps + 1; } continue; }
      if (nx < 0 || nx >= pz.width || ny < 0 || ny >= pz.height) continue;
      const nk = pk(nx, ny);
      if (blocked && blocked.has(nk)) continue;
      if (!pz.fixed[nk] && !bs.has(nk) && !tm[nk] && !tsm[nk] && !asm[nk]) continue;
      q.push([nx, ny, ne, nwp, steps + 1]);
    }
  }
  function manh(x, y, wpIdx) {
    let d = 0, cx = x, cy = y;
    for (let i = wpIdx; i < waypoints.length; i++) {
      d += Math.abs(cx - waypoints[i].x) + Math.abs(cy - waypoints[i].y);
      cx = waypoints[i].x; cy = waypoints[i].y;
    }
    return d + Math.abs(cx - gx) + Math.abs(cy - gy);
  }
  function h(x, y, entry, wpIdx) {
    const m = manh(x, y, wpIdx);
    const sk = x + "," + y + "," + entry + "," + wpIdx;
    const fd = fwd.get(sk);
    if (fd !== undefined && bestTotal !== Infinity) { const r = bestTotal - fd; return r > m ? r : m; }
    return m;
  }
  return { h, minTotal: bestTotal };
}

// ═══════════ Path enumeration ═══════════

function enumeratePaths(car, pz, bs, meta, maxCost, waypoints = [], minRequiredArrival = 0, blocked = null) {
  const ge = pz.goalEntry || pz.goal_entry, gx = pz.goal[0], gy = pz.goal[1], pathLimit = pz.maxPaths || MAX_PATHS;
  const heur = buildHeuristic(car, pz, bs, waypoints, blocked);
  const minSteps = heur.minTotal;
  const isZero = isZeroCar(car);
  if (minSteps === Infinity && !isZero) return { paths: [], overflow: false, minSteps };
  const slack = pz.pathSlack ?? PATH_SLACK;
  const minLen = Math.max(minSteps === Infinity ? 0 : minSteps, minRequiredArrival);
  const maxLen = isZero ? (pz.maxSteps || pz.max_steps || 50) : Math.min(pz.maxSteps || pz.max_steps || 50, minLen + slack);
  let iters = 0;
  let overflow = false;
  const tunnelMap = buildTunnelMap(pz.tunnels);
  const tswitchMap = buildTSwitchMap(pz.tswitches);
  const autoSwitchMap = buildAutoSwitchMap(pz.autoSwitches || pz.auto_switches);
  function nextWpIdxFor(nx, ny, wpIdx) { const wp = waypoints[wpIdx]; return wp && nx === wp.x && ny === wp.y ? wpIdx + 1 : wpIdx; }
  function pathKey(p) { return p.assigns.map(a => a.k + ":" + a.track).sort().join("|"); }
  function pathBucket(p) {
    let mask = 0;
    for (const a of p.assigns) {
      const parts = a.k.split(","), x = +parts[0], y = +parts[1];
      const xb = x < Math.ceil(pz.width / 3) ? 0 : (x < Math.ceil(pz.width * 2 / 3) ? 1 : 2);
      const yb = y < Math.ceil(pz.height / 3) ? 0 : (y < Math.ceil(pz.height * 2 / 3) ? 1 : 2);
      mask |= 1 << (yb * 3 + xb);
    }
    return String(mask);
  }
  function pathCompare(a, b) {
    const ac = a.assigns.length, bc = b.assigns.length;
    if (ac !== bc) return ac - bc;
    if (a.steps !== b.steps) return a.steps - b.steps;
    const ak = a._key || (a._key = pathKey(a)), bk = b._key || (b._key = pathKey(b));
    return ak < bk ? -1 : ak > bk ? 1 : 0;
  }
  const pathBuckets = {}, bucketOrder = [], perBucket = pz.maxPathsPerBucket || Math.max(80, Math.ceil(pathLimit / 48));
  function keepPath(p) {
    const b = pathBucket(p);
    let arr = pathBuckets[b];
    if (!arr) { arr = []; pathBuckets[b] = arr; bucketOrder.push(b); }
    if (arr.length < perBucket) { arr.push(p); return; }
    overflow = true;
    let wi = 0;
    for (let i = 1; i < arr.length; i++) if (pathCompare(arr[i], arr[wi]) > 0) wi = i;
    if (pathCompare(p, arr[wi]) < 0) arr[wi] = p;
  }
  function dfs(x, y, entry, assigns, visited, cost, steps, wpIdx) {
    if (iters++ > MAX_ENUM_ITERS) { overflow = true; return; }
    if (cost > maxCost || steps >= maxLen) { if (isZero && assigns.length > 0) keepPath({ assigns, steps }); return; }
    if (steps + (minSteps === Infinity ? 0 : heur.h(x, y, entry, wpIdx)) > maxLen) return;
    const k = pk(x, y);
    const vk = k + ":" + entry + ":" + wpIdx;
    if (visited.has(vk)) { if (isZero && assigns.length > 0) keepPath({ assigns, steps }); return; }
    visited.add(vk);
    if (tunnelMap[k]) {
      if (entry !== tunnelMap[k].facing) { visited.delete(vk); return; }
      const p = tunnelMap[k].pair;
      const nx = p.x + DELTA[p.facing][0], ny = p.y + DELTA[p.facing][1], ne = OPPOSITE[p.facing];
      if (nx === gx && ny === gy) { if (isZero) { visited.delete(vk); return; } if (wpIdx >= waypoints.length && ne === ge && (steps + 1) >= minLen) keepPath({ assigns, steps: steps + 1 }); visited.delete(vk); return; }
      if (nx < 0 || nx >= pz.width || ny < 0 || ny >= pz.height) { visited.delete(vk); return; }
      const nk = pk(nx, ny);
      if (blocked && blocked.has(nk)) { visited.delete(vk); return; }
      if (!pz.fixed[nk] && !bs.has(nk) && !tunnelMap[nk] && !tswitchMap[nk] && !autoSwitchMap[nk]) { visited.delete(vk); return; }
      dfs(nx, ny, ne, assigns, visited, cost, steps + 1, nextWpIdxFor(nx, ny, wpIdx));
      visited.delete(vk); return;
    }
    const fixed = pz.fixed[k];
    const sw = tswitchMap[k];
    const au = autoSwitchMap[k];
    const existIdx = fixed || sw || au ? -1 : assigns.findIndex(a => a.k === k);
    let pool;
    if (sw) pool = tswitchTrackVariants(sw).filter(t => exitPort(t, entry) !== null);
    else if (au) pool = tswitchTrackVariants(au).filter(t => exitPort(t, entry) !== null);
    else if (fixed) pool = [fixed];
    else if (bs.has(k)) {
      if (existIdx >= 0) {
        const prev = assigns[existIdx]; pool = [];
        for (const tn of T_TRACKS) {
          if (exitPort(tn, prev.entry) !== prev.exit) continue;
          if (prev.extra) { let ok = true; for (const e of prev.extra) { if (exitPort(tn, e.entry) !== e.exit) { ok = false; break; } } if (!ok) continue; }
          if (exitPort(tn, entry) === null) continue;
          pool.push(tn);
        }
      } else {
        const m = meta[k];
        pool = m ? m.basicTracks.filter(t => exitPort(t, entry) !== null) : BASIC_BY_ENTRY[entry];
      }
    } else { visited.delete(vk); return; }
    for (const tr of pool) {
      const ex = exitPort(tr, entry); if (!ex) continue;
      const nx = x + DELTA[ex][0], ny = y + DELTA[ex][1], ne = OPPOSITE[ex];
      let na, nc;
      if (fixed || sw || au) { na = assigns; nc = cost; }
      else if (existIdx >= 0) {
        na = assigns.map((a, i) => {
          if (i !== existIdx) return a;
          const extra = a.extra ? [...a.extra, { entry, exit: ex }] : [{ entry, exit: ex }];
          return { k, track: tr, entry: a.entry, exit: a.exit, extra };
        });
        nc = cost;
      } else { na = [...assigns, { k, track: tr, entry, exit: ex }]; nc = cost + 1; }
      if (nx === gx && ny === gy) { if (isZero) continue; if (wpIdx >= waypoints.length && ne === ge && (steps + 1) >= minLen) keepPath({ assigns: na, steps: steps + 1 }); continue; }
      if (nx < 0 || nx >= pz.width || ny < 0 || ny >= pz.height) continue;
      const nk = pk(nx, ny);
      if (blocked && blocked.has(nk)) continue;
      if (!pz.fixed[nk] && !bs.has(nk) && !tunnelMap[nk] && !tswitchMap[nk] && !autoSwitchMap[nk]) continue;
      dfs(nx, ny, ne, na, visited, nc, steps + 1, nextWpIdxFor(nx, ny, wpIdx));
    }
    visited.delete(vk);
  }
  const initialWpIdx = nextWpIdxFor(car.x, car.y, 0);
  dfs(car.x, car.y, car.entry, [], new Set(), 0, 0, initialWpIdx);
  for (const b of bucketOrder) pathBuckets[b].sort(pathCompare);
  const paths = [];
  for (let i = 0; paths.length < pathLimit; i++) {
    let added = false;
    for (const b of bucketOrder) {
      const p = pathBuckets[b][i]; if (!p) continue;
      paths.push(p); added = true;
      if (paths.length >= pathLimit) break;
    }
    if (!added) break;
  }
  paths.sort(pathCompare);
  const seen = new Set(), deduped = [];
  for (const p of paths) { const fp = p._key || pathKey(p); if (!seen.has(fp)) { seen.add(fp); deduped.push(p); } }
  return { paths: deduped, overflow, minSteps, maxLen, minLen };
}

// ═══════════ CSP solver ═══════════

function solveCSP(pz, maxCost, bs, meta) {
  const platformState = buildPlatformState(pz.platforms);
  const blockedByCar = {};
  for (const car of pz.cars) blockedByCar[car.name] = blockedCellsForCar(platformState, car.name);
  const waypointsByCar = {}, minStepsByCar = {}, waypointCountByCar = {};
  for (const car of pz.cars) {
    const wps = carWaypoints(platformState, car.name);
    waypointsByCar[car.name] = wps;
    waypointCountByCar[car.name] = wps.length;
    minStepsByCar[car.name] = bfsMinSteps(car, pz, bs, wps, blockedByCar[car.name]);
  }
  const minRequiredByCar = {};
  let priorMaxArrival = 0;
  let zeroTriggerMinSteps = 0;
  if (pz.triggers && pz.triggers.length && pz.cars.some(isZeroCar)) {
    const zeroCar = pz.cars.find(isZeroCar);
    if (zeroCar) {
      for (const trig of pz.triggers) {
        const dist = Math.abs(zeroCar.x - trig.x) + Math.abs(zeroCar.y - trig.y);
        if (dist > zeroTriggerMinSteps) zeroTriggerMinSteps = dist;
      }
    }
  }
  for (const name of pz.order) {
    const wc = waypointCountByCar[name] || 0;
    minRequiredByCar[name] = Math.max(0, priorMaxArrival + 1 - 2 * wc);
    if (zeroTriggerMinSteps > 0) minRequiredByCar[name] = Math.max(minRequiredByCar[name], zeroTriggerMinSteps);
    const ms = minStepsByCar[name];
    if (ms !== Infinity) {
      const forcedMin = Math.max(ms, minRequiredByCar[name]);
      const arrival = forcedMin + 2 * wc;
      if (arrival > priorMaxArrival) priorMaxArrival = arrival;
    }
  }
  const allPathResults = pz.cars.map(car => {
    const iz = isZeroCar(car);
    const customPz = iz ? { ...pz, pathSlack: 30 } : pz;
    return enumeratePaths(car, customPz, bs, meta, maxCost, waypointsByCar[car.name], minRequiredByCar[car.name] || 0, blockedByCar[car.name]);
  });
  const allPaths = allPathResults.map(r => r.paths);
  const overflow = allPathResults.some(r => r.overflow);
  for (let i = 0; i < allPaths.length; i++) if (!allPaths[i].length) {
    if (isZeroCar(pz.cars[i])) continue;
    return { sol: null, overflow, info: "car " + (i + 1) + " has 0 paths (minSteps=" + allPathResults[i].minSteps + ", req>=" + (minRequiredByCar[pz.cars[i].name] || 0) + ", blocked=" + blockedByCar[pz.cars[i].name].size + ")" };
  }
  const info = "paths: " + allPaths.map((p, i) => "c" + pz.cars[i].name + "=" + p.length + (allPathResults[i].overflow ? "!" : "") + "[" + allPathResults[i].minLen + "-" + allPathResults[i].maxLen + "]").join(" x ");
  self.postMessage({ type: "progress", iters: 0, cspInfo: info });

  const order = [];
  for (const name of pz.order) { const ci = pz.cars.findIndex(c => String(c.name) === String(name)); if (ci >= 0) order.push(ci); }
  for (let i = 0; i < pz.cars.length; i++) if (!order.includes(i) && allPaths[i].length > 0) order.push(i);
  let bestSol = null, bestCost = maxCost + 1, iters = 0;
  const alternates = [], alternateKeys = new Set();
  const MAX_I = 15000000;
  function placedKey(placed) { return Object.keys(placed).sort().map(k => k + ":" + placed[k]).join("|"); }
  function rememberSolution(placed, cost) {
    const sol = { ...placed, __cost: cost }, key = placedKey(placed);
    if (cost < bestCost) { bestCost = cost; bestSol = sol; alternates.length = 0; alternateKeys.clear(); }
    if (cost === bestCost && !alternateKeys.has(key) && alternates.length < MAX_ALTERNATES) {
      alternateKeys.add(key); alternates.push(sol);
    }
    if (bestSol === sol || alternates[alternates.length - 1] === sol) self.postMessage({ type: "solution", solution: sol });
  }

  const orderPosByCi = [], wpCountByCi = [];
  for (let i = 0; i < pz.cars.length; i++) {
    orderPosByCi[i] = pz.order.indexOf(String(pz.cars[i].name));
    wpCountByCi[i] = waypointCountByCar[pz.cars[i].name] || 0;
  }
  const pathMaps = allPaths.map((paths, ci) => paths.map(path => {
    const m = {}; for (const a of path.assigns) { m[a.k] = { track: a.track, entry: a.entry, exit: a.exit }; if (a.extra) m[a.k].extra = a.extra; }
    return { cells: m, steps: path.steps, arrival: path.steps + 2 * wpCountByCi[ci] };
  }));
  for (const list of pathMaps) list.sort((a, b) => Object.keys(a.cells).length - Object.keys(b.cells).length || a.arrival - b.arrival);

  function usagesOfCell(a) {
    const out = [{ entry: a.entry, exit: a.exit }];
    if (a.extra) out.push(...a.extra);
    const seen = new Set(), res = [];
    for (const u of out) { const id = u.entry + ">" + u.exit; if (!seen.has(id)) { seen.add(id); res.push(u); } }
    return res;
  }
  function tPortsAllUsed(track, usages) {
    if (!track || !track.startsWith("T_")) return true;
    const ports = new Set(getPorts(track)), used = new Set();
    for (const u of usages) { used.add(u.entry); used.add(u.exit); }
    for (const p of ports) { if (!used.has(p)) return false; }
    return true;
  }
  function validateTUsage(asgn) {
    for (const k in asgn) {
      if (asgn[k].track && asgn[k].track.startsWith("T_")) {
        if (!tPortsAllUsed(asgn[k].track, usagesOfCell(asgn[k]))) return false;
      }
    }
    return true;
  }
  function checkCompat(pm, asgn) {
    let added = 0; const merges = {};
    for (const k in pm) {
      if (asgn[k]) {
        const oldUsages = usagesOfCell(asgn[k]);
        const newUsages = [{ entry: pm[k].entry, exit: pm[k].exit }];
        if (pm[k].extra) for (const e of pm[k].extra) newUsages.push(e);
        const allU = [...oldUsages, ...newUsages];
        let allOk = true;
        for (const u of newUsages) { if (exitPort(asgn[k].track, u.entry) !== u.exit) { allOk = false; break; } }
        if (allOk) { merges[k] = asgn[k].track; continue; }
        let found = null;
        for (const tn of T_TRACKS) {
          let ok = true;
          for (const u of allU) { if (exitPort(tn, u.entry) !== u.exit) { ok = false; break; } }
          if (ok) { found = tn; break; }
        }
        if (!found) return null;
        merges[k] = found;
      } else { added++; }
    }
    return { added, merges };
  }
  function forwardCheck(asgn, remaining) {
    for (const ci of remaining) {
      let any = false;
      for (const po of pathMaps[ci]) { if (checkCompat(po.cells, asgn) !== null) { any = true; break; } }
      if (!any) return false;
    }
    return true;
  }
  function asgnKey(asgn) { return Object.keys(asgn).sort().map(k => k + ":" + asgn[k].track).join("|"); }
  function cloneMergedAsgn(asgn, pm, merges) {
    const na = {}; for (const k in asgn) na[k] = { ...asgn[k], extra: asgn[k].extra ? [...asgn[k].extra] : undefined };
    for (const k in pm) {
      if (na[k]) {
        const extra = na[k].extra ? [...na[k].extra] : [{ entry: na[k].entry, exit: na[k].exit }];
        extra.push({ entry: pm[k].entry, exit: pm[k].exit });
        if (pm[k].extra) for (const e of pm[k].extra) extra.push(e);
        na[k] = { track: merges[k], entry: na[k].entry, exit: na[k].exit, extra };
      } else { na[k] = { track: pm[k].track, entry: pm[k].entry, exit: pm[k].exit }; if (pm[k].extra) na[k].extra = pm[k].extra.map(e => ({ ...e })); }
    }
    return na;
  }
  function asgnBucket(asgn) {
    let mask = 0;
    for (const k in asgn) {
      const parts = k.split(","), x = +parts[0], y = +parts[1];
      const xb = x < Math.ceil(pz.width / 3) ? 0 : (x < Math.ceil(pz.width * 2 / 3) ? 1 : 2);
      const yb = y < Math.ceil(pz.height / 3) ? 0 : (y < Math.ceil(pz.height * 2 / 3) ? 1 : 2);
      mask |= 1 << (yb * 3 + xb);
    }
    return String(mask);
  }
  function stateCompare(a, b) { return a.cost - b.cost || a.arrivalSum - b.arrivalSum || asgnKey(a.asgn).localeCompare(asgnKey(b.asgn)); }
  function trimBeam(states, width) {
    if (states.length <= width) { states.sort(stateCompare); return states; }
    const buckets = {}, keys = [];
    for (const s of states) { const b = asgnBucket(s.asgn); if (!buckets[b]) { buckets[b] = []; keys.push(b); } buckets[b].push(s); }
    for (const b of keys) buckets[b].sort(stateCompare);
    const out = [];
    for (let i = 0; out.length < width; i++) {
      let added = false;
      for (const b of keys) { const s = buckets[b][i]; if (!s) continue; out.push(s); added = true; if (out.length >= width) break; }
      if (!added) break;
    }
    out.sort(stateCompare);
    return out;
  }

  /* FIX: quickCollisionCheck now uses effectiveTrackAt (was raw tracks[k])
     and handles tsw_triggers, auto-switch state, and T-switch locks. */
  function quickCollisionCheck(placed) {
    const tracks = { ...pz.fixed, ...placed };
    const tm = buildTunnelMap(pz.tunnels);
    const tswitchMap = buildTSwitchMap(pz.tswitches);
    const autoSwitchMap = buildAutoSwitchMap(pz.autoSwitches || pz.auto_switches);
    const gx = pz.goal[0], gy = pz.goal[1], ms = Math.min(pz.maxSteps || pz.max_steps || 50, 80);
    const triggers = {}; if (pz.triggers) for (const t of pz.triggers) triggers[pk(t.x, t.y)] = t.color;
    const barriers = {}; if (pz.barriers) for (const b of pz.barriers) barriers[pk(b.x, b.y)] = { color: b.color, initialState: b.initialState };
    const tswTriggers = {}; const rawTsw = pz.tsw_triggers || pz.tswTriggers || []; for (const t of rawTsw) tswTriggers[pk(t.x, t.y)] = t.color;
    let toggled = {}, tsToggled = {}, autoToggled = {}, tsLocks = {};
    let cars = pz.cars.map(c => ({ ...c, wait: c.wait || 0 }));
    for (let s = 1; s <= ms; s++) {
      const nxt = [], triggeredColors = [], tsTriggeredColors = [], autoUsedKeys = [], releaseTSLocks = new Set();
      /* Edge-swap collision removed: trains can pass each other on curves/T-junctions */
      for (const c of cars) {
        if (c.wait > 0) { nxt.push({ ...c, wait: c.wait - 1 }); continue; }
        let x = c.x, y = c.y, entry = c.entry, nx, ny, ne;
        let usedTSLock = false, usedAutoSwitch = false;
        const k = pk(x, y);
        if (tm[k]) {
          if (entry !== tm[k].facing) return true;
          const p = tm[k].pair;

          nx = p.x + DELTA[p.facing][0]; ny = p.y + DELTA[p.facing][1]; ne = OPPOSITE[p.facing];
        } else {
          /* FIX: use effectiveTrackAt with full dynamic state */
          const locked = tsLocks[c.name];
          const t = locked && locked.k === k ? locked.track : effectiveTrackAt(k, tracks, tswitchMap, tsToggled, autoSwitchMap, autoToggled);
          usedTSLock = !!(locked && locked.k === k);
          usedAutoSwitch = !!autoSwitchMap[k] && !usedTSLock;
          if (!t) return true;
          const ex = exitPort(t, entry); if (!ex) return true;
          nx = x + DELTA[ex][0]; ny = y + DELTA[ex][1]; ne = OPPOSITE[ex];
        }
        if (nx === gx && ny === gy) {
          if (isZeroCar(c)) return true;
          if (triggers[pk(nx, ny)]) triggeredColors.push(triggers[pk(nx, ny)]);
          if (tswTriggers[pk(nx, ny)]) tsTriggeredColors.push(tswTriggers[pk(nx, ny)]);
          if (usedTSLock) releaseTSLocks.add(c.name);
          if (usedAutoSwitch) autoUsedKeys.push(k);
          continue;
        }
        if (nx < 0 || nx >= pz.width || ny < 0 || ny >= pz.height) return true;
        const nk = pk(nx, ny);
        if (barriers[nk]) {
          const b = barriers[nk], isT = toggled[b.color] || false;
          const cs = b.initialState === 'closed' ? (isT ? 'open' : 'closed') : (isT ? 'closed' : 'open');
          if (cs === 'closed') { nx = x; ny = y; ne = entry; }
        }
        if (nx !== x || ny !== y) {
          if (triggers[pk(nx, ny)]) triggeredColors.push(triggers[pk(nx, ny)]);
          if (tswTriggers[pk(nx, ny)]) tsTriggeredColors.push(tswTriggers[pk(nx, ny)]);
          if (usedTSLock) releaseTSLocks.add(c.name);
          if (usedAutoSwitch) autoUsedKeys.push(k);
        }
        nxt.push({ name: c.name, role: c.role, x: nx, y: ny, entry: ne, wait: 0 });
      }
      const occ = new Set();
      for (const c of nxt) {
        const k = pk(c.x, c.y);
        if (occ.has(k)) return true; occ.add(k);
        if (tm[k]) { const pkp = pk(tm[k].pair.x, tm[k].pair.y); if (occ.has(pkp)) return true; occ.add(pkp); }
      }
      /* tailing ban */
      for (let i = 0; i < nxt.length; i++) {
        const a = nxt[i]; const tax = a.x + DELTA[a.entry][0], tay = a.y + DELTA[a.entry][1];
        for (let j = i + 1; j < nxt.length; j++) {
          const b = nxt[j];
          if (b.x === tax && b.y === tay && b.entry === a.entry) return true;
          const tbx = b.x + DELTA[b.entry][0], tby = b.y + DELTA[b.entry][1];
          if (a.x === tbx && a.y === tby && a.entry === b.entry) return true;
        }
      }
      const blocked = occupiedBarrierColors(nxt, barriers);
      cars = nxt;
      for (const name of releaseTSLocks) delete tsLocks[name];
      for (const cl of triggeredColors) if (!blocked.has(cl)) toggled[cl] = !toggled[cl];
      const tsTriggeredColorSet = new Set(tsTriggeredColors);
      for (const c of cars) { const k = pk(c.x, c.y), sw = tswitchMap[k]; if (sw && tsTriggeredColorSet.has(sw.color)) tsLocks[c.name] = { k, track: effectiveTSwitchTrack(sw, tsToggled) }; }
      for (const cl of tsTriggeredColors) tsToggled[cl] = !tsToggled[cl];
      for (const k of autoUsedKeys) autoToggled[k] = !autoToggled[k];
      if (!cars.length) return false;
    }
    return false;
  }

  function runBeam() {
    const width = pz.cspBeamWidth || CSP_BEAM_WIDTH;
    let states = [{ asgn: {}, cost: 0, arrivals: {}, arrivalSum: 0 }];
    for (let idx = 0; idx < order.length; idx++) {
      const ci = order[idx], posCi = orderPosByCi[ci], next = [], seen = new Set();
      const limit = Math.min(pathMaps[ci].length, pz.cspBeamPathLimit || pathMaps[ci].length);
      for (const st of states) {
        for (let pi = 0; pi < limit; pi++) {
          const po = pathMaps[ci][pi], aCi = po.arrival;
          let orderOk = true;
          for (const otherCi in st.arrivals) {
            const aOther = st.arrivals[otherCi], posOther = orderPosByCi[otherCi];
            if (posCi === -1 || posOther === -1) continue;
            if (posOther < posCi) { if (aOther >= aCi) { orderOk = false; break; } }
            else if (posOther > posCi) { if (aOther <= aCi) { orderOk = false; break; } }
          }
          if (!orderOk) continue;
          const compat = checkCompat(po.cells, st.asgn);
          if (!compat) continue;
          const cost = st.cost + compat.added;
          if (cost > bestCost) continue;
          const na = cloneMergedAsgn(st.asgn, po.cells, compat.merges);
          const key = cost + "|" + aCi + "|" + asgnKey(na);
          if (seen.has(key)) continue; seen.add(key);
          const arrivals = { ...st.arrivals }; arrivals[ci] = aCi;
          next.push({ asgn: na, cost, arrivals, arrivalSum: st.arrivalSum + aCi });
          if (next.length > width * 4) { const trimmed = trimBeam(next, width); next.length = 0; for (const s of trimmed) next.push(s); }
        }
      }
      states = trimBeam(next, width);
      if (!states.length) return;
    }
    for (const st of states) {
      if (!validateTUsage(st.asgn)) continue;
      const placed = {}; for (const k in st.asgn) placed[k] = st.asgn[k].track;
      if (quickCollisionCheck(placed)) continue;
      /* Always validate through the unified Rule Layer simulate */
      const r = simulate(pz, placed);
      if (r.ok && st.cost <= bestCost) rememberSolution(placed, st.cost);
    }
  }
  function bt(idx, asgn, cost, arrivals) {
    if (iters++ > MAX_I || cost > bestCost || (cost === bestCost && alternates.length >= MAX_ALTERNATES)) return;
    if (iters % 100000 === 0) self.postMessage({ type: "progress", iters: 100000 });
    if (idx === order.length) {
      if (!validateTUsage(asgn)) return;
      const placed = {}; for (const k in asgn) placed[k] = asgn[k].track;
      if (quickCollisionCheck(placed)) return;
      const r = simulate(pz, placed);
      if (r.ok && cost <= bestCost) rememberSolution(placed, cost);
      return;
    }
    const ci = order[idx], remaining = order.slice(idx + 1), posCi = orderPosByCi[ci];
    for (const po of pathMaps[ci]) {
      const aCi = po.arrival;
      let orderOk = true;
      for (const otherCi in arrivals) {
        const aOther = arrivals[otherCi], posOther = orderPosByCi[otherCi];
        if (posCi === -1 || posOther === -1) continue;
        if (posOther < posCi) { if (aOther >= aCi) { orderOk = false; break; } }
        else if (posOther > posCi) { if (aOther <= aCi) { orderOk = false; break; } }
      }
      if (!orderOk) continue;
      const pm = po.cells, compat = checkCompat(pm, asgn);
      if (!compat) continue;
      if (cost + compat.added > bestCost) continue;
      const na = {}; for (const k in asgn) na[k] = { ...asgn[k], extra: asgn[k].extra ? [...asgn[k].extra] : undefined };
      for (const k in pm) {
        if (na[k]) {
          const merged = compat.merges[k];
          const extra = na[k].extra ? [...na[k].extra] : [{ entry: na[k].entry, exit: na[k].exit }];
          extra.push({ entry: pm[k].entry, exit: pm[k].exit });
          if (pm[k].extra) for (const e of pm[k].extra) extra.push(e);
          na[k] = { track: merged, entry: na[k].entry, exit: na[k].exit, extra };
        } else { na[k] = { track: pm[k].track, entry: pm[k].entry, exit: pm[k].exit }; if (pm[k].extra) na[k].extra = pm[k].extra.map(e => ({ ...e })); }
      }
      if (remaining.length > 0 && !forwardCheck(na, remaining)) continue;
      const newArrivals = { ...arrivals }; newArrivals[ci] = aCi;
      bt(idx + 1, na, cost + compat.added, newArrivals);
      if (iters > MAX_I) return;
    }
  }
  runBeam();
  bt(0, {}, 0, {});
  return { sol: bestSol, alternates, overflow, info };
}

// ═══════════ DFS fallback solver ═══════════

function solveDFS(pz, maxSol, minTracks, budget, seed, bs, meta, maxIters = 15000000, prePlaced = {}) {
  const placed = { ...prePlaced }, solutions = [], tm = buildTunnelMap(pz.tunnels);
  const _prePlacedCount = Object.keys(prePlaced).length;
  const ge = pz.goalEntry || pz.goal_entry, ms = pz.maxSteps || pz.max_steps || 50, gx = pz.goal[0], gy = pz.goal[1];
  const _trigMap = {}; if (pz.triggers) for (const t of pz.triggers) _trigMap[pk(t.x, t.y)] = t.color;
  const _barMap = {}; if (pz.barriers) for (const b of pz.barriers) _barMap[pk(b.x, b.y)] = { color: b.color, initialState: b.initialState };
  const _hasBars = pz.barriers && pz.barriers.length > 0;
  const _tswMap = {}; const _rawTsw = pz.tsw_triggers || pz.tswTriggers || []; for (const t of _rawTsw) _tswMap[pk(t.x, t.y)] = t.color;
  const _tswitchMap = buildTSwitchMap(pz.tswitches);
  const _autoSwitchMap = buildAutoSwitchMap(pz.autoSwitches || pz.auto_switches);
  const _hasTS = _rawTsw.length > 0 || Object.keys(_tswitchMap).length > 0;
  const _hasAuto = Object.keys(_autoSwitchMap).length > 0;
  const _platformState = buildPlatformState(pz.platforms);
  const _hasPlatforms = _platformState.count > 0;
  const _order = requiredOrder(pz);
  let bestCost = budget, iters = 0; const MAX = maxIters;
  const solutionKeys = new Set();
  function placedKey(obj) { return Object.keys(obj).sort().map(k => k + ":" + obj[k]).join("|"); }
  function rememberSolution(cost) {
    const key = placedKey(placed);
    if (cost < bestCost) { bestCost = cost; solutions.length = 0; solutionKeys.clear(); }
    if (cost === bestCost && !solutionKeys.has(key) && solutions.length < MAX_ALTERNATES) {
      solutionKeys.add(key);
      const sol = { ...placed, __cost: cost };
      solutions.push(sol);
      self.postMessage({ type: "solution", solution: sol });
    }
  }
  const useMap = {};
  function hasUsage(k, entry, exit) { const arr = useMap[k]; return !!arr && arr.some(u => u.entry === entry && u.exit === exit); }
  function pushUsage(k, entry, exit) {
    if (!useMap[k]) useMap[k] = [];
    if (hasUsage(k, entry, exit)) return () => {};
    useMap[k].push({ entry, exit });
    return () => { useMap[k].pop(); if (!useMap[k].length) delete useMap[k]; };
  }
  function trackSupportsUsages(track, k, extra) {
    const arr = useMap[k] ? [...useMap[k]] : [];
    if (extra) arr.push(extra);
    for (const u of arr) { if (exitPort(track, u.entry) !== u.exit) return false; }
    return true;
  }
  function tPortsAllUsedDFS(track, k) {
    if (!track || !track.startsWith("T_")) return true;
    const ports = new Set(getPorts(track)), used = new Set();
    for (const u of useMap[k] || []) { used.add(u.entry); used.add(u.exit); }
    for (const p of ports) { if (!used.has(p)) return false; }
    return true;
  }
  function validatePlacedTUsage() {
    for (const k in placed) { if (placed[k].startsWith("T_") && !tPortsAllUsedDFS(placed[k], k)) return false; }
    return true;
  }
  function canUpgradePlacedCellForEntry(k, entry) {
    if (!placed[k]) return false;
    for (const tn of T_TRACKS) {
      const ex = exitPort(tn, entry); if (!ex) continue;
      if (!trackSupportsUsages(tn, k)) continue;
      return true;
    }
    return false;
  }
  function cellCanAcceptDFS(x, y, entry) {
    if (x === gx && y === gy) return entry === ge;
    if (x < 0 || x >= pz.width || y < 0 || y >= pz.height) return false;
    const k = pk(x, y);
    if (tm[k]) return entry === tm[k].facing;
    if (_tswitchMap[k]) return tswitchTrackVariants(_tswitchMap[k]).some(t => exitPort(t, entry) !== null);
    if (_autoSwitchMap[k]) return tswitchTrackVariants(_autoSwitchMap[k]).some(t => exitPort(t, entry) !== null);
    if (pz.fixed[k]) return exitPort(pz.fixed[k], entry) !== null;
    if (placed[k]) {
      if (exitPort(placed[k], entry) !== null) return true;
      return canUpgradePlacedCellForEntry(k, entry);
    }
    return bs.has(k);
  }
  function candidates(c) {
    const k = pk(c.x, c.y);
    if (tm[k]) return [];
    const m = meta[k];
    let pool = m ? m.basicTracks.filter(t => exitPort(t, c.entry) !== null) : BASIC_BY_ENTRY[c.entry];
    const result = [];
    for (const tr of pool) {
      const ex = exitPort(tr, c.entry); if (!ex) continue;
      const nx = c.x + DELTA[ex][0], ny = c.y + DELTA[ex][1], ne = OPPOSITE[ex];
      if (isZeroCar(c) && nx === gx && ny === gy) continue;
      if (!cellCanAcceptDFS(nx, ny, ne)) continue;
      result.push(tr);
    }
    result.sort((a, b) => {
      const ea = exitPort(a, c.entry), eb = exitPort(b, c.entry);
      return (Math.abs(c.x + DELTA[ea][0] - gx) + Math.abs(c.y + DELTA[ea][1] - gy)) - (Math.abs(c.x + DELTA[eb][0] - gx) + Math.abs(c.y + DELTA[eb][1] - gy));
    });
    if (seed > 0 && result.length > 1) {
      let s = seed ^ (iters * 2654435761 >>> 0);
      for (let i = result.length - 1; i > 0; i--) { s = (s * 1664525 + 1013904223) & 0x7fffffff; const j = s % (i + 1); [result[i], result[j]] = [result[j], result[i]]; }
    }
    return result;
  }
  function findUpgrades(oldTrack, cx, cy, newEntry) {
    const k = pk(cx, cy), ups = [];
    for (const tn of T_TRACKS) {
      const ex = exitPort(tn, newEntry); if (!ex) continue;
      if (!trackSupportsUsages(tn, k, { entry: newEntry, exit: ex })) continue;
      const nx = cx + DELTA[ex][0], ny = cy + DELTA[ex][1];
      if (!cellCanAcceptDFS(nx, ny, OPPOSITE[ex])) continue;
      ups.push({ track: tn, exit: ex });
    }
    return ups;
  }

  function dfs(cars, arrived, step, visited, toggled, tsToggled, autoToggled, tsLocks, servedPlatforms) {
    if (iters++ > MAX) return; if (iters % 500000 === 0) self.postMessage({ type: "progress", iters: 500000 });
    if (arrived.length === _order.length && !cars.some(c => !isZeroCar(c))) {
      if (!allPlatformsServed(_platformState, servedPlatforms)) return;
      /* Validate via unified Rule Layer */
      const zs = zeroSafetyLookahead(pz, cars, { tracks: { ...pz.fixed, ...placed }, tm, triggers: _trigMap, barriers: _barMap, tswTriggers: _tswMap, tswitchMap: _tswitchMap, autoSwitchMap: _autoSwitchMap, toggled, tsToggled, autoToggled, tsLocks });
      if (zs.ok) {
        if (!validatePlacedTUsage()) return;
        const cost = Object.keys(placed).length - _prePlacedCount; if (!minTracks || cost <= bestCost) rememberSolution(cost); return;
      }
      /* zs.ok is false — fall through to let DFS continue placing tracks for the zero car.
         The cycle-at-visited detection below will catch valid zero-car cycles. */
    }
    const placedCount = Object.keys(placed).length;
    if (step > ms || placedCount > bestCost || (placedCount === bestCost && solutions.length >= MAX_ALTERNATES)) return;
    if (!minTracks && solutions.length >= Math.max(maxSol, MAX_ALTERNATES)) return;
    for (const c0 of cars) {
      const c = c0; const k = pk(c.x, c.y);
      if (c.wait > 0) continue;
      if (tm[k]) continue;
      if (_tswitchMap[k]) continue;
      if (_autoSwitchMap[k]) continue;
      if (pz.fixed[k]) continue;
      if (placed[k]) {
        const old = placed[k];
        const ex0 = exitPort(old, c.entry);
        const ups = findUpgrades(old, c.x, c.y, c.entry);
        for (const up of ups) {
          if (up.exit === ex0) continue;
          placed[k] = up.track;
          const undo = pushUsage(k, c.entry, up.exit);
          dfs(cars, arrived, step, visited, toggled, tsToggled, autoToggled, tsLocks, servedPlatforms); undo();
          placed[k] = old;
          if (!minTracks && solutions.length >= Math.max(maxSol, MAX_ALTERNATES)) return;
        }
        if (ex0 !== null) {
          if (!hasUsage(k, c.entry, ex0)) {
            const undo = pushUsage(k, c.entry, ex0);
            dfs(cars, arrived, step, visited, toggled, tsToggled, autoToggled, tsLocks, servedPlatforms); undo(); return;
          }
          continue;
        }
        return;
      }
      if (!bs.has(k)) return;
      const cands = candidates(c);
      for (const tr of cands) {
        if (Object.keys(placed).length + 1 > bestCost) continue;
        const ex = exitPort(tr, c.entry); if (!ex) continue;
        placed[k] = tr;
        const undo = pushUsage(k, c.entry, ex);
        dfs(cars, arrived, step, visited, toggled, tsToggled, autoToggled, tsLocks, servedPlatforms); undo();
        delete placed[k];
        if (!minTracks && solutions.length >= Math.max(maxSol, MAX_ALTERNATES)) return;
      }
      return;
    }
    /* Build visited key with FULL dynamic state */
    const sk = arrived.join(",") + "|" + cars.map(c => c.name + ":" + c.x + "," + c.y + "," + c.entry + ":" + (c.wait || 0)).sort().join("|") +
      (_hasBars ? "|T:" + Object.keys(toggled).filter(k => toggled[k]).sort().join(",") : "") +
      (_hasTS ? "|TS:" + Object.keys(tsToggled).filter(k => tsToggled[k]).sort().join(",") + "|L:" + Object.keys(tsLocks).sort().map(n => n + ":" + tsLocks[n].k + ":" + tsLocks[n].track).join(",") : "") +
      (_hasAuto ? "|A:" + Object.keys(autoToggled).filter(k => autoToggled[k]).sort().join(",") : "") +
      (_hasPlatforms ? "|P:" + [...servedPlatforms].sort().join(",") : "");
    if (visited.has(sk)) {
      if (arrived.length === _order.length && !cars.some(c => !isZeroCar(c))) {
        if (allPlatformsServed(_platformState, servedPlatforms) && validatePlacedTUsage()) {
          const cost = Object.keys(placed).length - _prePlacedCount;
          if (!minTracks || cost <= bestCost) rememberSolution(cost);
        }
      }
      return;
    }
    visited.add(sk);

    const nxt = [], na = [...arrived], _trgd = [], _tsTrgd = [], _autoUsed = [], _releaseTSLocks = new Set();
    const _nServed = _hasPlatforms ? new Set(servedPlatforms) : servedPlatforms;
    for (const c0 of cars) {
      const c = c0; const k = pk(c.x, c.y);
      if (c.wait > 0) { nxt.push({ ...c, wait: c.wait - 1 }); continue; }
      let nx, ny, ne, _usedTSLock = false, _usedAutoSwitch = false;
      if (tm[k]) {
        if (c.entry !== tm[k].facing) { visited.delete(sk); return; }
        const p = tm[k].pair;

        nx = p.x + DELTA[p.facing][0]; ny = p.y + DELTA[p.facing][1]; ne = OPPOSITE[p.facing];
      } else {
        /* Use effectiveTrackAt from Rule Layer — single source of truth */
        const _locked = tsLocks[c.name];
        const t = _locked && _locked.k === k ? _locked.track : effectiveTrackAt(k, { ...pz.fixed, ...placed }, _tswitchMap, tsToggled, _autoSwitchMap, autoToggled);
        _usedTSLock = !!(_locked && _locked.k === k);
        _usedAutoSwitch = !!_autoSwitchMap[k] && !_usedTSLock;
        if (!t) { visited.delete(sk); return; }
        const ex = exitPort(t, c.entry); if (!ex) { visited.delete(sk); return; }
        nx = c.x + DELTA[ex][0]; ny = c.y + DELTA[ex][1]; ne = OPPOSITE[ex];
      }
      if (nx === gx && ny === gy) {

        if (isZeroCar(c)) { visited.delete(sk); return; }
        if (!isZeroCar(c)) {
          if (ne !== ge) { visited.delete(sk); return; }
          if (carNeedsPassengers(_platformState, _nServed, c.name)) { visited.delete(sk); return; }
          na.push(c.name);
          const pfx = _order.slice(0, na.length);
          if (na.join(",") !== pfx.join(",")) { visited.delete(sk); return; }
        }
        if (_trigMap[pk(nx, ny)]) _trgd.push(_trigMap[pk(nx, ny)]);
        if (_tswMap[pk(nx, ny)]) _tsTrgd.push(_tswMap[pk(nx, ny)]);
        if (_usedAutoSwitch) _autoUsed.push(k);
        if (_usedTSLock) _releaseTSLocks.add(c.name);
        continue;
      }
      if (nx < 0 || nx >= pz.width || ny < 0 || ny >= pz.height) { visited.delete(sk); return; }
      const _nk = pk(nx, ny);
      if (_barMap[_nk]) {
        const _b = _barMap[_nk], _isT = toggled[_b.color] || false;
        const _cs = _b.initialState === 'closed' ? (_isT ? 'open' : 'closed') : (_isT ? 'closed' : 'open');
        if (_cs === 'closed') { nx = c.x; ny = c.y; ne = c.entry; }
      }
      if (nx !== c.x || ny !== c.y) {

        if (!isZeroCar(c) && !cellCanAcceptDFS(nx, ny, ne)) { visited.delete(sk); return; }
        if (_trigMap[_nk]) _trgd.push(_trigMap[_nk]);
        if (_tswMap[_nk]) _tsTrgd.push(_tswMap[_nk]);
        if (_usedAutoSwitch) _autoUsed.push(k);
        if (_usedTSLock) _releaseTSLocks.add(c.name);
      }
      let _wait = 0;
      if (!isZeroCar(c) && (nx !== c.x || ny !== c.y)) {
        const _pickup = platformPickupForCar(_platformState, _nServed, c.name, _nk);
        if (!_pickup.ok) { visited.delete(sk); return; }
        _wait = _pickup.wait;
      }
      nxt.push({ name: c.name, role: c.role, x: nx, y: ny, entry: ne, wait: _wait });
    }
    const occ = new Set();
    for (const c of nxt) {
      const k = pk(c.x, c.y); if (occ.has(k)) { visited.delete(sk); return; } occ.add(k);
      if (tm[k]) { const pkp = pk(tm[k].pair.x, tm[k].pair.y); if (occ.has(pkp)) { visited.delete(sk); return; } occ.add(pkp); }
    }
    let _tail = false;
    for (let i = 0; i < nxt.length && !_tail; i++) {
      const a = nxt[i]; const tax = a.x + DELTA[a.entry][0], tay = a.y + DELTA[a.entry][1];
      for (let j = i + 1; j < nxt.length; j++) {
        const b = nxt[j];
        if (b.x === tax && b.y === tay && b.entry === a.entry) { _tail = true; break; }
        const tbx = b.x + DELTA[b.entry][0], tby = b.y + DELTA[b.entry][1];
        if (a.x === tbx && a.y === tby && a.entry === b.entry) { _tail = true; break; }
      }
    }
    if (_tail) { visited.delete(sk); return; }

    const _blocked = occupiedBarrierColors(nxt, _barMap);
    const _nt = _hasBars && _trgd.length ? { ...toggled } : toggled;
    if (_trgd.length) for (const cl of _trgd) { if (!_blocked.has(cl)) _nt[cl] = !_nt[cl]; }
    const _nts = _hasTS && _tsTrgd.length ? { ...tsToggled } : tsToggled;
    const _locks = _hasTS ? { ...tsLocks } : tsLocks;
    if (_hasTS) for (const name of _releaseTSLocks) delete _locks[name];
    const _tsTrgdSet = new Set(_tsTrgd);
    if (_hasTS) for (const c of nxt) { const k = pk(c.x, c.y), sw = _tswitchMap[k]; if (sw && _tsTrgdSet.has(sw.color)) _locks[c.name] = { k, track: effectiveTSwitchTrack(sw, tsToggled) }; }
    if (_tsTrgd.length) for (const cl of _tsTrgd) _nts[cl] = !_nts[cl];
    const _nat = _hasAuto && _autoUsed.length ? { ...autoToggled } : autoToggled;
    if (_autoUsed.length) for (const k of _autoUsed) _nat[k] = !_nat[k];

    dfs(nxt, na, step + 1, visited, _nt, _nts, _nat, _locks, _nServed); visited.delete(sk);
  }

  dfs(pz.cars.map(c => ({ ...c, wait: c.wait || 0 })), [], 1, new Set(), {}, {}, {}, {}, new Set());
  return solutions.slice(0, Math.max(maxSol, MAX_ALTERNATES));
}

// ═══════════ Zero-Aware Solver (Hybrid) ═══════════

function solveZeroAware(pz, bs, meta, budget, seed) {
  /* Boost zeroSafetySteps for auto-switch puzzles — need enough steps for
     the zero car's cycle to repeat (state revisit). Use 2*(width+height)
     as a reasonable upper bound — large enough to detect cycles through
     auto-switch mazes without making DFS validation too expensive. */
  const boostedSafety = Math.max(zeroSafetySteps(pz), 2 * (pz.width + pz.height));
  const pzBoosted = { ...pz, zeroSafetySteps: boostedSafety };

  // Diagnosis is built inline from Phase 1/3 results to avoid redundant re-solves
  const diagnosis = { hasZero: true, hasAutoSwitch: true, normalOnlyResult: null, zeroCycleResult: null, compatResult: null };

  self.postMessage({ type: "progress", info: `Phase 1: Normal-first search (zeroSafety=${boostedSafety})...` });
  const normalPz = { ...pzBoosted, cars: pz.cars.filter(c => !isZeroCar(c)) };
  const normalSols = solveDFS(normalPz, 50, false, budget, seed, bs, meta);
  diagnosis.normalOnlyResult = { ok: normalSols.length > 0, count: normalSols.length };

  if (normalSols.length > 0) {
    self.postMessage({ type: "progress", info: `Phase 2: Validating ${normalSols.length} normal candidates with zero car...` });
    for (const nsol of normalSols) {
      const remainingBlanks = pz.blanks.filter(b => !nsol[pk(b[0], b[1])]);
      const remainingBs = new Set(remainingBlanks.map(b => pk(b[0], b[1])));
      // Pass full budget — solveDFS now subtracts prePlacedCount internally for cost
      const jointSols = solveDFS(pzBoosted, 1, false, budget, seed, remainingBs, meta, 15000000, nsol);
      if (jointSols.length > 0) {
        return { sol: jointSols[0], method: "zero-aware(normal->zero)", alternates: [jointSols[0]], diagnosis };
      }
    }
  }

  self.postMessage({ type: "progress", info: "Phase 3: Zero-first search..." });
  const zeroPz = { ...pzBoosted, cars: pz.cars.filter(c => isZeroCar(c)), order: [] };
  const zeroSols = solveDFS(zeroPz, 50, false, budget, seed, bs, meta);
  diagnosis.zeroCycleResult = { count: zeroSols.length };

  if (zeroSols.length > 0) {
    self.postMessage({ type: "progress", info: `Phase 4: Validating ${zeroSols.length} zero candidates with normal cars...` });
    for (const zsol of zeroSols) {
      const remainingBlanks = pz.blanks.filter(b => !zsol[pk(b[0], b[1])]);
      const remainingBs = new Set(remainingBlanks.map(b => pk(b[0], b[1])));
      const jointSols = solveDFS(pzBoosted, 1, false, budget, seed, remainingBs, meta, 15000000, zsol);
      if (jointSols.length > 0) {
        return { sol: jointSols[0], method: "zero-aware(zero->normal)", alternates: [jointSols[0]], diagnosis };
      }
    }
  }

  // Build compatibility diagnosis
  if (diagnosis.normalOnlyResult.ok && diagnosis.zeroCycleResult.count > 0) {
    diagnosis.compatResult = "auto-switch interaction conflict";
  } else {
    diagnosis.compatResult = !diagnosis.normalOnlyResult.ok ? "normal cars unsolvable" : "zero car cannot form cycle";
  }

  self.postMessage({ type: "progress", info: "Phase 5: Full Joint DFS fallback..." });
  const jointSols = solveDFS(pzBoosted, 1, false, budget, seed, bs, meta, 100000000);
  if (jointSols.length > 0) {
    return { sol: jointSols[0], method: "zero-aware(joint)", alternates: jointSols, diagnosis };
  }

  return { sol: null, method: "zero-aware-exhausted", alternates: [], diagnosis };
}

// ═══════════ Worker entry point ═══════════

self.onmessage = function (e) {
  const { type, puzzle: pz, seed, maxTracksHint } = e.data;
  if (type === "stop") { self.close(); return; }
  if (type !== "solve") return;
  const minTracks = pz._minTracks !== false;
  const { useful, meta, pruned } = filterBlanks(pz);
  const bs = new Set(useful.map(b => pk(b[0], b[1])));
  const budget = maxTracksHint > 0 ? Math.min(maxTracksHint, useful.length) : (minTracks ? Infinity : useful.length + 1);
  const fpz = { ...pz, blanks: useful };

  /* Feature detection from unified Rule Layer */
  const features = puzzleHasDynamicState(pz);

  self.postMessage({ type: "progress", iters: 0, pruned });
  
  /* Zero-Aware Hybrid Solver disabled: the phased approach (solve normal/zero
     cars separately then combine) fails for puzzles where car paths share
     auto-switch state. The regular CSP+DFS path handles zero cars correctly
     via simulate() and zeroSafetyLookahead() with native safety steps. */

  if (useful.length <= 45 && pz.cars.length <= 8) {
    /* Global triggers can flip remote state, which static CSP cannot model.
       Auto-switches are local state, so CSP still runs and simulate validates. */
    if (features.cspUnsafe) {
      self.postMessage({ type: "progress", iters: 0, cspInfo: "CSP skipped: global triggers (tswTrig=" + features.hasTSwTriggers + " barTrig=" + features.hasBarrierTriggers + ")" });
      const dfsResult = solveDFS(fpz, 1, minTracks, budget, seed || 0, bs, meta);
      self.postMessage({
        type: "done",
        method: dfsResult.length > 0 ? "dfs(skip-csp)" : "no-solution",
        pruned,
        alternates: dfsResult
      });
      return;
    }

    const slacks = pz.pathSlack ? [pz.pathSlack] : [4, 8, 14];
    let lastCsp = null, bestSol = null, bestAlternates = [], bestSlack = null, curBudget = budget;
    for (const slack of slacks) {
      const ppz = { ...fpz, pathSlack: slack };
      const csp = solveCSP(ppz, curBudget, bs, meta);
      lastCsp = csp;
      if (csp && csp.sol && (!bestSol || csp.sol.__cost < bestSol.__cost)) {
        bestSol = csp.sol;
        bestAlternates = csp.alternates || [csp.sol];
        bestSlack = slack;
        curBudget = csp.sol.__cost - 1;
      }
    }

    /* Dynamic local state (auto-switches) can make static CSP incomplete.
       Run CSP for candidates, but fall back to DFS unless the puzzle is static. */
    const cspTrustworthy = lastCsp && !lastCsp.overflow && !features.isDynamic;
    if (bestSol && cspTrustworthy) {
      self.postMessage({ type: "done", method: "csp(slack=" + bestSlack + ")", info: lastCsp.info, pruned, alternates: bestAlternates }); return;
    }
    if (!bestSol && cspTrustworthy) {
      self.postMessage({ type: "done", method: "csp-exhausted", info: lastCsp.info, pruned }); return;
    }

    function mergeAlternates(a, b) {
      const out = [], seen = new Set();
      function key(sol) { return Object.keys(sol).filter(k => k !== "__cost").sort().map(k => k + ":" + sol[k]).join("|"); }
      for (const list of [a, b]) for (const sol of list || []) {
        if (!sol) continue;
        const k = key(sol);
        if (seen.has(k)) continue;
        seen.add(k); out.push(sol);
        if (out.length >= MAX_ALTERNATES) return out;
      }
      return out;
    }

    const dfsBudget = bestSol ? bestSol.__cost : budget;
    const dfsResult = solveDFS(fpz, 1, minTracks, dfsBudget, seed || 0, bs, meta);
    const finalCost = dfsResult.length > 0 ? dfsResult[0].__cost : (bestSol ? bestSol.__cost : null);
    const alternates = mergeAlternates(bestAlternates, dfsResult);
    const method = bestSol ? (dfsResult.length > 0 && finalCost < bestSol.__cost ? "csp+dfs(csp=" + bestSol.__cost + ",dfs=" + finalCost + ")" : "csp+dfs(csp=" + bestSol.__cost + ",dfs-noimprove)") : (dfsResult.length > 0 ? "dfs" : "no-solution");
    self.postMessage({ type: "done", method, info: lastCsp ? lastCsp.info : "", pruned, alternates });
    return;
  }

  const dfsResult = solveDFS(fpz, 1, minTracks, budget, seed || 0, bs, meta);
  self.postMessage({ type: "done", method: "dfs", pruned, alternates: dfsResult });
};

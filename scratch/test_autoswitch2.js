// Full step-by-step simulation of the autoSwitch puzzle
const TRACKS = {
  "|": { N: "S", S: "N" }, "-": { E: "W", W: "E" },
  NE: { N: "E", E: "N" }, ES: { E: "S", S: "E" }, SW: { S: "W", W: "S" }, WN: { W: "N", N: "W" },
  T_NE_S: { S: "N", E: "N", N: "E" }, T_NE_W: { W: "E", N: "E", E: "N" },
  T_ES_N: { N: "S", E: "S", S: "E" }, T_ES_W: { W: "E", S: "E", E: "S" },
  T_SW_N: { N: "S", W: "S", S: "W" }, T_SW_E: { E: "W", S: "W", W: "S" },
  T_WN_E: { E: "W", N: "W", W: "N" }, T_WN_S: { S: "N", W: "N", N: "W" },
};
const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };
const DELTA = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const pk = (x, y) => `${x},${y}`;
function exitPort(t, e) { const r = TRACKS[t]; return r ? (r[e] || null) : null; }

const T_SWITCH_PAIRS = {
  T_NE_S: "T_ES_N", T_ES_N: "T_NE_S", T_NE_W: "T_WN_E", T_WN_E: "T_NE_W",
  T_ES_W: "T_SW_E", T_SW_E: "T_ES_W", T_SW_N: "T_WN_S", T_WN_S: "T_SW_N",
};

function runSim(placedTracks) {
  const autoToggled = {};
  const autoSwitchMap = {
    "2,1": { track: "T_ES_W", pair: "T_SW_E" },
    "3,1": { track: "T_SW_N", pair: "T_WN_S" },
    "2,2": { track: "T_ES_N", pair: "T_NE_S" },
    "3,2": { track: "T_WN_E", pair: "T_NE_W" },
  };
  const fixed = { "0,1": "-", "1,1": "-" };
  const allTracks = { ...fixed, ...placedTracks };
  const goal = [5, 2], goalEntry = "W";

  let cars = [
    { name: "2", x: 0, y: 1, entry: "W" },
    { name: "1", x: 1, y: 1, entry: "W" },
  ];
  const arrived = [];

  for (let t = 1; t <= 40; t++) {
    const nxt = [];
    const autoUsed = [];
    let fail = false;

    for (const c of cars) {
      const k = pk(c.x, c.y);
      let track;
      if (autoSwitchMap[k]) {
        const sw = autoSwitchMap[k];
        track = autoToggled[k] ? sw.pair : sw.track;
      } else {
        track = allTracks[k];
      }

      if (!track) { console.log(`  Step ${t}: Car ${c.name} at ${k}: NO TRACK!`); fail = true; break; }
      const ex = exitPort(track, c.entry);
      if (!ex) { console.log(`  Step ${t}: Car ${c.name} at ${k} [${track}] entry ${c.entry}: NO EXIT!`); fail = true; break; }
      const nx = c.x + DELTA[ex][0], ny = c.y + DELTA[ex][1], ne = OPPOSITE[ex];
      console.log(`  Step ${t}: Car ${c.name}: (${c.x},${c.y})[${track}] ${c.entry}→${ex} → (${nx},${ny}) entry ${ne}`);

      if (autoSwitchMap[k]) autoUsed.push(k);

      if (nx === goal[0] && ny === goal[1]) {
        if (ne !== goalEntry) { console.log(`    WRONG ENTRY!`); fail = true; break; }
        arrived.push(c.name);
        console.log(`    >> Car ${c.name} ARRIVED!`);
        continue;
      }
      if (nx < 0 || nx >= 6 || ny < 0 || ny >= 4) { console.log(`    OUT OF BOUNDS!`); fail = true; break; }
      nxt.push({ name: c.name, x: nx, y: ny, entry: ne });
    }
    if (fail) return false;

    // Check collision
    const positions = new Set();
    for (const c of nxt) {
      const k = pk(c.x, c.y);
      if (positions.has(k)) { console.log(`  Step ${t}: COLLISION at ${k}!`); return false; }
      positions.add(k);
    }

    // Toggle autoSwitches
    for (const k of autoUsed) {
      autoToggled[k] = !autoToggled[k];
      const sw = autoSwitchMap[k];
      console.log(`    >> auto ${k} toggled → ${autoToggled[k] ? sw.pair : sw.track}`);
    }

    cars = nxt;
    const orderCheck = ["1", "2"];
    const pfx = orderCheck.slice(0, arrived.length);
    if (arrived.join(",") !== pfx.join(",")) { console.log(`  ORDER WRONG: ${arrived.join(",")}`); return false; }
    if (arrived.length === 2 && cars.length === 0) {
      console.log(`\n✓ SOLVED in ${t} steps! Order: ${arrived.join(",")}`);
      return true;
    }
  }
  console.log("TIMEOUT");
  return false;
}

// From looking at screenshots carefully:
// Screenshot 1 (solved state with blue path for car1):
// Car1 blue path: loops through autoSwitches, goes down, loops right-up-left through top, 
// comes back down through toggled autoSwitches, exits east to goal.
// Car2 gold path: follows car1 through bottom-left loop area.

// Let me try a solution where:
// Car1 goes through autoSwitches (toggling all 4), loops through blanks, 
// comes back through toggled autoSwitches, then exits to goal.
// Car2 uses blanks to loop and delay, then follows a different path to goal.

// Attempt: read the screenshot more carefully
// Screenshot 1 blue path seems to trace:
// (1,1)→(2,1)→(3,1)→(3,2)→(2,2)→(2,3)→(3,3)→(4,3)→(4,2)→(4,1)→(4,0)→(3,0)→(3,1)[toggled]→(2,1)[toggled]→...

// Wait - that means car1 DOES revisit (3,1) and (2,1)!
// (3,1) toggled = T_WN_S. If entering from N (from 3,0): entry S. T_WN_S: S→N. Goes to (3,0)? Loop!
// That can't be right.

// Let me look at screenshot 1 differently. The blue line from (3,0) goes to (2,0), not (3,1).
// So maybe: ...(4,0)→(3,0)→(2,0)→(2,1)[toggled]
// (2,1) toggled = T_SW_E. Entry N (from 2,0 going S, entry = S). 
// T_SW_E: { E: 'W', S: 'W', W: 'S' }. Entry S → exit W. Goes to (1,1).
// (1,1) "-": entry E → exit W → (0,1).
// (0,1) "-": entry E → exit W → (-1,1). OUT OF BOUNDS!

// Hmm. Let me try entering (2,1) from the south (from 2,2).
// That would mean car1 goes through the autoswitch loop TWICE in different ways.

// Actually, I think I need to reconsider the path topology.
// Let me try: car1 goes through autoSwitches, loops around the outside,
// and enters the autoSwitch block from the EAST side, going through toggled switches
// to reach (4,2) → (5,2) goal.

// After toggling all 4 switches:
// (2,1)=T_SW_E, (3,1)=T_WN_S, (2,2)=T_NE_S, (3,2)=T_NE_W
// If car enters (3,2) from E (entry W): T_NE_W: W→E. Goes right to (4,2).
// Then (4,2) needs track going to (5,2). Blank "-" would work: W→E → (5,2) entry W. GOAL!

// So car1 needs to reach (3,2) from the EAST with entry W.
// That means coming from (4,2). But (4,2) goes to goal...
// Unless car1 enters (3,2) from N? Entry N, T_NE_W: N→E. Goes to (4,2). Then goal!
// Enter (3,2) from N means coming from (3,1) going S (entry N is from above).
// Wait: entry N means the car came from the North and entered from the N port.
// Coming from (3,1) going down: exit S from (3,1), arrive (3,2) with entry N.

// (3,1) toggled = T_WN_S: N→W. If entry N → exit W. Goes to (2,1), not (3,2).
// (3,1) toggled = T_WN_S: S→N, W→N, N→W.
// To exit S from (3,1), I need some entry that gives exit S. None of {S→N, W→N, N→W} gives S.
// So toggled (3,1) can't go south!

// What about entering (3,2) from the W (from 2,2)?
// (2,2) toggled = T_NE_S: S→N, E→N, N→E.
// From (2,2) to (3,2): need exit E from (2,2). Entry N → exit E. 
// So car needs to enter (2,2) from N (from 2,1 going S).
// (2,1) toggled = T_SW_E: E→W, S→W, W→S.
// From (2,1) to (2,2): need exit S from (2,1). Entry W → exit S! YES!
// So car enters (2,1) from W (from 1,1), gets exit S, goes to (2,2) entry N.
// Then (2,2) N→E, goes to (3,2) entry W.
// Then (3,2) W→E (T_NE_W), goes to (4,2).
// Then (4,2) needs "-" to go to (5,2). GOAL with entry W!

// But wait - how does car1 get back to (1,1) to enter (2,1) from W again?
// Car1 starts at (1,1). It goes through autoSwitches the first time.
// Then loops through blanks. Needs to reach (1,1) with entry W to do the above.
// (1,1) is fixed "-". Entry W → exit E → (2,1).

// So the full car1 path would be:
// (1,1)→(2,1)[T_ES_W:W→E]→(3,1)[T_SW_N:W→S]→(3,2)[T_WN_E:N→W]→(2,2)[T_ES_N:E→S]→(2,3)
// [all 4 toggled]
// →loop through blanks→ reach (1,2) or (1,1) somehow →
// →(2,1)[T_SW_E:W→S]→(2,2)[T_NE_S:N→E]→(3,2)[T_NE_W:W→E]→(4,2)[-:W→E]→(5,2) GOAL!
// [all 4 toggled again!]

// Car1 visits each autoSwitch TWICE! Each one toggles twice (back to original).
// The path enumeration can't handle this because of visited set.

// Now: where does car1 loop? From (2,3) it needs to get back to entry W at (2,1).
// That means reaching (1,1) with entry W, or reaching some cell west of (2,1).
// (2,3) → blanks → eventually → (1,2) → (1,1)[-:entry S? No, "-" only has E,W]
// Hmm. Need to get back to (1,1) with the right entry.

// Actually maybe the loop goes: (2,3)→(1,3)→(0,3)→(0,2)→(1,2)→(1,1)?
// But (1,1) is "-" which only has E/W. Coming from (1,2) means going N, entry S. 
// "-" has no S entry. Dead end.

// What about: (2,3)→(1,3)→(0,3)→(0,2)→(0,1)[-:entry S? No!]
// (0,1) is "-", only E/W.

// Hmm, maybe the loop goes UP through the top:
// (2,3)→(1,3)→(1,2)→(0,2)→(0,3)... no that's going the wrong way.
// Or: (2,3)→(3,3)→(4,3)→(4,2)... but we need (4,2) for the final stretch.

// Wait - maybe car1 uses T-junctions on blanks! The solver currently only places
// BASIC tracks during path enumeration's initial phase. But T-tracks are needed
// when the same cell is used by multiple paths.

// Actually let me re-examine: maybe car1 doesn't need to revisit autoSwitches.
// Maybe car2 goes through toggled switches to reach goal, and car1 uses a different route.

console.log("=== Attempt: Car1 avoids revisiting autoSwitches ===");
console.log("Car1 goes through autoSwitches once, loops, and reaches goal via blanks only.");
console.log("Car1: (1,1)→(2,1)→(3,1)→(3,2)→(2,2)→(2,3)→...→(4,2)→(5,2)");
console.log("");

// Car1 path after (2,3): needs to reach (4,2)→(5,2).
// (2,3)→(3,3)→(4,3)→(4,2)→(5,2) with blanks "-","-","WN","-"
// WN at (4,3): W→N. Coming from (3,3) entry W. W→N, goes to (4,2). Then "-" W→E → goal.
// Let's check timing vs car2.

// Car2 path: (0,1)→(1,1)→(2,1)[toggled]→... 
// Car2 enters (2,1) after car1 has passed through, so (2,1) is toggled to T_SW_E.
// T_SW_E: W→S. Goes to (2,2).
// (2,2) is toggled to T_NE_S. Entry N → exit E. Goes to (3,2).
// (3,2) is toggled to T_NE_W. Entry W → exit E. Goes to (4,2).
// But car1 might be at (4,2) at the same time!

// Let's check timing:
// Car1: step1→(2,1), step2→(3,1), step3→(3,2), step4→(2,2), step5→(2,3),
//        step6→(3,3), step7→(4,3), step8→(4,2), step9→(5,2) GOAL
// Car2: step1→(1,1), step2→(2,1)[tog], step3→(2,2)[tog], step4→(3,2)[tog], step5→(4,2)
// At step5, car2 is at (4,2), car1 is at (2,3). No collision.
// step5: car2 at (4,2), car1 at (2,3) — OK
// step6: car2 needs track at (4,2). If (4,2)="-", entry W→E → (5,2) GOAL
// step6: car1 at (3,3) — OK
// Car2 arrives at step6, car1 arrives at step9.
// Order check: car2 arrives first but order requires car1 first! FAIL!

// So car2 arrives TOO EARLY. Car1 needs to arrive before car2.
// Car2 needs to be DELAYED somehow. Car1 needs a SHORTER path, or car2 a longer one.

// What if car2 loops through the bottom-left before going through autoSwitches?
// Car2: (0,1)→(1,1)→ need to NOT enter (2,1) immediately.
// But (1,1) is "-" (E/W only). Entry W→E → must go to (2,1). No choice.

// Unless car2 goes backward? No, car2 enters from W, "-" sends it E.

// What if car1 takes a shortcut and car2 takes the long loop?
// Car1 could go through autoSwitches directly to (4,2)→goal:
// (1,1)→(2,1)[T_ES_W:W→E]→(3,1)[T_SW_N:W→S? No, entry is W]
// Wait: T_SW_N: { N:'S', W:'S', S:'W' }. Entry W → exit S. Goes to (3,2).
// (3,2) T_WN_E: entry N → exit W. Goes to (2,2). That's backwards.
// Alternatively, from (3,1) can we go N? T_SW_N with entry W gives S, not N.

// Maybe car1 should NOT go through all 4 autoSwitches in one pass.
// Let me reconsider what routes each autoSwitch offers:
// (2,1) T_ES_W default: W→E, S→E, E→S
// (3,1) T_SW_N default: N→S, W→S, S→W
// (2,2) T_ES_N default: N→S, E→S, S→E
// (3,2) T_WN_E default: E→W, N→W, W→N

// From (2,1) entry W: goes E to (3,1)
// From (3,1) entry W: goes S to (3,2)
// From (3,2) entry N: goes W to (2,2)
// From (2,2) entry E: goes S to (2,3)
// This is the only path through the default switches from the left side.

// After toggle: (2,1)=T_SW_E, (3,1)=T_WN_S, (2,2)=T_NE_S, (3,2)=T_NE_W
// From (2,1) entry W: T_SW_E W→S, goes to (2,2)
// From (2,2) entry N: T_NE_S N→E, goes to (3,2)  
// From (3,2) entry W: T_NE_W W→E, goes to (4,2)
// This is the SHORT path through toggled switches!

// So: car1 goes through DEFAULT switches (long loop through all 4), 
// toggles them all. Then car2 goes through TOGGLED switches (shortcut: 
// (2,1)→(2,2)→(3,2)→(4,2)→goal).
// But car2 must arrive AFTER car1. Car2's path is short (arrives ~step 6).
// Car1's path through blanks is long.

// The key question: can we make car1's path FASTER than car2's path?
// car1 path length through autoSwitches + blanks to goal = at least 9 steps.
// car2 is 1 step behind (starts at 0,1 vs 1,1).
// car2 direct path = (0,1)→(1,1)→(2,1)→(2,2)→(3,2)→(4,2)→(5,2) = 6 steps.
// car1 arrives step 9, car2 arrives step 6. Car2 is first. WRONG ORDER!

// So car2 needs to be delayed. How? By putting car2 on a longer path.
// But car2 MUST go through (0,1)→(1,1)→(2,1). No choice (fixed tracks).
// After (2,1) toggled, car2 goes to (2,2). From there it could be redirected...
// But (2,2) is also toggled and routes are fixed.

// WAIT. The autoSwitches toggle when a car passes through.
// Car1 passes through (2,1) first, toggling it. 
// Car2 passes through (2,1) next, AND TOGGLES IT BACK!
// Then car2 passes through (2,2), toggling it again, etc.

// So when car2 enters (2,1) (now T_SW_E), after passing, it toggles BACK to T_ES_W!
// This doesn't affect car2's route at (2,1) (it already exited), but it affects
// what (2,1) looks like if car1 comes back later.

// For this puzzle, the toggling sequence matters a lot.
// Car1 is always 1 step ahead of car2 (since car1 starts at x=1, car2 at x=0).

// Let me trace both simultaneously:
console.log("\n=== Simultaneous trace (default blanks attempt) ===");
const p1 = {
  "2,3": "-", "3,3": "-", "4,3": "WN", "4,2": "-",
  "4,1": "SW", "4,0": "WN", "3,0": "-", "2,0": "SW",
  "0,2": "NE", "1,2": "SW", "0,3": "NE", "1,3": "-",
};
console.log("Placed:", JSON.stringify(p1));
const ok = runSim(p1);
if (!ok) {
  console.log("\n=== Try another placement ===");
  const p2 = {
    "2,3": "NE", "3,3": "-", "4,3": "WN", "4,2": "-",
    "4,1": "|", "4,0": "SW", "3,0": "-", "2,0": "SW",
    "0,2": "NE", "1,2": "SW", "0,3": "NE", "1,3": "-",
  };
  console.log("Placed:", JSON.stringify(p2));
  runSim(p2);
}

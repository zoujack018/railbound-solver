// zero-aware implementation code
export function diagnoseSolveFailure(pz, bs, meta) {
  const features = puzzleHasDynamicState(pz);
  const diag = {
    hasZero: features.hasZero,
    hasAutoSwitch: features.hasAutoSwitch,
    normalOnlyResult: null,
    zeroCycleResult: null,
    compatResult: null,
  };
  if (!features.hasZero) return diag;

  const normalPz = { ...pz, cars: pz.cars.filter(c => !isZeroCar(c)) };
  const normalSols = solveDFS(normalPz, 1, false, 999, 0, bs, meta);
  diag.normalOnlyResult = { ok: normalSols.length > 0, count: normalSols.length };

  const zeroPz = { ...pz, cars: pz.cars.filter(c => isZeroCar(c)), order: [] };
  const zeroSols = solveDFS(zeroPz, 1, false, 999, 0, bs, meta);
  diag.zeroCycleResult = { count: zeroSols.length };

  if (diag.normalOnlyResult.ok && diag.zeroCycleResult.count > 0) {
    diag.compatResult = "requires joint search";
  } else {
    diag.compatResult = "pre-reqs failed";
  }
  return diag;
}

export function solveZeroAware(pz, bs, meta, budget, seed) {
  // Phase 1: Zero-cycle-first
  // Since zero car uses auto-switches heavily, let's find zero cycles first.
  const zeroPz = { ...pz, cars: pz.cars.filter(c => isZeroCar(c)), order: [], goal: [-1, -1] };
  // But wait, zero car DFS will try to place tracks everywhere.
  
  return { sol: null, method: "zero-aware-exhausted" };
}

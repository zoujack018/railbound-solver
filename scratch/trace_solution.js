/**
 * Test the new error reporting mechanism.
 */
import { simulate, formatSimError, pk } from "../railbound-rules.js";
import fs from "fs";

const pz = JSON.parse(fs.readFileSync("scratch/test_zero_aware.json", "utf8"));

// Test 1: A valid solution
console.log("=== Test 1: Valid solution ===");
const goodSol = { "3,6": "|", "3,5": "T_WN_S", "2,4": "T_ES_N", "2,5": "NE", "3,3": "SW", "2,3": "ES" };
const r1 = simulate(pz, goodSol);
console.log(formatSimError(r1));
console.log("Detail:", JSON.stringify(r1.detail, null, 2));

// Test 2: Missing track
console.log("\n=== Test 2: Missing track (empty placement) ===");
const r2 = simulate(pz, {});
console.log(formatSimError(r2));
console.log("Detail:", JSON.stringify(r2.detail, null, 2));

// Test 3: Wrong order — partially filled
console.log("\n=== Test 3: Wrong port match ===");
const r3 = simulate(pz, { "4,2": "|" });  // car 3 enters N but | wants N→S, should work but next cell may fail
console.log(formatSimError(r3));
console.log("Detail:", JSON.stringify(r3.detail, null, 2));

// Test 4: A known tailing error
console.log("\n=== Test 4: Known solution that causes tailing ===");
const tailSol = {
  "4,2": "NE", "2,4": "-", "6,4": "T_ES_N", "5,2": "SW", "6,5": "WN",
  "5,3": "NE", "3,5": "|", "5,5": "ES", "6,3": "SW", "3,6": "T_ES_N",
  "5,6": "WN", "4,6": "-", "3,8": "NE", "4,8": "-"
};
const r4 = simulate(pz, tailSol);
console.log(formatSimError(r4));
console.log("Detail:", JSON.stringify(r4.detail, null, 2));

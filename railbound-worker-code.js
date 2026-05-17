/* Worker creation — uses Vite's built-in worker bundling.
 * The actual solver code lives in railbound-worker.js,
 * which imports rules from the shared railbound-rules.js.
 * No more duplicated template strings.
 */

export function createWorkerBlob() {
  return new URL("./railbound-worker.js", import.meta.url);
}

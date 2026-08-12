// Test planner: node scripts/test-planner.mjs (butuh esbuild transpile dulu)
import { planTrip } from "../src/lib/planner";
const cases = [
  ["CLT", "JNG"], ["BKS", "THB"], ["BOO", "MTR"], ["CW", "SUD"], ["TNG", "JAKK"],
];
let fail = 0;
for (const [a, b] of cases) {
  const opts = planTrip(a, b);
  const has = opts.length > 0;
  if (!has) fail++;
  console.log(`${a} -> ${b}: ${opts.length} opsi` + (opts[0] ? ` [${opts[0].label}] ±${opts[0].totalMinutes}mnt Rp${opts[0].totalCost.toLocaleString("id-ID")}` : ""));
}
console.log(fail ? `\nFAIL ${fail}/${cases.length}` : `\nALL OK ${cases.length}/${cases.length}`);
process.exit(fail ? 1 : 0);

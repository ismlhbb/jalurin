import { planTrip } from "../src/lib/planner.ts";

const cases: {
  label: string;
  from: [number, number];
  to: [number, number];
  fromLabel: string;
  toLabel: string;
  pref: "cheapest" | "fastest" | "min_transit" | "min_walk";
}[] = [
  {
    label: "Bekasi Timur → Sudirman (cheapest)",
    from: [-6.2468, 107.0181],
    to: [-6.2002, 106.8227],
    fromLabel: "Bekasi Timur",
    toLabel: "Sudirman",
    pref: "cheapest",
  },
  {
    label: "Cilebut → Jatinegara (fastest)",
    from: [-6.5307, 106.8007],
    to: [-6.2156, 106.8681],
    fromLabel: "Cilebut",
    toLabel: "Jatinegara",
    pref: "fastest",
  },
  {
    label: "Bogor → Manggarai (min_transit)",
    from: [-6.5971, 106.806],
    to: [-6.2101, 106.8503],
    fromLabel: "Bogor",
    toLabel: "Manggarai",
    pref: "min_transit",
  },
];

for (const c of cases) {
  console.log(`\n=== ${c.label} ===`);
  const opts = planTrip(c.from, c.to, c.fromLabel, c.toLabel, c.pref);
  if (!opts.length) {
    console.log("  (ga ada rute)");
    continue;
  }
  for (const o of opts) {
    console.log(
      `  [${o.label}] ±${o.totalMinutes}mnt Rp${o.totalCost.toLocaleString("id-ID")} (${o.transfers} transit)`,
    );
    for (const l of o.legs) {
      console.log(
        `    - ${l.mode} ${l.from_name || l.from} → ${l.to_name || l.to} (±${l.minutes}mnt, Rp${l.cost})`,
      );
    }
  }
}

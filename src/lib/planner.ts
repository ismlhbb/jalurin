import transjakarta from "../data/transjakarta.json";
import plannerGraph from "../data/planner-graph.json";

type TjStop = { id: string; name: string; lat: number; lon: number };
type TjRoute = { id: string; name: string; stops: string[] };

const tj = transjakarta as { stops: TjStop[]; routes: TjRoute[] };
const graph = plannerGraph as unknown as {
  stations: Record<string, { name: string }>;
  krl_coords: Record<string, [number, number]>;
  edges: { a: string; b: string; line: string }[];
  transfers: Record<string, string>;
};

export type TripMode = "krl" | "tj" | "gojek";

export type TripLeg = {
  mode: TripMode;
  route?: string;
  from: string;
  to: string;
  from_name?: string;
  to_name?: string;
  stops?: string[];
  minutes?: number;
  cost?: number;
  note?: string;
};

export type TripOption = {
  label: string;
  desc: string;
  totalMinutes: number;
  totalCost: number;
  transfers: number;
  legs: TripLeg[];
};

// ---- data lookup ----
const STOP_NAME: Record<string, string> = {};
for (const s of tj.stops) STOP_NAME[s.id] = s.name;

const STOP_ROUTES: Record<string, string[]> = {};
for (const r of tj.routes) {
  for (const s of r.stops) (STOP_ROUTES[s] ??= []).push(r.id);
}
const ROUTE_BY_ID: Record<string, TjRoute> = {};
for (const r of tj.routes) ROUTE_BY_ID[r.id] = r;

const KRL_NAME = (id: string) => graph.stations[id]?.name ?? id;
const KRL_COORD = (id: string): [number, number] | undefined => graph.krl_coords[id];
const TJ_STOP = (id: string): TjStop | undefined => tj.stops.find((s) => s.id === id);

// ---- geo ----
function haversineKm(
  a: [number, number],
  b: [number, number],
): number {
  const R = 6371;
  const p1 = (a[0] * Math.PI) / 180;
  const p2 = (b[0] * Math.PI) / 180;
  const dp = ((b[0] - a[0]) * Math.PI) / 180;
  const dl = ((b[1] - a[1]) * Math.PI) / 180;
  const h =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---- harga ----
// KRL Commuter Line: flat Rp3.000 (2024, non-subsidi mulai 2025 ± Rp5.000)
const KRL_COST = 3000;
// Transjakarta: flat Rp3.500
const TJ_COST = 3500;
// Gojek: estimasi Rp2.500 flagfall + Rp3.000/km (jauh > 2km)
function gojekCost(km: number) {
  return Math.round(2500 + km * 3000);
}
// waktu gojek: 25 km/jam di kota (macet)
function gojekMinutes(km: number) {
  return Math.max(5, Math.round((km / 25) * 60) + 3);
}

// ---- KRL graph ----
const KRL_ADJ: Record<string, { nb: string; line: string }[]> = {};
for (const e of graph.edges) {
  (KRL_ADJ[e.a] ??= []).push({ nb: e.b, line: e.line });
  (KRL_ADJ[e.b] ??= []).push({ nb: e.a, line: e.line });
}

// BFS/DFS antar stasiun KRL — return jalur (tanpa waktu real, estimasi per edge)
function krlPath(from: string, to: string): { station: string; line: string }[] | null {
  if (from === to) return [{ station: from, line: "" }];
  const prev: Record<string, { station: string; line: string } | null> = {
    [from]: null,
  };
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === to) break;
    for (const { nb, line } of KRL_ADJ[cur] ?? []) {
      if (!(nb in prev)) {
        prev[nb] = { station: cur, line };
        q.push(nb);
      }
    }
  }
  if (!(to in prev)) return null;
  // reconstruct
  const path: { station: string; line: string }[] = [];
  let cur: string | null = to;
  while (cur) {
    const p: { station: string; line: string } | null = prev[cur];
    path.unshift({ station: cur, line: p?.line ?? "" });
    cur = p?.station ?? null;
  }
  return path;
}

// estimasi durasi KRL per segmen (2 stasiun berurutan)
function krlSegmentMinutes(a: string, b: string) {
  const ca = KRL_COORD(a);
  const cb = KRL_COORD(b);
  if (ca && cb) {
    const km = haversineKm(ca, cb);
    // KRL ~45 km/jam avg + 2 mnt dwell
    return Math.max(3, Math.round((km / 45) * 60) + 2);
  }
  return 6;
}

function krlLegMinutes(stations: { station: string }[]) {
  let m = 0;
  for (let i = 0; i < stations.length - 1; i++) {
    m += krlSegmentMinutes(stations[i].station, stations[i + 1].station);
  }
  return m;
}

// ---- TJ path: BFS koridor ----
function tjPath(fromStop: string, toStop: string): TripLeg[] {
  if (fromStop === toStop) return [];
  const q: Array<{ stop: string; route: string; legs: TripLeg[] }> = [];
  const seen = new Set<string>();
  for (const rid of STOP_ROUTES[fromStop] ?? []) {
    q.push({
      stop: fromStop,
      route: rid,
      legs: [{ mode: "tj" as const, route: rid, from: fromStop, to: fromStop, stops: [fromStop] }],
    });
    seen.add(`${fromStop}|${rid}`);
  }
  let best: TripLeg[] | null = null;
  while (q.length) {
    const { stop, route, legs } = q.shift()!;
    const seq = ROUTE_BY_ID[route]?.stops ?? [];
    const i = seq.indexOf(stop);
    if (i < 0) continue;
    const extend = (nxt: string, forward: boolean) => {
      const legs2 = legs.map((l) => ({
        ...l,
        stops: l.stops ? [...l.stops] : undefined,
      }));
      const last = legs2[legs2.length - 1];
      if (forward) {
        last.stops = [...(last.stops ?? []), nxt];
        last.to = nxt;
      } else {
        last.stops = [nxt, ...(last.stops ?? [])];
        last.from = nxt;
      }
      if (nxt === toStop) {
        if (!best || legs2.reduce((a, l) => a + (l.stops?.length ?? 0), 0) < best.reduce((a, l) => a + (l.stops?.length ?? 0), 0)) {
          best = legs2;
        }
        return;
      }
      for (const rid2 of STOP_ROUTES[nxt] ?? []) {
        if (rid2 !== route && !seen.has(`${nxt}|${rid2}`)) {
          seen.add(`${nxt}|${rid2}`);
          const legs3 = legs2.map((l) => ({ ...l, stops: l.stops ? [...l.stops] : undefined }));
          legs3.push({ mode: "tj" as const, route: rid2, from: nxt, to: nxt, stops: [nxt] });
          q.push({ stop: nxt, route: rid2, legs: legs3 });
        }
      }
    };
    for (let j = i + 1; j < seq.length; j++) extend(seq[j], true);
    for (let j = i - 1; j >= 0; j--) extend(seq[j], false);
  }
  if (!best) return [];
  const bestLegs: TripLeg[] = best;
  return bestLegs.map((l) => {
    const st = l.stops ?? [l.from, l.to];
    let m = 0;
    for (let i = 0; i < st.length - 1; i++) {
      const s1 = TJ_STOP(st[i]);
      const s2 = TJ_STOP(st[i + 1]);
      if (s1 && s2) {
        const km = haversineKm([s1.lat, s1.lon], [s2.lat, s2.lon]);
        m += Math.max(2, Math.round((km / 20) * 60 + 2));
      } else {
        m += 4;
      }
    }
    return { ...l, from_name: STOP_NAME[l.from] ?? l.from, to_name: STOP_NAME[l.to] ?? l.to, minutes: m, cost: TJ_COST };
  });
}

// ---- helper gojek leg ----
function gojekLeg(from: [number, number], to: [number, number], fromName: string, toName: string): TripLeg {
  const km = haversineKm(from, to);
  return {
    mode: "gojek",
    from: fromName,
    to: toName,
    from_name: fromName,
    to_name: toName,
    minutes: gojekMinutes(km),
    cost: gojekCost(km),
    note: `Gojek ±${km.toFixed(1)} km`,
  };
}

// ---- main plan ----
export function planTrip(
  fromStation: string,
  toStation: string,
): TripOption[] {
  if (fromStation === toStation) return [];
  const results: TripOption[] = [];

  const fromCoord = KRL_COORD(fromStation);
  const toCoord = KRL_COORD(toStation);
  if (!fromCoord || !toCoord) return [];

  const fromTransit = graph.transfers[fromStation];
  const toTransit = graph.transfers[toStation];

  // ===== Opsi A: Gojek langsung (termurah buat jarak dekat / ga ada transit) =====
  {
    const km = haversineKm(fromCoord, toCoord);
    const leg = gojekLeg(fromCoord, toCoord, KRL_NAME(fromStation), KRL_NAME(toStation));
    results.push({
      label: "Gojek Langsung",
      desc: `${km.toFixed(1)} km langsung`,
      totalMinutes: leg.minutes ?? 0,
      totalCost: leg.cost ?? 0,
      transfers: 0,
      legs: [leg],
    });
  }

  // ===== Opsi B: KRL + TJ + Gojek (multimodal) =====
  // pattern: KRL(from) -> transit TJ -> TJ -> gojek -> dest
  // atau KRL penuh kalau 2 stasiun terhubung
  const krl = krlPath(fromStation, toStation);
  if (krl) {
    const minutes = krlLegMinutes(krl);
    results.push({
      label: "KRL Langsung",
      desc: `${krl.length - 1} stasiun`,
      totalMinutes: minutes,
      totalCost: KRL_COST,
      transfers: 0,
      legs: [
        {
          mode: "krl",
          from: fromStation,
          to: toStation,
          from_name: KRL_NAME(fromStation),
          to_name: KRL_NAME(toStation),
          stops: krl.map((k) => k.station),
          minutes,
          cost: KRL_COST,
        },
      ],
    });
  }

  // multimodal: KRL -> TJ transfer
  if (fromTransit && toTransit) {
    const tjLegs = tjPath(fromTransit, toTransit);
    if (tjLegs.length) {
      const krl1 = krlPath(fromStation, graph.transfers[fromStation]);
      const krl2 = krlPath(graph.transfers[toStation], toStation);
      const legs: TripLeg[] = [];
      if (krl1 && krl1.length > 1) {
        const m = krlLegMinutes(krl1);
        legs.push({
          mode: "krl",
          from: fromStation,
          to: krl1[krl1.length - 1].station,
          from_name: KRL_NAME(fromStation),
          to_name: STOP_NAME[fromTransit] ?? fromTransit,
          stops: krl1.map((k) => k.station),
          minutes: m,
          cost: KRL_COST,
          note: `naik KRL ke ${STOP_NAME[fromTransit] ?? fromTransit}`,
        });
      }
      legs.push(...tjLegs);
      if (krl2 && krl2.length > 1) {
        const m = krlLegMinutes(krl2);
        legs.push({
          mode: "krl",
          from: krl2[0].station,
          to: toStation,
          from_name: STOP_NAME[toTransit] ?? toTransit,
          to_name: KRL_NAME(toStation),
          stops: krl2.map((k) => k.station),
          minutes: m,
          cost: KRL_COST,
          note: `lanjut KRL ke ${KRL_NAME(toStation)}`,
        });
      }
      const totalMinutes = legs.reduce((a, l) => a + (l.minutes ?? 0), 0);
      const totalCost = legs.reduce((a, l) => a + (l.cost ?? 0), 0);
      const transfers = legs.filter((l, i) => i > 0 && (l.mode !== legs[i - 1].mode || l.route !== legs[i - 1].route)).length;
      results.push({
        label: "KRL + Transjakarta",
        desc: `via ${STOP_NAME[fromTransit] ?? fromTransit} → ${STOP_NAME[toTransit] ?? toTransit}`,
        totalMinutes,
        totalCost,
        transfers,
        legs,
      });
    }
  }

  // ===== Opsi C: KRL + Gojek (last mile) =====
  if (fromTransit) {
    const krl1 = krlPath(fromStation, graph.transfers[fromStation]);
    if (krl1 && krl1.length > 1) {
      const mid = krl1[krl1.length - 1].station;
      const midCoord = KRL_COORD(mid);
      const legs: TripLeg[] = [];
      legs.push({
        mode: "krl",
        from: fromStation,
        to: mid,
        from_name: KRL_NAME(fromStation),
        to_name: KRL_NAME(mid),
        stops: krl1.map((k) => k.station),
        minutes: krlLegMinutes(krl1),
        cost: KRL_COST,
      });
      if (midCoord && toCoord) {
        legs.push(gojekLeg(midCoord, toCoord, KRL_NAME(mid), KRL_NAME(toStation)));
      }
      if (legs.length > 1) {
        results.push({
          label: "KRL + Gojek",
          desc: `turun di ${KRL_NAME(mid)}, lanjut Gojek`,
          totalMinutes: legs.reduce((a, l) => a + (l.minutes ?? 0), 0),
          totalCost: legs.reduce((a, l) => a + (l.cost ?? 0), 0),
          transfers: 1,
          legs,
        });
      }
    }
  }

  // ===== sort + label kriteria =====
  const sorted = [...results].sort((a, b) => a.totalMinutes - b.totalMinutes);
  const cheapest = [...results].sort((a, b) => a.totalCost - b.totalCost)[0];
  const fastest = [...results].sort((a, b) => a.totalMinutes - b.totalMinutes)[0];
  const practical = [...results].sort(
    (a, b) => a.totalMinutes * 0.6 + a.totalCost * 0.4 - (b.totalMinutes * 0.6 + b.totalCost * 0.4),
  )[0];

  // annotate label
  for (const r of results) {
    if (r === cheapest) r.label = `${r.label} · Termurah`;
    if (r === fastest && fastest !== cheapest) r.label = `${r.label} · Tercepat`;
    if (r === practical && practical !== cheapest && practical !== fastest) {
      r.label = `${r.label} · Terpraktis`;
    }
  }
  return sorted;
}

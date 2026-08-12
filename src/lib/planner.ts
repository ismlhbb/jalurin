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

export type TripMode = "krl" | "tj" | "goride";

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
  walk_km?: number;
  note?: string;
};

export type TripOption = {
  label: string;
  desc: string;
  totalMinutes: number;
  totalCost: number;
  transfers: number;
  walkKm: number;
  legs: TripLeg[];
};

export type Pref = "min_transit" | "min_walk" | "cheapest" | "fastest";

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
const KRL_COORD = (id: string): [number, number] | undefined =>
  graph.krl_coords[id];
const TJ_STOP = (id: string): TjStop | undefined =>
  tj.stops.find((s) => s.id === id);

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

// ---- harga real (Jabodetabek, 2024/2025) ----
// KRL Commuter Line: tarif per km, jarak <=25km = Rp3.000, >25km naik bertahap
function krlCost(distanceKm: number) {
  if (distanceKm <= 25) return 3000;
  if (distanceKm <= 30) return 4500;
  return 6000;
}
// Transjakarta: flat Rp3.500 (non-AC) / Rp5.000 (AC)
const TJ_COST = 3500;
// GoRide: flagfall Rp8.000 + Rp2.500/km, minimal Rp12.000 (realistis Jabodetabek)
function goRideCost(km: number) {
  return Math.max(12000, Math.round(8000 + km * 2500));
}
// GoRide waktu: 20 km/jam di kota (macet Jakarta) + 3 mnt order
function goRideMinutes(km: number) {
  return Math.max(6, Math.round((km / 20) * 60) + 5);
}

// ---- KRL graph ----
const KRL_ADJ: Record<string, { nb: string; line: string }[]> = {};
for (const e of graph.edges) {
  (KRL_ADJ[e.a] ??= []).push({ nb: e.b, line: e.line });
  (KRL_ADJ[e.b] ??= []).push({ nb: e.a, line: e.line });
}

function krlPath(
  from: string,
  to: string,
): { station: string; line: string }[] | null {
  if (from === to) return [{ station: from, line: "" }];
  // Dijkstra dengan bobot = menit (bukan jumlah stop)
  const dist: Record<string, number> = { [from]: 0 };
  const prev: Record<string, { station: string; line: string } | null> = {
    [from]: null,
  };
  const pq: string[] = [from];
  while (pq.length) {
    pq.sort((a, b) => (dist[a] ?? Infinity) - (dist[b] ?? Infinity));
    const cur = pq.shift()!;
    if (cur === to) break;
    for (const { nb, line } of KRL_ADJ[cur] ?? []) {
      const w = krlSegmentMinutes(cur, nb);
      const nd = (dist[cur] ?? 0) + w;
      if (nd < (dist[nb] ?? Infinity)) {
        dist[nb] = nd;
        prev[nb] = { station: cur, line };
        pq.push(nb);
      }
    }
  }
  if (!(to in prev)) return null;
  const path: { station: string; line: string }[] = [];
  let cur: string | null = to;
  while (cur) {
    const p: { station: string; line: string } | null = prev[cur];
    path.unshift({ station: cur, line: p?.line ?? "" });
    cur = p?.station ?? null;
  }
  return path;
}

function krlSegmentMinutes(a: string, b: string) {
  const ca = KRL_COORD(a);
  const cb = KRL_COORD(b);
  if (ca && cb) {
    const km = haversineKm(ca, cb);
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
      legs: [
        {
          mode: "tj" as const,
          route: rid,
          from: fromStop,
          to: fromStop,
          stops: [fromStop],
        },
      ],
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
        const len = legs2.reduce((a, l) => a + (l.stops?.length ?? 0), 0);
        const corr = legs2.length; // jumlah koridor = jumlah leg
        if (
          !best ||
          corr * 20 + len <
            best.length * 20 +
              best.reduce((a, l) => a + (l.stops?.length ?? 0), 0)
        ) {
          best = legs2;
        }
        return;
      }
      for (const rid2 of STOP_ROUTES[nxt] ?? []) {
        if (rid2 !== route && !seen.has(`${nxt}|${rid2}`)) {
          // limit maksimal 2 koridor (1 ganti) — lebih dari itu ga praktis
          if (legs.length >= 2) continue;
          seen.add(`${nxt}|${rid2}`);
          const legs3 = legs2.map((l) => ({
            ...l,
            stops: l.stops ? [...l.stops] : undefined,
          }));
          legs3.push({
            mode: "tj" as const,
            route: rid2,
            from: nxt,
            to: nxt,
            stops: [nxt],
          });
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
    return {
      ...l,
      from_name: STOP_NAME[l.from] ?? l.from,
      to_name: STOP_NAME[l.to] ?? l.to,
      minutes: m,
      cost: TJ_COST,
    };
  });
}

// ---- GoRide leg ----
function goRideLeg(
  fromName: string,
  toName: string,
  fromCoord: [number, number],
  toCoord: [number, number],
): TripLeg {
  const km = haversineKm(fromCoord, toCoord);
  return {
    mode: "goride",
    from: fromName,
    to: toName,
    from_name: fromName,
    to_name: toName,
    minutes: goRideMinutes(km),
    cost: goRideCost(km),
    note: `GoRide ${km.toFixed(1)} km`,
  };
}

// ---- nearest station / TJ stop dari koordinat ----
function nearestKrl(coord: [number, number]): string | null {
  let best: string | null = null;
  let bd = Infinity;
  for (const [id, c] of Object.entries(graph.krl_coords)) {
    const d = haversineKm(coord, c);
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  return bd <= 8 ? best : null; // max 8km ke stasiun
}

function nearestTjStop(coord: [number, number]): string | null {
  let best: string | null = null;
  let bd = Infinity;
  for (const s of tj.stops) {
    const d = haversineKm(coord, [s.lat, s.lon]);
    if (d < bd) {
      bd = d;
      best = s.id;
    }
  }
  return bd <= 3 ? best : null; // max 3km ke halte
}

// ---- plan utama (GoTransit model) ----
export function planTrip(
  fromCoord: [number, number],
  toCoord: [number, number],
  fromLabel: string,
  toLabel: string,
  pref: Pref = "cheapest",
): TripOption[] {
  const results: TripOption[] = [];
  const fromKrl = nearestKrl(fromCoord);
  const toKrl = nearestKrl(toCoord);
  const fromTj = nearestTjStop(fromCoord);
  const toTj = nearestTjStop(toCoord);

  const push = (o: TripOption) => {
    results.push(o);
  };

  // ===== Opsi 1: GoRide langsung =====
  {
    const km = haversineKm(fromCoord, toCoord);
    const leg = goRideLeg(fromLabel, toLabel, fromCoord, toCoord);
    push({
      label: "GoRide Langsung",
      desc: `${km.toFixed(1)} km langsung, tanpa transit`,
      totalMinutes: leg.minutes ?? 0,
      totalCost: leg.cost ?? 0,
      transfers: 0,
      walkKm: 0,
      legs: [leg],
    });
  }

  // ===== Opsi 2: GoRide + KRL + GoRide (first/last mile) =====
  if (fromKrl && toKrl) {
    const krl = krlPath(fromKrl, toKrl);
    if (krl && krl.length > 1) {
      const krlKm = krl.reduce((acc, s, i) => {
        if (i === 0) return acc;
        const c1 = KRL_COORD(krl[i - 1].station);
        const c2 = KRL_COORD(s.station);
        return acc + (c1 && c2 ? haversineKm(c1, c2) : 0);
      }, 0);
      const legs: TripLeg[] = [];
      const g1 = goRideLeg(fromLabel, KRL_NAME(fromKrl), fromCoord, KRL_COORD(fromKrl)!);
      const g2 = goRideLeg(KRL_NAME(toKrl), toLabel, KRL_COORD(toKrl)!, toCoord);
      legs.push(g1);
      legs.push({
        mode: "krl",
        from: fromKrl,
        to: toKrl,
        from_name: KRL_NAME(fromKrl),
        to_name: KRL_NAME(toKrl),
        stops: krl.map((k) => k.station),
        minutes: krlLegMinutes(krl),
        cost: krlCost(krlKm),
        note: `KRL ${krl.length - 1} stasiun (${krlKm.toFixed(1)} km)`,
      });
      legs.push(g2);
      push({
        label: "GoRide + KRL + GoRide",
        desc: `${KRL_NAME(fromKrl)} → ${KRL_NAME(toKrl)}`,
        totalMinutes: legs.reduce((a, l) => a + (l.minutes ?? 0), 0),
        totalCost: legs.reduce((a, l) => a + (l.cost ?? 0), 0),
        transfers: 2,
        walkKm: 0,
        legs,
      });
    }
  }

  // ===== Opsi 3: GoRide + KRL + Transjakarta + GoRide =====
  if (fromKrl && toKrl && fromTj && toTj) {
    const fromTransit = graph.transfers[fromKrl];
    const toTransit = graph.transfers[toKrl];
    const krl1 = fromTransit ? krlPath(fromKrl, fromTransit) : null;
    const krl2 = toTransit ? krlPath(toTransit, toKrl) : null;
    const tjLegs = tjPath(fromTj, toTj);
    if (tjLegs.length && krl1 && krl2) {
      const legs: TripLeg[] = [];
      legs.push(goRideLeg(fromLabel, KRL_NAME(fromKrl), fromCoord, KRL_COORD(fromKrl)!));
      if (krl1.length > 1) {
        legs.push({
          mode: "krl",
          from: fromKrl,
          to: krl1[krl1.length - 1].station,
          from_name: KRL_NAME(fromKrl),
          to_name: STOP_NAME[fromTj] ?? fromTj,
          stops: krl1.map((k) => k.station),
          minutes: krlLegMinutes(krl1),
          cost: TJ_COST,
        });
      }
      legs.push(...tjLegs);
      if (krl2.length > 1) {
        legs.push({
          mode: "krl",
          from: krl2[0].station,
          to: toKrl,
          from_name: STOP_NAME[toTj] ?? toTj,
          to_name: KRL_NAME(toKrl),
          stops: krl2.map((k) => k.station),
          minutes: krlLegMinutes(krl2),
          cost: TJ_COST,
        });
      }
      legs.push(goRideLeg(KRL_NAME(toKrl), toLabel, KRL_COORD(toKrl)!, toCoord));
      push({
        label: "GoRide + KRL + Transjakarta",
        desc: `via ${STOP_NAME[fromTj] ?? fromTj} → ${STOP_NAME[toTj] ?? toTj}`,
        totalMinutes: legs.reduce((a, l) => a + (l.minutes ?? 0), 0),
        totalCost: legs.reduce((a, l) => a + (l.cost ?? 0), 0),
        transfers: 3,
        walkKm: 0,
        legs,
      });
    }
  }

  // ===== Opsi 4: GoRide + Transjakarta + GoRide (no KRL) =====
  if (fromTj && toTj) {
    const tjLegs = tjPath(fromTj, toTj);
    if (tjLegs.length) {
      const legs: TripLeg[] = [
        goRideLeg(fromLabel, STOP_NAME[fromTj] ?? fromTj, fromCoord, [TJ_STOP(fromTj)!.lat, TJ_STOP(fromTj)!.lon] as [number, number]),
        ...tjLegs,
        goRideLeg(STOP_NAME[toTj] ?? toTj, toLabel, [TJ_STOP(toTj)!.lat, TJ_STOP(toTj)!.lon] as [number, number], toCoord),
      ];
      push({
        label: "GoRide + Transjakarta + GoRide",
        desc: `via ${STOP_NAME[fromTj] ?? fromTj} → ${STOP_NAME[toTj] ?? toTj}`,
        totalMinutes: legs.reduce((a, l) => a + (l.minutes ?? 0), 0),
        totalCost: legs.reduce((a, l) => a + (l.cost ?? 0), 0),
        transfers: 2,
        walkKm: 0,
        legs,
      });
    }
  }

  if (!results.length) return [];

  // ===== sort by preference =====
  const score = (o: TripOption) => {
    switch (pref) {
      case "min_transit":
        return o.transfers * 1000 + o.totalMinutes;
      case "min_walk":
        return o.walkKm * 1000 + o.totalMinutes;
      case "fastest":
        return o.totalMinutes;
      default:
        return o.totalCost;
    }
  };
  const sorted = [...results].sort((a, b) => score(a) - score(b));
  const best = sorted[0];

  // label kriteria
  const cheapest = [...results].sort((a, b) => a.totalCost - b.totalCost)[0];
  const fastest = [...results].sort((a, b) => a.totalMinutes - b.totalMinutes)[0];
  const minTransit = [...results].sort((a, b) => a.transfers - b.transfers)[0];
  for (const r of results) {
    const tags: string[] = [];
    if (r === cheapest) tags.push("Termurah");
    if (r === fastest) tags.push("Tercepat");
    if (r === minTransit) tags.push("Minim Transit");
    if (r === best && pref === "min_walk") tags.push("Minim Jalan");
    r.label = `${r.label}${tags.length ? " · " + tags.join(" · ") : ""}`;
  }
  return sorted;
}

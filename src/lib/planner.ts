import transjakarta from "../data/transjakarta.json";
import transitRaw from "../data/transit.json";

type TjStop = { id: string; name: string; lat: number; lon: number };
type TjRoute = { id: string; name: string; stops: string[] };

const tj = transjakarta as { stops: TjStop[]; routes: TjRoute[] };
const transit = (transitRaw as { transit: Record<string, string[]> }).transit;

const STOP_NAME: Record<string, string> = {};
for (const s of tj.stops) STOP_NAME[s.id] = s.name;

const STOP_ROUTES: Record<string, string[]> = {};
for (const r of tj.routes) {
  for (const s of r.stops) {
    (STOP_ROUTES[s] ??= []).push(r.id);
  }
}

const ROUTE_BY_ID: Record<string, TjRoute> = {};
for (const r of tj.routes) ROUTE_BY_ID[r.id] = r;

export type TripLeg = {
  mode: "krl" | "tj";
  route?: string;
  from: string;
  to: string;
  from_name?: string;
  to_name?: string;
  stops?: string[];
  minutes?: number;
  note?: string;
};

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371.0;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const h =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const tjStop = (id: string) => tj.stops.find((s) => s.id === id);

function estimateMinutes(leg: TripLeg) {
  let d_km = 0;
  for (let i = 0; i < (leg.stops?.length ?? 1) - 1; i++) {
    const s1 = tjStop(leg.stops![i]);
    const s2 = tjStop(leg.stops![i + 1]);
    if (s1 && s2) d_km += haversine(s1.lat, s1.lon, s2.lat, s2.lon);
  }
  const n = (leg.stops?.length ?? 1) - 1;
  if (n <= 3) return Math.max(2, Math.round(6 * n));
  return Math.max(2, Math.round((d_km / 20) * 60 + 2 * n));
}

export function planTrip(fromStation: string, toStation: string): TripLeg[] {
  if (fromStation === toStation) return [];
  const tjFrom = transit[fromStation] ?? [];
  const tjTo = transit[toStation] ?? [];
  if (tjFrom.length === 0 || tjTo.length === 0) return [];

  let best: { cost: number; legs: TripLeg[] } | null = null;
  for (const a of tjFrom) {
    for (const b of tjTo) {
      const q: Array<{ stop: string; route: string; legs: TripLeg[] }> = [];
      const seen = new Set<string>();
      for (const rid of STOP_ROUTES[a] ?? []) {
        q.push({
          stop: a,
          route: rid,
          legs: [{ mode: "tj", route: rid, from: a, to: a, stops: [a] }],
        });
        seen.add(`${a}|${rid}`);
      }
      while (q.length) {
        const { stop, route, legs } = q.shift()!;
        const routeObj = ROUTE_BY_ID[route];
        if (!routeObj) continue;
        const seq = routeObj.stops;
        const i = seq.indexOf(stop);
        if (i < 0) continue;

        const tryExtend = (nxt: string, forward: boolean) => {
          const legs2 = legs.map((l) => ({ ...l, stops: l.stops ? [...l.stops] : undefined }));
          const last = legs2[legs2.length - 1];
          if (forward) {
            last.stops = [...(last.stops ?? []), nxt];
            last.to = nxt;
          } else {
            last.stops = [nxt, ...(last.stops ?? [])];
            last.from = nxt;
          }
          if (nxt === b) {
            const cost = legs2.reduce((acc, l) => acc + (l.stops?.length ?? 0), 0);
            if (!best || cost < best.cost) best = { cost, legs: legs2 };
          }
          for (const rid2 of STOP_ROUTES[nxt] ?? []) {
            if (rid2 !== route && !seen.has(`${nxt}|${rid2}`)) {
              seen.add(`${nxt}|${rid2}`);
              const legs3 = legs2.map((l) => ({ ...l, stops: l.stops ? [...l.stops] : undefined }));
              legs3.push({ mode: "tj", route: rid2, from: nxt, to: nxt, stops: [nxt] });
              q.push({ stop: nxt, route: rid2, legs: legs3 });
            }
          }
        };

        for (let j = i + 1; j < seq.length; j++) tryExtend(seq[j], true);
        for (let j = i - 1; j >= 0; j--) tryExtend(seq[j], false);
      }
    }
  }

  if (!best) return [];
  const legs: TripLeg[] = (best as { cost: number; legs: TripLeg[] }).legs;
  for (const l of legs) {
    l.from_name = STOP_NAME[l.from] ?? l.from;
    l.to_name = STOP_NAME[l.to] ?? l.to;
    l.minutes = estimateMinutes(l);
  }
  const a = legs[0].from;
  const b = legs[legs.length - 1].to;
  return [
    {
      mode: "krl",
      from: fromStation,
      to: a,
      from_name: STOP_NAME[a] ?? a,
      note: "naik KRL, lanjut Transjakarta",
      minutes: 5,
    },
    ...legs,
    {
      mode: "krl",
      from: b,
      to: toStation,
      from_name: STOP_NAME[b] ?? b,
      note: "turun Transjakarta, lanjut KRL",
      minutes: 5,
    },
  ];
}

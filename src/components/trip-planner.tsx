import React from "react";
import { cn } from "../utils";
import {
  planTrip,
  TripOption,
  TripLeg,
  Pref,
} from "../lib/planner";

type Props = {
  onBack: () => void;
};

type GeoResult = { lat: number; lon: number; name: string; type: string };

const fmtRupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");

const PREFS: { key: Pref; label: string }[] = [
  { key: "cheapest", label: "💸 Termurah" },
  { key: "fastest", label: "⚡ Tercepat" },
  { key: "min_transit", label: "🔁 Minim Transit" },
  { key: "min_walk", label: "🚶 Minim Jalan" },
];

export const TripPlanner = ({ onBack }: Props) => {
  const [fromText, setFromText] = React.useState("");
  const [toText, setToText] = React.useState("");
  const [fromGeo, setFromGeo] = React.useState<GeoResult | null>(null);
  const [toGeo, setToGeo] = React.useState<GeoResult | null>(null);
  const [fromSuggest, setFromSuggest] = React.useState<GeoResult[]>([]);
  const [toSuggest, setToSuggest] = React.useState<GeoResult[]>([]);
  const [pref, setPref] = React.useState<Pref>("cheapest");
  const [options, setOptions] = React.useState<TripOption[] | null>(null);
  const [selected, setSelected] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [aiQuery, setAiQuery] = React.useState("");
  const [aiLoading, setAiLoading] = React.useState(false);
  const [geocoding, setGeocoding] = React.useState<"from" | "to" | null>(null);

  // debounce geocode — hybrid: data lokal (KRL + TJ) + OSM
  React.useEffect(() => {
    const t = setTimeout(async () => {
      const q = fromText.trim();
      if (!q || fromGeo?.name === q) {
        setFromSuggest([]);
        return;
      }
      setGeocoding("from");
      try {
        // 1. cari di data lokal (KRL stations + TJ stops) — instant, lengkap
        const local: GeoResult[] = [];
        const [gData, tjData] = await Promise.all([
          import("../data/planner-graph.json"),
          import("../data/transjakarta.json"),
        ]);
        const graph = gData.default as unknown as {
          stations: Record<string, { name: string }>;
          krl_coords: Record<string, [number, number]>;
        };
        const tj = tjData.default as unknown as {
          stops: { id: string; name: string; lat: number; lon: number }[];
        };
        const ql = q.toLowerCase();
        for (const [id, st] of Object.entries(graph.stations)) {
          if (st.name.toLowerCase().includes(ql) || id.toLowerCase() === ql) {
            const c = graph.krl_coords[id];
            if (c) local.push({ lat: c[0], lon: c[1], name: `🚆 ${st.name}`, type: "station" });
          }
        }
        for (const s of tj.stops) {
          if (s.name.toLowerCase().includes(ql)) {
            local.push({ lat: s.lat, lon: s.lon, name: `🚌 ${s.name}`, type: "tj" });
          }
        }
        // 2. kalau ga ada di lokal, baru OSM
        let osm: GeoResult[] = [];
        if (local.length === 0) {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          osm = (data.results || []).slice(0, 5);
        }
        setFromSuggest([...local.slice(0, 6), ...osm]);
      } catch {
        setFromSuggest([]);
      } finally {
        setGeocoding(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [fromText, fromGeo]);

  // debounce geocode — hybrid: data lokal (KRL + TJ) + OSM
  React.useEffect(() => {
    const t = setTimeout(async () => {
      const q = toText.trim();
      if (!q || toGeo?.name === q) {
        setToSuggest([]);
        return;
      }
      setGeocoding("to");
      try {
        // 1. cari di data lokal (KRL stations + TJ stops) — instant, lengkap
        const local: GeoResult[] = [];
        const [gData, tjData] = await Promise.all([
          import("../data/planner-graph.json"),
          import("../data/transjakarta.json"),
        ]);
        const graph = gData.default as unknown as {
          stations: Record<string, { name: string }>;
          krl_coords: Record<string, [number, number]>;
        };
        const tj = tjData.default as unknown as {
          stops: { id: string; name: string; lat: number; lon: number }[];
        };
        const ql = q.toLowerCase();
        for (const [id, st] of Object.entries(graph.stations)) {
          if (st.name.toLowerCase().includes(ql) || id.toLowerCase() === ql) {
            const c = graph.krl_coords[id];
            if (c) local.push({ lat: c[0], lon: c[1], name: `🚆 ${st.name}`, type: "station" });
          }
        }
        for (const s of tj.stops) {
          if (s.name.toLowerCase().includes(ql)) {
            local.push({ lat: s.lat, lon: s.lon, name: `🚌 ${s.name}`, type: "tj" });
          }
        }
        // 2. kalau ga ada di lokal, baru OSM
        let osm: GeoResult[] = [];
        if (local.length === 0) {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          osm = (data.results || []).slice(0, 5);
        }
        setToSuggest([...local.slice(0, 6), ...osm]);
      } catch {
        setToSuggest([]);
      } finally {
        setGeocoding(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [toText, toGeo]);

  const pickFrom = (r: GeoResult) => {
    setFromGeo(r);
    setFromText(r.name);
    setFromSuggest([]);
    setOptions(null);
    setError("");
  };
  const pickTo = (r: GeoResult) => {
    setToGeo(r);
    setToText(r.name);
    setToSuggest([]);
    setOptions(null);
    setError("");
  };

  const plan = () => {
    if (!fromGeo || !toGeo || loading) return;
    setLoading(true);
    setError("");
    setOptions(null);
    setTimeout(() => {
      try {
        const opts = planTrip(
          [fromGeo.lat, fromGeo.lon],
          [toGeo.lat, toGeo.lon],
          fromGeo.name,
          toGeo.name,
          pref,
        );
        if (!opts.length) {
          setError(
            "Belum ada rute untuk lokasi ini. Coba lokasi lain (lebih dekat ke stasiun/halte).",
          );
        } else {
          setOptions(opts);
          setSelected(0);
        }
      } catch (e) {
        setError("Gagal memuat rute. Coba lagi.");
      } finally {
        setLoading(false);
      }
    }, 50);
  };

  const swap = () => {
    setFromText(toText);
    setToText(fromText);
    setFromGeo(toGeo);
    setToGeo(fromGeo);
    setOptions(null);
    setError("");
  };

  const askAi = async () => {
    const q = aiQuery.trim();
    if (!q || aiLoading) return;
    setAiLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "AI gagal memproses");
        return;
      }
      // AI kasih kode stasiun/halte — resolve via data lokal (bukan geocode OSM)
      const resolveStation = async (code: string) => {
        const norm = code.trim().toUpperCase();
        // coba cari di data KRL (graph) — coords langsung
        const g = await import("../data/planner-graph.json");
        const graph = g.default as unknown as {
          stations: Record<string, { name: string }>;
          krl_coords: Record<string, [number, number]>;
        };
        if (graph.stations[norm] && graph.krl_coords[norm]) {
          return {
            lat: graph.krl_coords[norm][0],
            lon: graph.krl_coords[norm][1],
            name: graph.stations[norm].name,
            type: "station",
          };
        }
        // cari di data TJ
        const tjData = await import("../data/transjakarta.json");
        const tj = tjData.default as unknown as {
          stops: { id: string; name: string; lat: number; lon: number }[];
        };
        const stop = tj.stops.find(
          (s) => s.id.toUpperCase() === norm || s.name.toLowerCase().includes(code.toLowerCase()),
        );
        if (stop) {
          return { lat: stop.lat, lon: stop.lon, name: stop.name, type: "tj" };
        }
        return null;
      };
      const s1 = await resolveStation(data.from || "");
      const s2 = await resolveStation(data.to || "");
      if (s1 && s2) {
        setFromGeo(s1);
        setToGeo(s2);
        setFromText(s1.name);
        setToText(s2.name);
        setOptions(null);
        setError("");
      } else {
        setError(
          `AI ga bisa locate: ${data.from || "?"} → ${data.to || "?"}. Coba tulis nama lengkap (cth: stasiun Kebayoran, halte CBD Ciledug).`,
        );
      }
    } catch (e) {
      setError("Gagal hubungi AI. Coba lagi.");
    } finally {
      setAiLoading(false);
    }
  };

  const opt = options?.[selected] ?? null;

  return (
    <div className="flex h-full w-full flex-col gap-4 px-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="rounded-md p-1.5 transition hover:bg-zinc-100"
        >
          ←
        </button>
        <h1 className="font-mono text-lg tracking-tight">Trip Planner</h1>
        <span className="w-8" />
      </div>

      {/* AI input */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs opacity-50">
          Tanya AI — contoh: "dari rumah di Bekasi ke kantor Tanah Abang"
        </label>
        <div className="flex gap-2">
          <input
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && askAi()}
            placeholder="Tanya rute natural language..."
            className="flex-1 rounded-md border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
          />
          <button
            onClick={askAi}
            disabled={!aiQuery.trim() || aiLoading}
            className="rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
          >
            {aiLoading ? "..." : "AI"}
          </button>
        </div>
      </div>

      {/* Dari */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs opacity-50">Dari (lokasi / alamat)</label>
        <div className="relative">
          <input
            value={fromText}
            onChange={(e) => {
              setFromText(e.target.value);
              if (fromGeo?.name !== e.target.value) setFromGeo(null);
            }}
            placeholder="cth: Jl. Sudirman, Jakarta"
            className="w-full rounded-md bg-zinc-100 px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-zinc-300"
          />
          {geocoding === "from" && (
            <span className="absolute right-3 top-3 text-xs opacity-40">
              mencari...
            </span>
          )}
          {fromSuggest.length > 0 && (
            <div className="absolute z-30 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg">
              {fromSuggest.map((r, i) => (
                <button
                  key={i}
                  onClick={() => pickFrom(r)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* swap */}
      <div className="flex items-center justify-center">
        <button
          onClick={swap}
          className="rounded-md p-1.5 text-xs opacity-50 transition hover:opacity-100"
        >
          ⇅ Tukar
        </button>
      </div>

      {/* Ke */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs opacity-50">Ke (lokasi / alamat)</label>
        <div className="relative">
          <input
            value={toText}
            onChange={(e) => {
              setToText(e.target.value);
              if (toGeo?.name !== e.target.value) setToGeo(null);
            }}
            placeholder="cth: Stasiun Tanah Abang"
            className="w-full rounded-md bg-zinc-100 px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-zinc-300"
          />
          {geocoding === "to" && (
            <span className="absolute right-3 top-3 text-xs opacity-40">
              mencari...
            </span>
          )}
          {toSuggest.length > 0 && (
            <div className="absolute z-30 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg">
              {toSuggest.map((r, i) => (
                <button
                  key={i}
                  onClick={() => pickTo(r)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* preferensi */}
      <div className="flex flex-wrap gap-1.5">
        {PREFS.map((p) => (
          <button
            key={p.key}
            onClick={() => {
              setPref(p.key);
              setOptions(null);
            }}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs transition",
              pref === p.key
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* cari */}
      <button
        onClick={plan}
        disabled={!fromGeo || !toGeo || loading}
        className="mt-2 rounded-md bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
      >
        {loading ? "Mencari rute..." : "Cari Rute"}
      </button>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* daftar opsi */}
      {options && options.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium opacity-50">
            {options.length} pilihan rute
          </p>
          {options.map((o, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={cn(
                "flex items-center justify-between rounded-md border p-3 text-left transition",
                i === selected
                  ? "border-zinc-900 bg-zinc-50"
                  : "border-zinc-200 hover:border-zinc-400",
              )}
            >
              <div>
                <p className="text-sm font-medium">{o.label}</p>
                <p className="text-xs opacity-40">
                  {o.transfers} transit · {o.walkKm.toFixed(1)} km jalan
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm">±{o.totalMinutes} mnt</p>
                <p className="font-mono text-xs opacity-60">
                  {fmtRupiah(o.totalCost)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* detail rute */}
      {opt && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {fromText} → {toText}
            </p>
            <p className="text-xs opacity-50">
              ±{opt.totalMinutes} mnt · {fmtRupiah(opt.totalCost)}
            </p>
          </div>
          {opt.legs.map((leg: TripLeg, i: number) => (
            <div key={i} className="flex flex-col gap-1.5">
              {i > 0 && (
                <div className="flex items-center gap-2 pl-2">
                  <div className="h-4 w-px bg-zinc-300" />
                  <span className="text-xs text-zinc-500">
                    {leg.mode === "tj" && leg.route
                      ? `ganti koridor ${leg.route}`
                      : leg.mode === "goride"
                        ? "lanjut GoRide"
                        : "lanjut"}
                  </span>
                </div>
              )}
              <div className="rounded-md border border-zinc-200 p-3">
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase",
                      leg.mode === "krl"
                        ? "bg-blue-100 text-blue-700"
                        : leg.mode === "tj"
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700",
                    )}
                  >
                    {leg.mode === "krl"
                      ? "KRL"
                      : leg.mode === "tj"
                        ? `TJ ${leg.route}`
                        : "GORIDE"}
                  </span>
                  <span className="text-xs opacity-50">
                    {leg.minutes ? `± ${leg.minutes} mnt` : ""}
                    {leg.cost ? ` · ${fmtRupiah(leg.cost)}` : ""}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">
                    {leg.from_name || leg.from}
                  </span>
                  <span className="mx-2 flex-1 border-t border-dashed border-zinc-300" />
                  <span className="font-medium capitalize">
                    {leg.to_name || leg.to}
                  </span>
                </div>
                {leg.note && (
                  <p className="mt-1.5 text-xs opacity-40">{leg.note}</p>
                )}
                {leg.stops && leg.stops.length > 1 && (
                  <p className="mt-1.5 text-xs opacity-40">
                    {leg.stops.length - 1} stasiun
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* info */}
      <p className="pt-2 text-center text-[11px] opacity-40">
        Model GoTransit: GoRide first/last mile + KRL + Transjakarta. Estimasi
        biaya & waktu, bisa beda dari aktual.
      </p>
    </div>
  );
};

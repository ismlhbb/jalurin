import React from "react";
import { useStations } from "../hooks/use-stations";
import { cn } from "../utils";
import { planTrip, TripLeg } from "../lib/planner";

type Props = {
  onBack: () => void;
};

export const TripPlanner = ({ onBack }: Props) => {
  const { data: stations } = useStations();
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [searchFrom, setSearchFrom] = React.useState("");
  const [searchTo, setSearchTo] = React.useState("");
  const [active, setActive] = React.useState<"from" | "to" | null>(null);
  const [result, setResult] = React.useState<TripLeg[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const list = (stations?.data || []).sort((a, b) => a.name.localeCompare(b.name));

  const filtered = list.filter((s) => {
    const q = (active === "from" ? searchFrom : searchTo).toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
  });

  const pick = (id: string, name: string) => {
    if (active === "from") {
      setFrom(`${id} · ${name}`);
      setSearchFrom("");
    } else {
      setTo(`${id} · ${name}`);
      setSearchTo("");
    }
    setActive(null);
    setResult(null);
    setError("");
  };

  const plan = () => {
    const fromId = from.split(" ")[0];
    const toId = to.split(" ")[0];
    if (!fromId || !toId) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const legs = planTrip(fromId, toId);
      if (legs.length === 0) {
        setError("Belum ada rute transit Transjakarta untuk stasiun ini");
      } else {
        setResult(legs);
      }
    } catch (e) {
      setError("Gagal memuat rute. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
    setResult(null);
    setError("");
  };

  const stopName = (id: string) => {
    const s = list.find((x) => x.id === id);
    return s ? s.name : id;
  };

  const totalMinutes = result?.reduce((acc, l) => acc + (l.minutes || 0), 0) || 0;

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

      {/* asal */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs opacity-50">Dari</label>
        <div className="relative">
          <button
            onClick={() => setActive(active === "from" ? null : "from")}
            className="flex w-full items-center justify-between rounded-md bg-zinc-100 px-3 py-2.5 text-left text-sm"
          >
            <span className={cn(!from && "opacity-40")}>
              {from || "Pilih stasiun / halte"}
            </span>
            <span className="text-xs opacity-40">▼</span>
          </button>
          {active === "from" && (
            <div className="absolute z-30 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg">
              <input
                autoFocus
                value={searchFrom}
                onChange={(e) => setSearchFrom(e.target.value)}
                placeholder="Cari stasiun..."
                className="w-full border-b border-zinc-100 px-3 py-2 text-sm outline-none"
              />
              <div className="max-h-52 overflow-y-auto">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => pick(s.id, s.name)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm capitalize hover:bg-zinc-50"
                  >
                    <span>{s.name.toLowerCase()}</span>
                    <span className="font-mono text-xs opacity-30">{s.id}</span>
                  </button>
                ))}
              </div>
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

      {/* tujuan */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs opacity-50">Ke</label>
        <div className="relative">
          <button
            onClick={() => setActive(active === "to" ? null : "to")}
            className="flex w-full items-center justify-between rounded-md bg-zinc-100 px-3 py-2.5 text-left text-sm"
          >
            <span className={cn(!to && "opacity-40")}>
              {to || "Pilih stasiun / halte"}
            </span>
            <span className="text-xs opacity-40">▼</span>
          </button>
          {active === "to" && (
            <div className="absolute z-30 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg">
              <input
                autoFocus
                value={searchTo}
                onChange={(e) => setSearchTo(e.target.value)}
                placeholder="Cari stasiun..."
                className="w-full border-b border-zinc-100 px-3 py-2 text-sm outline-none"
              />
              <div className="max-h-52 overflow-y-auto">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => pick(s.id, s.name)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm capitalize hover:bg-zinc-50"
                  >
                    <span>{s.name.toLowerCase()}</span>
                    <span className="font-mono text-xs opacity-30">{s.id}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* cari */}
      <button
        onClick={plan}
        disabled={!from || !to || loading}
        className="mt-2 rounded-md bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
      >
        {loading ? "Mencari rute..." : "Cari Rute"}
      </button>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* hasil */}
      {result && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {stopName(from.split(" ")[0])} → {stopName(to.split(" ")[0])}
            </p>
            <p className="text-xs opacity-50">± {totalMinutes} menit</p>
          </div>
          {result.map((leg, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              {i > 0 && (
                <div className="flex items-center gap-2 pl-2">
                  <div className="h-4 w-px bg-zinc-300" />
                  <span className="text-xs text-zinc-500">
                    {leg.mode === "tj" && leg.route ? (
                      <>ganti koridor {leg.route}</>
                    ) : (
                      "lanjut"
                    )}
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
                        : "bg-red-100 text-red-700",
                    )}
                  >
                    {leg.mode === "krl" ? "KRL" : `TJ ${leg.route}`}
                  </span>
                  <span className="text-xs opacity-50">
                    {leg.minutes ? `± ${leg.minutes} mnt` : ""}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">
                    {leg.mode === "krl"
                      ? stopName(leg.from)
                      : leg.from_name || leg.from}
                  </span>
                  <span className="mx-2 flex-1 border-t border-dashed border-zinc-300" />
                  <span className="font-medium capitalize">
                    {leg.mode === "krl"
                      ? stopName(leg.to)
                      : leg.to_name || leg.to}
                  </span>
                </div>
                {leg.mode === "krl" && leg.note && (
                  <p className="mt-1.5 text-xs opacity-40">{leg.note}</p>
                )}
                {leg.stops && leg.stops.length > 1 && (
                  <p className="mt-1.5 text-xs opacity-40">
                    {leg.stops.length - 1} halte
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* info */}
      <p className="pt-2 text-center text-[11px] opacity-40">
        Rute KRL + Transjakarta. Transit di halte BRT terdekat dari stasiun.
      </p>
    </div>
  );
};

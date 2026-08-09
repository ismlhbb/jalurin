# Jalurin

Jadwal KRL + Trip Planner dengan transit Transjakarta.

Fork dari [Comuline Web](https://github.com/comuline/web) (AGPLv3). Tambahan utama:

- **Trip Planner**: cari rute antar stasiun KRL, otomatis nambahin leg Transjakarta (BRT) kalau butuh transit.
- Data Transjakarta dari [GTFS resmi](https://gtfs.transjakarta.co.id/files/file_gtfs.zip) (14 koridor BRT, 245 halte).
- Transit map 32 stasiun KRL ↔ halte BRT (`src/data/transit.json`).
- Planner jalan **100% di browser** (TypeScript, BFS level koridor) — tanpa backend.

## Development

```sh
pnpm i
cp .env.example .env   # VITE_COMULINE_API_URL="https://api.comuline.com"
pnpm run dev           # port 3000
```

## Build & Deploy (Vercel)

```sh
pnpm run build         # output .dist/
```

Vercel: import repo GitHub → build command `pnpm run build` → output dir `.dist` → env `VITE_COMULINE_API_URL=https://api.comuline.com`.

## Struktur

```
src/
  data/transjakarta.json   # halte + koridor BRT (dari GTFS)
  data/transit.json        # stasiun KRL ↔ halte TJ
  lib/planner.ts           # trip planner client-side
  components/trip-planner.tsx
```

## License

AGPLv3 — lihat [LICENSE](LICENSE). Data Transjakarta © PT Transportasi Jakarta.

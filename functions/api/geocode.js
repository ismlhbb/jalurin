// Geocode lokasi -> koordinat (via OpenStreetMap Nominatim, server-side)
// Route: /api/geocode?q=...
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) {
    return new Response(JSON.stringify({ error: "q kosong" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=id`,
      {
        headers: {
          "User-Agent": "ComulineJalurin/1.0 (jalurin.ismlhbb.xyz)",
          "Accept-Language": "id",
        },
      },
    );
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `geocode gagal: ${resp.status}` }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    const results = data.map((r) => ({
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      name: r.display_name.split(",").slice(0, 3).join(",").trim(),
      type: r.type,
    }));
    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `geocode error: ${e.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

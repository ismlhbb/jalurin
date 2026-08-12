// AI Trip Planner — Pages Function (server-side)
// DeepSeek via API (key dari env)
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  const key = env.DEEPSEEK_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: "AI tidak dikonfigurasi" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  let body = {};
  try { body = await request.json(); } catch (e) {}
  const query = (body.query || "").trim();
  if (!query) {
    return new Response(JSON.stringify({ error: "query kosong" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const system = `Kamu adalah trip planner transportasi Jabodetabek (KRL Commuter Line, Transjakarta, Gojek).
Tugas: dari pertanyaan natural-language pengguna, tentukan titik asal & tujuan.
Balas HANYA JSON: {"from":"KODE_ATAU_NAMA","to":"KODE_ATAU_NAMA","confidence":0-1}
Kode/format:
- Stasiun KRL pakai kode standar: CLT=Cilebut, JNG=Jatinegara, THB=Tanah Abang, MRI=Manggarai, SUD=Sudirman, DU=Duri, TNG=Tangerang, BKS=Bekasi, JAKK=Jakarta Kota, BOO=Bogor, DP=Depok, KBY=Kebayoran, PLM=Palmerah, PRP=Parung Panjang, KDS=Kalideres, POR=Poris, CW=Cawang, MTR=Matraman, GGL=Grogol, JUA=Juanda, KPB=Kampung Bandan, BJD=Bojonggede, CITE=Citeureup, CBN=Cibinong, NMO=Nambo, TPK=Tanjung Priok.
- Halte Transjakarta: tulis nama halte (cth: "CBD Ciledug", "Velbak", "Kebayoran Lama", "Senayan", "Bundaran HI").
- Kalau pengguna sebut nama tempat umum (cth: "rumah di Bekasi"), pakai kode stasiun KRL terdekat.
Jangan tanya balik — langsung tebak.`;

  try {
    const resp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: system },
          { role: "user", content: query },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
        max_tokens: 200,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      return new Response(JSON.stringify({ error: `AI gagal: ${err.slice(0, 200)}` }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return new Response(
      JSON.stringify({
        from: parsed.from || "",
        to: parsed.to || "",
        confidence: parsed.confidence ?? 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `AI error: ${e.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

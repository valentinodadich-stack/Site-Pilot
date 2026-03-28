export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: "Missing Supabase credentials"
      });
    }

    const headers = {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`
    };

    // prvo probaj tablicu Scans
    let response = await fetch(
      `${supabaseUrl}/rest/v1/Scans?select=*&order=created_at.desc.nullslast&limit=10`,
      {
        method: "GET",
        headers
      }
    );

    // ako ne uspije, probaj scans
    if (!response.ok) {
      response = await fetch(
        `${supabaseUrl}/rest/v1/scans?select=*&order=created_at.desc.nullslast&limit=10`,
        {
          method: "GET",
          headers
        }
      );
    }

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({
        error: "Failed to fetch history",
        details: text
      });
    }

    const history = await response.json();

    return res.status(200).json({
      success: true,
      history: Array.isArray(history) ? history : []
    });
  } catch (error) {
    return res.status(500).json({
      error: "History fetch failed",
      details: error.message
    });
  }
}

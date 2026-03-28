export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { url, score, scanData, issues, feedback } = req.body;

    if (!url) {
      return res.status(400).json({ error: "Missing url" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: "Missing Supabase credentials"
      });
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/scans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        url,
        score,
        data: {
          scanData,
          issues,
          feedback
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({
        error: "Failed to save scan",
        details: text
      });
    }

    return res.status(200).json({
      success: true
    });
  } catch (error) {
    return res.status(500).json({
      error: "Save failed",
      details: error.message
    });
  }
}

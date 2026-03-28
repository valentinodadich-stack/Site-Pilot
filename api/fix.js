export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY"
      });
    }

    const { type, url, scanData } = req.body;

    if (!type || !url || !scanData) {
      return res.status(400).json({
        error: "type, url, and scanData are required"
      });
    }

    let instruction = "";

    if (type === "title") {
      instruction = `
Write 3 improved SEO-friendly page title options for this website.
Rules:
- max 60 characters each
- clear and compelling
- business-focused
- no quotation marks
Return ONLY a JSON array of strings.
`;
    } else if (type === "meta") {
      instruction = `
Write 3 improved meta description options for this website.
Rules:
- max 155 characters each
- clear and persuasive
- encourage clicks
- no quotation marks
Return ONLY a JSON array of strings.
`;
    } else if (type === "h1") {
      instruction = `
Write 3 improved H1 headline options for this website.
Rules:
- short and clear
- strong clarity
- conversion-focused
- no quotation marks
Return ONLY a JSON array of strings.
`;
    } else {
      return res.status(400).json({
        error: "Invalid type. Use title, meta, or h1."
      });
    }

    const prompt = `
You are a senior SEO and CRO expert.

Website URL:
${url}

Current data:
- Title: ${scanData.title || "None"}
- Meta Description: ${scanData.metaDescription || "None"}
- H1: ${scanData.h1 || "None"}
- Links: ${scanData.links ?? 0}
- Images: ${scanData.images ?? 0}
- Buttons: ${scanData.buttons ?? 0}
- CTA: ${scanData.cta || "None"}

Task:
${instruction}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.5,
        messages: [
          {
            role: "system",
            content: "You are an expert website optimization assistant."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({
        error: "No AI response received"
      });
    }

    try {
      const parsed = JSON.parse(content);

      if (!Array.isArray(parsed)) {
        return res.status(500).json({
          error: "AI returned invalid format"
        });
      }

      return res.status(200).json({
        success: true,
        type,
        suggestions: parsed
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to parse AI response",
        raw: content
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: "Fix generation failed",
      details: error.message
    });
  }
}

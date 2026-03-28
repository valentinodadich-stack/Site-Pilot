async function getAiFeedback(scanData, issues, url) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return [
      "OpenAI API key is missing.",
      "Add OPENAI_API_KEY in Vercel Environment Variables.",
      "After that, AI feedback will work."
    ];
  }

  const prompt = `
You are a senior CRO (conversion rate optimization) and SEO expert.

Analyze this website and give actionable, business-focused advice.

Website: ${url}

Data:
- Title: ${scanData.title || "None"}
- Meta: ${scanData.metaDescription || "None"}
- H1: ${scanData.h1 || "None"}
- Links: ${scanData.links}
- Images: ${scanData.images}
- Buttons: ${scanData.buttons}
- CTA: ${scanData.cta || "None"}

Issues:
${issues.length ? issues.map((i) => `- ${i}`).join("\n") : "- None"}

IMPORTANT:
- Give EXACTLY 5 suggestions
- Each suggestion must be 1 sentence
- Be very practical and specific
- Focus on increasing conversions and clarity
- No generic advice

Return ONLY a JSON array like:
["...", "...", "..."]
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert website optimization assistant."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.5
      })
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return ["AI feedback could not be generated."];
    }

    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return ["AI returned an unexpected format."];
    } catch {
      return [content];
    }
  } catch (error) {
    return [`AI request failed: ${error.message}`];
  }
}

function decodeHtmlEntities(text) {
  if (!text) return "";

  return text
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8230;/g, "…")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(text) {
  return text ? text.replace(/<[^>]+>/g, "").trim() : "";
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(stripTags(match[1])) : "";
}

function extractMetaDescription(html) {
  const match = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i
  );
  return match ? decodeHtmlEntities(match[1].trim()) : "";
}

function extractH1(html) {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? decodeHtmlEntities(stripTags(match[1])) : "";
}

function countLinks(html) {
  const matches = html.match(/<a\b[^>]*>/gi);
  return matches ? matches.length : 0;
}

function countImages(html) {
  const matches = html.match(/<img\b[^>]*>/gi);
  return matches ? matches.length : 0;
}

function countButtons(html) {
  const buttonTags = html.match(/<button\b[^>]*>/gi) || [];
  const inputButtons =
    html.match(/<input\b[^>]*type=["']?(submit|button)["']?[^>]*>/gi) || [];
  return buttonTags.length + inputButtons.length;
}

function findCTA(html) {
  const ctaWords = [
    "buy now",
    "shop now",
    "get started",
    "sign up",
    "subscribe",
    "book now",
    "contact us",
    "learn more",
    "start now",
    "try now"
  ];

  const cleanHtml = html.toLowerCase();

  for (const word of ctaWords) {
    if (cleanHtml.includes(word)) {
      return word;
    }
  }

  return "";
}

function buildIssues(scanData) {
  const issues = [];

  if (!scanData.title) {
    issues.push("Missing page title");
  } else if (scanData.title.length < 20) {
    issues.push("Title is too short");
  }

  if (!scanData.metaDescription) {
    issues.push("Missing meta description");
  } else if (scanData.metaDescription.length < 50) {
    issues.push("Meta description is too short");
  }

  if (!scanData.h1) {
    issues.push("Missing H1 heading");
  }

  if (scanData.links < 3) {
    issues.push("Very few links on the page");
  }

  if (scanData.images === 0) {
    issues.push("No images found");
  }

  if (scanData.buttons === 0) {
    issues.push("No buttons found");
  }

  if (!scanData.cta) {
    issues.push("No clear CTA text found");
  }

  return issues;
}

function buildScore(scanData) {
  let score = 100;

  if (!scanData.title) score -= 20;
  else if (scanData.title.length < 20) score -= 8;

  if (!scanData.metaDescription) score -= 20;
  else if (scanData.metaDescription.length < 50) score -= 8;

  if (!scanData.h1) score -= 15;
  if (scanData.links < 3) score -= 8;
  if (scanData.images === 0) score -= 8;
  if (scanData.buttons === 0) score -= 8;
  if (!scanData.cta) score -= 13;

  if (score < 0) score = 0;
  return score;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    let normalizedUrl = url.trim();

    if (
      !normalizedUrl.startsWith("http://") &&
      !normalizedUrl.startsWith("https://")
    ) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const response = await fetch(normalizedUrl, {
      headers: {
        "User-Agent": "SitePilotBot/1.0"
      }
    });

    if (!response.ok) {
      return res.status(400).json({
        error: "Could not fetch website",
        status: response.status
      });
    }

    const html = await response.text();

    const scanData = {
      title: extractTitle(html),
      metaDescription: extractMetaDescription(html),
      h1: extractH1(html),
      links: countLinks(html),
      images: countImages(html),
      buttons: countButtons(html),
      cta: findCTA(html)
    };

    const issues = buildIssues(scanData);
    const score = buildScore(scanData);
    const feedback = await getAiFeedback(scanData, issues, normalizedUrl);

    return res.status(200).json({
      success: true,
      url: normalizedUrl,
      score,
      scanData,
      issues,
      feedback
    });
  } catch (error) {
    return res.status(500).json({
      error: "Scan failed",
      details: error.message
    });
  }
}

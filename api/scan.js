function cleanAiJsonText(text) {
  if (!text) return "";

  let cleaned = text.trim();
  cleaned = cleaned.replace(/```json/gi, "");
  cleaned = cleaned.replace(/```/g, "");
  cleaned = cleaned.trim();

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");

  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  return cleaned.trim();
}

async function callOpenAI(prompt, fallback = []) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallback;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: "You are an expert website optimization assistant. When asked for JSON, return only raw JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const raw = await response.text();

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return fallback;
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return fallback;
    }

    const cleaned = cleanAiJsonText(content);

    try {
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        return fallback;
      }

      return parsed
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
    } catch {
      return fallback;
    }
  } catch {
    return fallback;
  }
}

async function getAiFeedback(scanData, issues, url) {
  const fallback = [
    "Strengthen your main headline so visitors instantly understand the offer.",
    "Add a clearer call-to-action above the fold to improve conversions.",
    "Improve the title and meta description to increase search visibility.",
    "Use more internal links to help users explore the site.",
    "Add stronger visual hierarchy to guide attention to the main action."
  ];

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
- Be practical and specific
- Focus on conversions, clarity, and SEO
- Return ONLY a valid JSON array of strings
`;

  const result = await callOpenAI(prompt, fallback);
  return result.slice(0, 5);
}

async function getPriorityFixes(scanData, issues, url) {
  const fallback = [
    "Add a stronger CTA above the fold.",
    "Improve the page title and meta description.",
    "Make the main headline clearer and more specific."
  ];

  const prompt = `
You are a senior CRO and SEO expert.

Your job is to identify the 3 highest-priority fixes for a website.

Website: ${url}

Data:
- Title: ${scanData.title || "None"}
- Meta: ${scanData.metaDescription || "None"}
- H1: ${scanData.h1 || "None"}
- Links: ${scanData.links}
- Images: ${scanData.images}
- Buttons: ${scanData.buttons}
- CTA: ${scanData.cta || "None"}

Issues found:
${issues.length ? issues.map((i) => `- ${i}`).join("\n") : "- None"}

IMPORTANT:
- Return EXACTLY 3 items
- Each item must be short
- Each item must start with an action
- Prioritize conversion, clarity, and SEO
- Return ONLY a valid JSON array of strings
`;

  const result = await callOpenAI(prompt, fallback);
  return result.slice(0, 3);
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

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { url } = req.body || {};

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    let normalizedUrl = String(url).trim();

    if (
      !normalizedUrl.startsWith("http://") &&
      !normalizedUrl.startsWith("https://")
    ) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const response = await fetchWithTimeout(
      normalizedUrl,
      {
        headers: {
          "User-Agent": "SitePilotBot/1.0"
        }
      },
      15000
    );

    if (!response.ok) {
      return res.status(400).json({
        error: "Could not fetch website",
        details: `HTTP ${response.status}`
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

    const [feedback, priorityFixes] = await Promise.all([
      getAiFeedback(scanData, issues, normalizedUrl),
      getPriorityFixes(scanData, issues, normalizedUrl)
    ]);

    return res.status(200).json({
      success: true,
      url: normalizedUrl,
      score,
      scanData,
      issues,
      feedback,
      priorityFixes
    });
  } catch (error) {
    return res.status(500).json({
      error: "Scan failed",
      details: error?.message || "Unknown server error"
    });
  }
}

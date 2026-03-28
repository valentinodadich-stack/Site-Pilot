function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : "";
}

function extractMetaDescription(html) {
  const match = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i
  );
  return match ? match[1].trim() : "";
}

function extractH1(html) {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? match[1].replace(/<[^>]+>/g, "").trim() : "";
}

function buildIssues({ title, metaDescription, h1 }) {
  const issues = [];

  if (!title) {
    issues.push("Missing page title");
  } else if (title.length < 20) {
    issues.push("Title is too short");
  }

  if (!metaDescription) {
    issues.push("Missing meta description");
  } else if (metaDescription.length < 50) {
    issues.push("Meta description is too short");
  }

  if (!h1) {
    issues.push("Missing H1 heading");
  }

  return issues;
}

function buildScore({ title, metaDescription, h1 }) {
  let score = 100;

  if (!title) score -= 25;
  else if (title.length < 20) score -= 10;

  if (!metaDescription) score -= 25;
  else if (metaDescription.length < 50) score -= 10;

  if (!h1) score -= 20;

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

    const title = extractTitle(html);
    const metaDescription = extractMetaDescription(html);
    const h1 = extractH1(html);

    const scanData = {
      title,
      metaDescription,
      h1
    };

    const issues = buildIssues(scanData);
    const score = buildScore(scanData);

    return res.status(200).json({
      success: true,
      url: normalizedUrl,
      score,
      scanData,
      issues,
      feedback: [
        !title
          ? "Add a clear and keyword-focused page title."
          : "Your page title exists. Make sure it clearly explains the page.",
        !metaDescription
          ? "Add a compelling meta description to improve search visibility."
          : "Your meta description exists. Make sure it encourages clicks.",
        !h1
          ? "Add one strong H1 headline that explains the page instantly."
          : "Your page has an H1. Make sure it matches the page intent."
      ]
    });
  } catch (error) {
    return res.status(500).json({
      error: "Scan failed",
      details: error.message
    });
  }
}

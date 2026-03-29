export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = parseBody(req.body);
    const primaryUrl = safeString(body.primaryUrl || body.url || "");
    const competitorUrl = safeString(body.competitorUrl || body.competitor || "");

    if (!primaryUrl || !competitorUrl) {
      res.status(400).json({
        error: "Both primaryUrl and competitorUrl are required."
      });
      return;
    }

    if (normalizeUrlForCompare(primaryUrl) === normalizeUrlForCompare(competitorUrl)) {
      res.status(400).json({
        error: "Primary and competitor URLs must be different."
      });
      return;
    }

    const baseUrl = getBaseUrl(req);

    const [primaryRaw, competitorRaw] = await Promise.all([
      runInternalScan(baseUrl, primaryUrl),
      runInternalScan(baseUrl, competitorUrl)
    ]);

    const primary = normalizeScan(primaryRaw);
    const competitor = normalizeScan(competitorRaw);

    const fallbackComparison = buildFallbackComparison(primary, competitor);
    const aiComparison = await generateAiComparison(primary, competitor, fallbackComparison);

    res.status(200).json({
      success: true,
      primary,
      competitor,
      comparison: aiComparison || fallbackComparison
    });
  } catch (error) {
    console.error("COMPARE ERROR:", error);
    res.status(500).json({
      error: "Failed to compare websites.",
      details: error?.message || "Unknown error"
    });
  }
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => safeString(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function dedupeList(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const clean = safeString(item);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }

  return result;
}

function normalizeUrlForCompare(url) {
  return safeString(url)
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function hasContent(value) {
  return safeString(value).length > 0;
}

function getDisplaySiteName(url) {
  const raw = safeString(url);
  if (!raw) return "Website";

  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(normalized).hostname.replace(/^www\./i, "");
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0] || "Website";
  }
}

function getBaseUrl(req) {
  const proto =
    safeString(req.headers["x-forwarded-proto"]) ||
    (process.env.VERCEL_ENV ? "https" : "http");

  const host =
    safeString(req.headers["x-forwarded-host"]) ||
    safeString(req.headers.host);

  if (!host) {
    throw new Error("Unable to determine request host.");
  }

  return `${proto}://${host}`;
}

async function runInternalScan(baseUrl, url) {
  const response = await fetch(`${baseUrl}/api/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url })
  });

  const data = await safeReadJson(response);

  if (!response.ok) {
    const message = data.details
      ? `${data.error || "Scan failed"}: ${data.details}`
      : (data.error || "Scan failed");
    throw new Error(message);
  }

  return data;
}

async function safeReadJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: "Invalid JSON response",
      details: text
    };
  }
}

function normalizeScan(data) {
  const source = data?.data || data || {};
  const scanDataSource = source.scanData || {};

  const normalized = {
    url: safeString(source.url, "Unknown"),
    siteName: getDisplaySiteName(source.url || ""),
    score: clampNumber(safeNumber(source.score, 0), 0, 100),
    scanData: {
      title: safeString(scanDataSource.title, ""),
      metaDescription: safeString(scanDataSource.metaDescription, ""),
      h1: safeString(scanDataSource.h1, ""),
      links: safeNumber(scanDataSource.links, 0),
      images: safeNumber(scanDataSource.images, 0),
      buttons: safeNumber(scanDataSource.buttons, 0),
      cta: safeString(scanDataSource.cta, "")
    },
    issues: normalizeArray(source.issues),
    feedback: normalizeArray(source.feedback || source.aiFeedback),
    priorityFixes: normalizeArray(source.priorityFixes),
    topNextActions: normalizeArray(source.topNextActions)
  };

  if (!normalized.topNextActions.length) {
    normalized.topNextActions = buildTopNextActions(normalized);
  }

  return normalized;
}

function buildTopNextActions(data) {
  const actions = [];

  if (!data.scanData.title || data.scanData.title.length < 20) {
    actions.push("Rewrite the title to be clearer, more specific and keyword-aligned.");
  }

  if (!data.scanData.metaDescription || data.scanData.metaDescription.length < 80) {
    actions.push("Improve the meta description so the search snippet is stronger and more clickable.");
  }

  if (!data.scanData.h1) {
    actions.push("Clarify the H1 so visitors instantly understand what the page does.");
  }

  if (!data.scanData.cta) {
    actions.push("Add one obvious primary CTA above the fold.");
  }

  if (data.scanData.images === 0) {
    actions.push("Add visual proof such as screenshots, examples or trust visuals.");
  }

  if (data.scanData.links < 5) {
    actions.push("Strengthen internal linking so the page feels more connected and crawlable.");
  }

  if (data.scanData.buttons > 0 && data.scanData.buttons < 2) {
    actions.push("Test stronger CTA placement and more specific button copy.");
  }

  (data.priorityFixes || []).forEach((item) => {
    if (actions.length < 5) actions.push(item);
  });

  return dedupeList(actions).slice(0, 5);
}

function buildFallbackComparison(primary, competitor) {
  const competitorWins = [];
  const mustFix = [];
  const standoutDifferences = [];

  if (competitor.score > primary.score) {
    competitorWins.push(
      `${competitor.siteName} has a stronger overall page score (${competitor.score} vs ${primary.score}).`
    );
  } else if (primary.score > competitor.score) {
    competitorWins.push(
      `${primary.siteName} already leads on overall score (${primary.score} vs ${competitor.score}).`
    );
  } else {
    competitorWins.push("Both websites currently have the same overall score.");
  }

  if ((competitor.scanData.title || "").length > (primary.scanData.title || "").length) {
    competitorWins.push("Competitor title appears more developed and likely explains the offer more clearly.");
    mustFix.push("Rewrite your title to be more specific, benefit-driven and keyword-aligned.");
    standoutDifferences.push("Title depth favors the competitor.");
  }

  if ((competitor.scanData.metaDescription || "").length > (primary.scanData.metaDescription || "").length) {
    competitorWins.push("Competitor meta description appears more complete for search results.");
    mustFix.push("Improve your meta description so it better explains value and boosts click-through rate.");
    standoutDifferences.push("Search snippet quality favors the competitor.");
  }

  if (hasContent(competitor.scanData.h1) && !hasContent(primary.scanData.h1)) {
    competitorWins.push("Competitor has a clearer visible H1 structure.");
    mustFix.push("Add or improve your H1 so users instantly understand the page purpose.");
    standoutDifferences.push("Page hierarchy is clearer on the competitor page.");
  }

  if (hasContent(competitor.scanData.cta) && !hasContent(primary.scanData.cta)) {
    competitorWins.push("Competitor has a detected CTA while your page lacks a clear primary CTA.");
    mustFix.push("Add one clear primary CTA above the fold.");
    standoutDifferences.push("Competitor provides a more obvious next step.");
  }

  if (competitor.scanData.buttons > primary.scanData.buttons) {
    competitorWins.push("Competitor uses more button-driven actions to guide the user.");
    mustFix.push("Review CTA placement and add stronger action points on the page.");
    standoutDifferences.push("Competitor has stronger action density.");
  }

  if (competitor.scanData.images > primary.scanData.images) {
    competitorWins.push("Competitor uses more visual content, which may improve trust and comprehension.");
    mustFix.push("Add stronger visual proof like screenshots, examples or trust visuals.");
    standoutDifferences.push("Competitor page is more visually supported.");
  }

  if (competitor.scanData.links > primary.scanData.links) {
    competitorWins.push("Competitor has a stronger internal link structure.");
    mustFix.push("Improve internal linking so the page feels more connected and easier to navigate.");
    standoutDifferences.push("Competitor has better structural linking.");
  }

  (primary.priorityFixes || []).forEach((item) => {
    if (mustFix.length < 5) mustFix.push(item);
  });

  const scoreDiff = primary.score - competitor.score;

  let winnerLabel = "";
  let winnerClass = "";
  let summary = "";

  if (scoreDiff > 0) {
    winnerLabel = `You lead by ${scoreDiff} points`;
    winnerClass = "success";
    summary = "Your page currently performs better overall, but the benchmark still shows where clarity, trust and CTA structure can improve.";
  } else if (scoreDiff < 0) {
    winnerLabel = `Competitor leads by ${Math.abs(scoreDiff)} points`;
    winnerClass = "danger";
    summary = "The competitor currently has the stronger page. This comparison highlights the most important gaps to close first.";
  } else {
    winnerLabel = "Currently tied";
    winnerClass = "warning";
    summary = "Both pages are currently tied on score. Use the differences below to find the next edge.";
  }

  return {
    summary,
    winnerLabel,
    winnerClass,
    competitorWins: dedupeList(competitorWins).slice(0, 5),
    mustFix: dedupeList(mustFix).slice(0, 5),
    standoutDifferences: dedupeList(standoutDifferences).slice(0, 4)
  };
}

async function generateAiComparison(primary, competitor, fallbackComparison) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallbackComparison;
  }

  const model =
    process.env.OPENAI_COMPARE_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4o-mini";

  const payload = {
    model,
    temperature: 0.3,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "sitepilot_compare",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
            winnerLabel: { type: "string" },
            winnerClass: { type: "string", enum: ["success", "warning", "danger"] },
            competitorWins: {
              type: "array",
              items: { type: "string" },
              minItems: 3,
              maxItems: 5
            },
            mustFix: {
              type: "array",
              items: { type: "string" },
              minItems: 3,
              maxItems: 5
            },
            standoutDifferences: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 4
            }
          },
          required: [
            "summary",
            "winnerLabel",
            "winnerClass",
            "competitorWins",
            "mustFix",
            "standoutDifferences"
          ]
        }
      }
    },
    messages: [
      {
        role: "system",
        content:
          "You are SitePilot, an expert SaaS website analyst. Compare two landing pages using only the provided scan data. Be concrete, business-oriented, concise, and practical. Do not invent facts outside the provided data."
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task: "Compare these two websites and return exactly the required JSON schema.",
            primary,
            competitor,
            fallbackComparison
          },
          null,
          2
        )
      }
    ]
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await safeReadJson(response);

    if (!response.ok) {
      console.error("OpenAI compare error:", data);
      return fallbackComparison;
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) return fallbackComparison;

    const parsed = JSON.parse(content);

    return {
      summary: safeString(parsed.summary, fallbackComparison.summary),
      winnerLabel: safeString(parsed.winnerLabel, fallbackComparison.winnerLabel),
      winnerClass: ["success", "warning", "danger"].includes(parsed.winnerClass)
        ? parsed.winnerClass
        : fallbackComparison.winnerClass,
      competitorWins: normalizeArray(parsed.competitorWins).slice(0, 5),
      mustFix: normalizeArray(parsed.mustFix).slice(0, 5),
      standoutDifferences: normalizeArray(parsed.standoutDifferences).slice(0, 4)
    };
  } catch (error) {
    console.error("generateAiComparison error:", error);
    return fallbackComparison;
  }
}

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing auth token"
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return res.status(401).json({
        error: "Invalid auth token"
      });
    }

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({
        error: "Invalid user",
        details: userError?.message || "Could not resolve authenticated user."
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const payload = {
      url: safeString(body.url, "Unknown"),
      score: clampNumber(safeNumber(body.score, 0), 0, 100),
      user_id: user.id,
      data: {
        scanData: normalizeScanData(body.scanData),
        issues: normalizeArray(body.issues),
        feedback: normalizeArray(body.feedback),
        priorityFixes: normalizeArray(body.priorityFixes),
        topNextActions: normalizeArray(body.topNextActions)
      }
    };

    const { data, error } = await supabase
      .from("scans")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      return res.status(500).json({
        error: "Failed to save scan",
        details: error.message
      });
    }

    return res.status(200).json({
      success: true,
      id: data?.id || null
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error?.message || "Unknown error"
    });
  }
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
    return value.map((item) => safeString(item)).filter(Boolean).slice(0, 50);
  }
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 50);
  }
  return [];
}

function normalizeScanData(scanData) {
  const source = scanData || {};

  return {
    title: safeString(source.title, ""),
    metaDescription: safeString(source.metaDescription, ""),
    h1: safeString(source.h1, ""),
    links: safeNumber(source.links, 0),
    images: safeNumber(source.images, 0),
    buttons: safeNumber(source.buttons, 0),
    cta: safeString(source.cta, "")
  };
}

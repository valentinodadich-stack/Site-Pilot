import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req, res) {
  if (req.method !== "GET") {
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

    const { data, error } = await supabase
      .from("scans")
      .select("id, url, score, data, created_at, user_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return res.status(500).json({
        error: "Failed to load history",
        details: error.message
      });
    }

    return res.status(200).json({
      history: Array.isArray(data) ? data : []
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error?.message || "Unknown error"
    });
  }
}

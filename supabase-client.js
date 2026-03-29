const SUPABASE_URL = "PASTE_YOUR_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_KEY_HERE";

if (!window.supabase || typeof window.supabase.createClient !== "function") {
  throw new Error("Supabase client library failed to load.");
}

window.sitePilotSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

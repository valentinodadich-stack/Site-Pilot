const SUPABASE_URL = "https://vzdxrpytdkzdjfovcnkz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Y1RmHPVAuBYu_QraFpr1_w_uaV1DQJz";

if (!window.supabase || typeof window.supabase.createClient !== "function") {
  throw new Error("Supabase client library failed to load.");
}

window.sitePilotSupabase = window.supabase.createClient(
  https://vzdxrpytdkzdjfovcnkz.supabase.co,
  sb_publishable_Y1RmHPVAuBYu_QraFpr1_w_uaV1DQJz
);

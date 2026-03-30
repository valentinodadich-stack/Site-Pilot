const SUPABASE_URL = "https://vzdxrpytdkzdjfovcnkz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZHhycHl0ZGt6ZGpmb3Zjbmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDY2ODAsImV4cCI6MjA5MDI4MjY4MH0.KusdrJIZMymr0bs-YSpUefqbUsbx0ZbdPdCqCane8A4";

window.sitePilotSupabase = null;
window.sitePilotSupabaseInitError = "";

try {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Supabase browser library failed to load.");
  }

  if (
    !SUPABASE_URL ||
    SUPABASE_URL.includes("https://vzdxrpytdkzdjfovcnkz.supabase.co") ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_ANON_KEY.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZHhycHl0ZGt6ZGpmb3Zjbmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDY2ODAsImV4cCI6MjA5MDI4MjY4MH0.KusdrJIZMymr0bs-YSpUefqbUsbx0ZbdPdCqCane8A4")
  ) {
    throw new Error("Supabase URL or anon key is still a placeholder.");
  }

  window.sitePilotSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
} catch (error) {
  console.error("Supabase init error:", error);
  window.sitePilotSupabaseInitError = error.message || String(error);
}

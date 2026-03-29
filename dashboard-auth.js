const supabase = window.sitePilotSupabase;
const logoutBtn = document.getElementById("logoutBtn");

initDashboardAuth();

if (logoutBtn) {
  logoutBtn.addEventListener("click", handleLogout);
}

async function initDashboardAuth() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      window.location.href = "./auth.html";
      return;
    }

    if (!data?.session) {
      window.location.href = "./auth.html";
      return;
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        window.location.href = "./auth.html";
      }
    });
  } catch {
    window.location.href = "./auth.html";
  }
}

async function handleLogout() {
  if (!logoutBtn) return;

  const originalText = logoutBtn.textContent;
  logoutBtn.disabled = true;
  logoutBtn.textContent = "Logging out...";

  try {
    await supabase.auth.signOut();
    window.location.href = "./auth.html";
  } catch {
    logoutBtn.disabled = false;
    logoutBtn.textContent = originalText;
  }
}

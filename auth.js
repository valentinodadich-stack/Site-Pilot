const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const signupBtn = document.getElementById("signupBtn");
const loginBtn = document.getElementById("loginBtn");
const authStatus = document.getElementById("authStatus");

const supabase = window.sitePilotSupabase;

initAuthPage();

signupBtn.addEventListener("click", handleSignUp);
loginBtn.addEventListener("click", handleLogin);

passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleLogin();
  }
});

async function initAuthPage() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      showStatus(error.message || "Failed to check session.", "error");
      return;
    }

    if (data?.session) {
      window.location.href = "./dashboard.html";
      return;
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        window.location.href = "./dashboard.html";
      }
    });
  } catch (error) {
    showStatus(error.message || String(error), "error");
  }
}

async function handleSignUp() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showStatus("Enter email and password.", "error");
    return;
  }

  if (password.length < 6) {
    showStatus("Password must be at least 6 characters.", "error");
    return;
  }

  setLoading(true, "signup");
  showStatus("Creating account...", "");

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getDashboardUrl()
      }
    });

    if (error) {
      showStatus(error.message || "Sign up failed.", "error");
      return;
    }

    if (data?.session) {
      showStatus("Account created. Redirecting to dashboard...", "success");
      setTimeout(() => {
        window.location.href = "./dashboard.html";
      }, 500);
      return;
    }

    showStatus(
      "Account created. Check your email and confirm your account before logging in.",
      "success"
    );
  } catch (error) {
    showStatus(error.message || String(error), "error");
  } finally {
    setLoading(false, "signup");
  }
}

async function handleLogin() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showStatus("Enter email and password.", "error");
    return;
  }

  setLoading(true, "login");
  showStatus("Logging in...", "");

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      showStatus(error.message || "Login failed.", "error");
      return;
    }

    if (data?.session) {
      showStatus("Login successful. Redirecting...", "success");
      setTimeout(() => {
        window.location.href = "./dashboard.html";
      }, 300);
      return;
    }

    showStatus("Login did not create a session.", "error");
  } catch (error) {
    showStatus(error.message || String(error), "error");
  } finally {
    setLoading(false, "login");
  }
}

function setLoading(isLoading, mode) {
  signupBtn.disabled = isLoading;
  loginBtn.disabled = isLoading;

  signupBtn.textContent =
    isLoading && mode === "signup" ? "Creating..." : "Sign Up";

  loginBtn.textContent =
    isLoading && mode === "login" ? "Logging in..." : "Log In";
}

function showStatus(message, type) {
  authStatus.textContent = message;
  authStatus.className = "auth-status";
  if (type) {
    authStatus.classList.add(type);
  }
}

function getDashboardUrl() {
  return `${window.location.origin}/dashboard.html`;
}

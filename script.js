const urlInput = document.getElementById("urlInput");
const scanBtn = document.getElementById("scanBtn");
const statusBox = document.getElementById("status");
const resultBox = document.getElementById("result");
const historyBox = document.getElementById("historyBox");

let scanHistory = [];
let lastScanData = null;

loadHistoryFromDatabase();

scanBtn.addEventListener("click", handleScan);

urlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleScan();
  }
});

async function handleScan() {
  const url = urlInput.value.trim();

  if (!url) {
    statusBox.textContent = "Please enter a URL.";
    resultBox.innerHTML = "";
    return;
  }

  setLoadingState(true);
  statusBox.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px;">
      <span class="spinner"></span>
      <span>Scanning website...</span>
    </div>
  `;
  resultBox.innerHTML = "";

  try {
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    if (!response.ok) {
      statusBox.textContent = "Scan failed.";
      resultBox.innerHTML = `
        <div class="sp-card" style="border:1px solid var(--danger-border); background:var(--danger-bg);">
          <h3 style="margin-top:0; color:var(--danger-text);">Error</h3>
          <p style="margin-bottom:0; color:var(--text);">${escapeHtml(data.error || "Something went wrong.")}</p>
        </div>
      `;
      return;
    }

    lastScanData = data;

    let saveMessage = "";

    try {
      const saveResponse = await fetch("/api/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: data.url,
          score: data.score,
          scanData: data.scanData,
          issues: data.issues,
          feedback: data.feedback
        })
      });

      const saveData = await saveResponse.json();

      if (!saveResponse.ok) {
        saveMessage = `Save failed: ${saveData.error || "Unknown error"}${saveData.details ? " | " + saveData.details : ""}`;
        console.error("Save failed:", saveData);
      } else {
        saveMessage = "Scan saved to database.";
        await loadHistoryFromDatabase();
      }
    } catch (e) {
      saveMessage = `Save request failed: ${e.message || e}`;
      console.error("Save request failed", e);
    }

    statusBox.textContent = `Scan completed. ${saveMessage}`;
    renderFullScan(data);
  } catch (error) {
    statusBox.textContent = "Request failed.";
    resultBox.innerHTML = `
      <div class="sp-card" style="border:1px solid var(--danger-border); background:var(--danger-bg);">
        <h3 style="margin-top:0; color:var(--danger-text);">Error</h3>
        <p style="margin-bottom:0; color:var(--text);">${escapeHtml(error.message || String(error))}</p>
      </div>
    `;
  } finally {
    setLoadingState(false);
  }
}

async function loadHistoryFromDatabase() {
  try {
    const response = await fetch("/api/history");
    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to load history:", data);
      historyBox.innerHTML = `
        <div class="sp-card" style="margin-top:20px; border:1px solid var(--danger-border); background:var(--danger-bg);">
          <h3 style="margin-top:0; color:var(--danger-text);">History Error</h3>
          <p><strong>Error:</strong> ${escapeHtml(data.error || "Failed to load history.")}</p>
          <p style="margin-bottom:0;"><strong>Details:</strong> ${escapeHtml(data.details || "No details available.")}</p>
        </div>
      `;
      return;
    }

    scanHistory = Array.isArray(data.history) ? data.history : [];
    renderHistory();
  } catch (error) {
    console.error("History request failed:", error);
    historyBox.innerHTML = `
      <div class="sp-card" style="margin-top:20px; border:1px solid var(--danger-border); background:var(--danger-bg);">
        <h3 style="margin-top:0; color:var(--danger-text);">History Error</h3>
        <p style="margin-bottom:0;">${escapeHtml(error.message || String(error))}</p>
      </div>
    `;
  }
}

function renderFullScan(data) {
  resultBox.innerHTML = renderResult(data);
  attachCopyButton(data.feedback || []);
  attachFixButtons();
  attachDownloadPdfButton();
}

function openHistoryScan(index) {
  const item = scanHistory[index];
  if (!item) return;

  const reconstructed = {
    url: item.url || "Unknown",
    score: item.score ?? 0,
    scanData: {
      title: item.data?.scanData?.title || "",
      metaDescription: item.data?.scanData?.metaDescription || "",
      h1: item.data?.scanData?.h1 || "",
      links: item.data?.scanData?.links ?? 0,
      images: item.data?.scanData?.images ?? 0,
      buttons: item.data?.scanData?.buttons ?? 0,
      cta: item.data?.scanData?.cta || ""
    },
    issues: Array.isArray(item.data?.issues) ? item.data.issues : [],
    feedback: Array.isArray(item.data?.feedback) ? item.data.feedback : []
  };

  lastScanData = reconstructed;
  urlInput.value = reconstructed.url;
  statusBox.textContent = `Loaded saved scan from ${item.created_at || "database"}.`;
  renderFullScan(reconstructed);

  resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setLoadingState(isLoading) {
  scanBtn.disabled = isLoading;
  scanBtn.textContent = isLoading ? "Scanning..." : "Scan Website";
  urlInput.disabled = isLoading;
}

function renderResult(data) {
  const scoreColor = getScoreColor(data.score);

  return `
    <div style="display:flex; flex-direction:column; gap:20px; margin-top:20px;">
      
      <div class="sp-card">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;">
          <div>
            <p style="margin:0; font-size:14px; color:var(--muted-text);">Scanned website</p>
            <h2 style="margin:6px 0 0 0; font-size:22px; word-break:break-word; color:var(--text);">${escapeHtml(data.url)}</h2>
          </div>

          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <button id="downloadPdfBtn" class="sp-button-secondary">
              Download PDF
            </button>

            <div style="
              min-width:120px;
              text-align:center;
              padding:16px;
              border-radius:14px;
              background:${scoreColor.background};
              color:${scoreColor.text};
              font-weight:bold;
              font-size:28px;
            ">
              ${data.score}/100
            </div>
          </div>
        </div>
      </div>

      <div class="sp-card">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <h3 style="margin-top:0; margin-bottom:0; color:var(--text);">Scan Data</h3>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="fixTitleBtn" class="sp-button-secondary">Fix Title</button>
            <button id="fixMetaBtn" class="sp-button-secondary">Fix Meta</button>
            <button id="fixH1Btn" class="sp-button-secondary">Fix H1</button>
          </div>
        </div>

        <p><strong>Title:</strong> ${escapeHtml(data.scanData.title || "None")}</p>
        <p><strong>Meta Description:</strong> ${escapeHtml(data.scanData.metaDescription || "None")}</p>
        <p><strong>H1:</strong> ${escapeHtml(data.scanData.h1 || "None")}</p>
        <p><strong>Links:</strong> ${data.scanData.links}</p>
        <p><strong>Images:</strong> ${data.scanData.images}</p>
        <p><strong>Buttons:</strong> ${data.scanData.buttons}</p>
        <p><strong>CTA Found:</strong> ${escapeHtml(data.scanData.cta || "None")}</p>
      </div>

      <div id="fixResultsBox"></div>

      <div class="sp-card">
        <h3 style="margin-top:0; color:var(--text);">Issues</h3>
        ${
          data.issues && data.issues.length
            ? `<ul style="padding-left:20px; margin-bottom:0;">
                ${data.issues.map(issue => `
                  <li style="margin-bottom:10px; color:var(--text);">${escapeHtml(issue)}</li>
                `).join("")}
              </ul>`
            : `<p style="margin-bottom:0;">No major issues found.</p>`
        }
      </div>

      <div class="sp-card">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h3 style="margin:0; color:var(--text);">AI Feedback</h3>
            <span class="sp-pill">AI Powered</span>
          </div>
          <button id="copyFeedbackBtn" class="sp-button-secondary">
            Copy Feedback
          </button>
        </div>
        <div style="margin-top:16px; display:flex; flex-direction:column; gap:12px;">
          ${
            data.feedback && data.feedback.length
              ? data.feedback.map(item => `
                  <div class="sp-subcard">
                    ${escapeHtml(item)}
                  </div>
                `).join("")
              : `<p>No feedback available.</p>`
          }
        </div>
      </div>

    </div>
  `;
}

function renderHistory() {
  if (!scanHistory.length) {
    historyBox.innerHTML = `
      <div class="sp-card" style="margin-top:24px;">
        <h3 style="margin-top:0; color:var(--text);">Recent Scans</h3>
        <p style="margin-bottom:0;">No scans saved yet.</p>
      </div>
    `;
    return;
  }

  historyBox.innerHTML = `
    <div class="sp-card" style="margin-top:24px;">
      <h3 style="margin-top:0; color:var(--text);">Recent Scans (Database)</h3>
      <div style="display:flex; flex-direction:column; gap:12px; margin-top:16px;">
        ${scanHistory.map((item, index) => `
          <button
            data-history-index="${index}"
            class="sp-history-item"
          >
            <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <strong style="word-break:break-word; color:var(--text);">${escapeHtml(item.url || "Unknown")}</strong>
              <span style="color:var(--text);">${item.score ?? "N/A"}/100</span>
            </div>
            <div style="margin-top:6px; font-size:13px; color:var(--muted-text);">
              ${escapeHtml(item.created_at || "")}
            </div>
          </button>
        `).join("")}
      </div>
    </div>
  `;

  const buttons = historyBox.querySelectorAll("[data-history-index]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.getAttribute("data-history-index"));
      openHistoryScan(index);
    });
  });
}

function attachDownloadPdfButton() {
  const pdfBtn = document.getElementById("downloadPdfBtn");
  if (!pdfBtn) return;

  pdfBtn.addEventListener("click", async () => {
    if (!lastScanData) {
      alert("No scan data available.");
      return;
    }

    const originalText = pdfBtn.textContent;
    pdfBtn.disabled = true;
    pdfBtn.textContent = "Generating PDF...";

    try {
      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ data: lastScanData })
      });

      if (!response.ok) {
        let errorMessage = "Failed to generate PDF.";

        try {
          const errorData = await response.json();
          errorMessage = errorData.details
            ? `${errorData.error}: ${errorData.details}`
            : (errorData.error || errorMessage);
        } catch {}

        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `sitepilot-report-${makeSafeFileName(lastScanData.url)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      alert("PDF failed: " + (error.message || String(error)));
    } finally {
      pdfBtn.disabled = false;
      pdfBtn.textContent = originalText;
    }
  });
}

function attachFixButtons() {
  const fixTitleBtn = document.getElementById("fixTitleBtn");
  const fixMetaBtn = document.getElementById("fixMetaBtn");
  const fixH1Btn = document.getElementById("fixH1Btn");

  if (fixTitleBtn) fixTitleBtn.addEventListener("click", () => handleFix("title"));
  if (fixMetaBtn) fixMetaBtn.addEventListener("click", () => handleFix("meta"));
  if (fixH1Btn) fixH1Btn.addEventListener("click", () => handleFix("h1"));
}

async function handleFix(type) {
  if (!lastScanData) return;

  const box = document.getElementById("fixResultsBox");
  if (!box) return;

  box.innerHTML = `
    <div class="sp-card">
      <div style="display:flex; align-items:center; gap:10px;">
        <span class="spinner"></span>
        <span>Generating AI ${escapeHtml(type)} suggestions...</span>
      </div>
    </div>
  `;

  try {
    const response = await fetch("/api/fix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type,
        url: lastScanData.url,
        scanData: lastScanData.scanData
      })
    });

    const data = await response.json();

    if (!response.ok) {
      box.innerHTML = `
        <div class="sp-card" style="border:1px solid var(--danger-border); background:var(--danger-bg);">
          <h3 style="margin-top:0; color:var(--danger-text);">Fix Error</h3>
          <p style="margin-bottom:0;">${escapeHtml(data.error || "Failed to generate suggestions.")}</p>
        </div>
      `;
      return;
    }

    box.innerHTML = `
      <div class="sp-card">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <h3 style="margin:0; color:var(--text);">AI ${escapeHtml(type.toUpperCase())} Suggestions</h3>
          <button id="copyFixBtn" class="sp-button-secondary">
            Copy Suggestions
          </button>
        </div>
        <div style="margin-top:16px; display:flex; flex-direction:column; gap:12px;">
          ${
            data.suggestions && data.suggestions.length
              ? data.suggestions.map(item => `
                  <div class="sp-subcard">
                    ${escapeHtml(item)}
                  </div>
                `).join("")
              : `<p>No suggestions available.</p>`
          }
        </div>
      </div>
    `;

    attachCopyFixButton(data.suggestions || []);
  } catch (error) {
    box.innerHTML = `
      <div class="sp-card" style="border:1px solid var(--danger-border); background:var(--danger-bg);">
        <h3 style="margin-top:0; color:var(--danger-text);">Fix Error</h3>
        <p style="margin-bottom:0;">${escapeHtml(error.message || String(error))}</p>
      </div>
    `;
  }
}

function attachCopyFixButton(suggestions) {
  const copyBtn = document.getElementById("copyFixBtn");
  if (!copyBtn) return;

  copyBtn.addEventListener("click", async () => {
    const text = suggestions.map((item, index) => `${index + 1}. ${item}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy Suggestions"; }, 1500);
    } catch {
      copyBtn.textContent = "Copy failed";
      setTimeout(() => { copyBtn.textContent = "Copy Suggestions"; }, 1500);
    }
  });
}

function attachCopyButton(feedback) {
  const copyBtn = document.getElementById("copyFeedbackBtn");
  if (!copyBtn) return;

  copyBtn.addEventListener("click", async () => {
    const text = feedback.map((item, index) => `${index + 1}. ${item}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy Feedback"; }, 1500);
    } catch {
      copyBtn.textContent = "Copy failed";
      setTimeout(() => { copyBtn.textContent = "Copy Feedback"; }, 1500);
    }
  });
}

function setLoadingState(isLoading) {
  scanBtn.disabled = isLoading;
  scanBtn.textContent = isLoading ? "Scanning..." : "Scan Website";
  urlInput.disabled = isLoading;
}

function getScoreColor(score) {
  if (score >= 80) return { background: "rgba(16,185,129,0.15)", text: "#10b981" };
  if (score >= 50) return { background: "rgba(245,158,11,0.15)", text: "#f59e0b" };
  return { background: "rgba(239,68,68,0.15)", text: "#ef4444" };
}

function makeSafeFileName(url) {
  return String(url)
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 60);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

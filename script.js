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

async function safeReadJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: "Invalid JSON response from server",
      details: text
    };
  }
}

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

    const data = await safeReadJson(response);

    if (!response.ok) {
      statusBox.textContent = "Scan failed.";
      resultBox.innerHTML = renderErrorCard(
        "Error",
        data.error || "Something went wrong.",
        data.details || "No details available."
      );
      return;
    }

    lastScanData = normalizeScanForApp(data);

    let saveMessage = "";

    try {
      const saveResponse = await fetch("/api/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: lastScanData.url,
          score: lastScanData.score,
          scanData: lastScanData.scanData,
          issues: lastScanData.issues,
          feedback: lastScanData.feedback,
          priorityFixes: lastScanData.priorityFixes,
          topNextActions: lastScanData.topNextActions
        })
      });

      const saveData = await safeReadJson(saveResponse);

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
    renderFullScan(lastScanData);
  } catch (error) {
    statusBox.textContent = "Request failed.";
    resultBox.innerHTML = renderErrorCard(
      "Error",
      error.message || String(error),
      ""
    );
  } finally {
    setLoadingState(false);
  }
}

async function loadHistoryFromDatabase() {
  try {
    const response = await fetch("/api/history");
    const data = await safeReadJson(response);

    if (!response.ok) {
      console.error("Failed to load history:", data);
      historyBox.innerHTML = renderHistoryError(
        data.error || "Failed to load history.",
        data.details || "No details available."
      );
      return;
    }

    scanHistory = Array.isArray(data.history) ? data.history : [];
    renderHistory();
  } catch (error) {
    console.error("History request failed:", error);
    historyBox.innerHTML = renderHistoryError(
      error.message || String(error),
      ""
    );
  }
}

function renderFullScan(data) {
  const normalized = normalizeScanForApp(data);
  lastScanData = normalized;

  renderPremiumResults(normalized);
  attachCopyButton(normalized.feedback || []);
  attachFixButtons();
  attachDownloadPdfButton();
}

function renderPremiumResults(data) {
  const uiPayload = {
    url: data.url,
    score: data.score,
    scanData: {
      title: data.scanData?.title || "",
      metaDescription: data.scanData?.metaDescription || "",
      h1: data.scanData?.h1 || "",
      links: data.scanData?.links ?? 0,
      images: data.scanData?.images ?? 0,
      buttons: data.scanData?.buttons ?? 0,
      cta: data.scanData?.cta || ""
    },
    issues: data.issues || [],
    feedback: data.feedback || [],
    priorityFixes: data.priorityFixes || [],
    topNextActions: data.topNextActions || []
  };

  if (window.SitePilotResultsUI && typeof window.SitePilotResultsUI.render === "function") {
    window.SitePilotResultsUI.render(
      {
        url: uiPayload.url,
        score: uiPayload.score,
        title: uiPayload.scanData.title,
        metaDescription: uiPayload.scanData.metaDescription,
        h1: uiPayload.scanData.h1,
        cta: uiPayload.scanData.cta,
        linkCount: uiPayload.scanData.links,
        imageCount: uiPayload.scanData.images,
        buttonCount: uiPayload.scanData.buttons,
        issues: uiPayload.issues,
        aiFeedback: uiPayload.feedback,
        priorityFixes: uiPayload.priorityFixes,
        topNextActions: uiPayload.topNextActions
      },
      "#result"
    );

    appendActionBlocks(data);
    return;
  }

  resultBox.innerHTML = renderFallbackResult(data);
}

function appendActionBlocks(data) {
  const wrapper = document.createElement("div");
  wrapper.style.display = "grid";
  wrapper.style.gap = "20px";
  wrapper.style.marginTop = "20px";

  wrapper.innerHTML = `
    <article class="sp-card">
      <div class="sp-card-inner">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h3 style="margin:0; color:var(--sp-text, var(--text));">Actions</h3>
            <span class="sp-section-tag accent">Tools</span>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="downloadPdfBtn" class="sp-button-secondary">Download PDF</button>
            <button id="copyFeedbackBtn" class="sp-button-secondary">Copy Feedback</button>
            <button id="fixTitleBtn" class="sp-button-secondary">Fix Title</button>
            <button id="fixMetaBtn" class="sp-button-secondary">Fix Meta</button>
            <button id="fixH1Btn" class="sp-button-secondary">Fix H1</button>
          </div>
        </div>
      </div>
    </article>

    <div id="fixResultsBox"></div>
  `;

  resultBox.appendChild(wrapper);
}

function openHistoryScan(index) {
  const item = scanHistory[index];
  if (!item) return;

  const reconstructed = normalizeScanForApp({
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
    feedback: Array.isArray(item.data?.feedback) ? item.data.feedback : [],
    priorityFixes: Array.isArray(item.data?.priorityFixes) ? item.data.priorityFixes : [],
    topNextActions: Array.isArray(item.data?.topNextActions) ? item.data.topNextActions : []
  });

  lastScanData = reconstructed;
  urlInput.value = reconstructed.url;
  statusBox.textContent = `Loaded saved scan from ${item.created_at || "database"}.`;
  renderFullScan(reconstructed);

  resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderHistory() {
  if (!scanHistory.length) {
    historyBox.innerHTML = `
      <div class="sp-card" style="margin-top:24px;">
        <div class="sp-card-inner">
          <h3 style="margin-top:0; color:var(--sp-text, var(--text));">Recent Scans</h3>
          <p style="margin-bottom:0;">No scans saved yet.</p>
        </div>
      </div>
    `;
    return;
  }

  historyBox.innerHTML = `
    <div class="sp-card" style="margin-top:24px;">
      <div class="sp-card-inner">
        <h3 style="margin-top:0; color:var(--sp-text, var(--text));">Recent Scans (Database)</h3>
        <div style="display:flex; flex-direction:column; gap:12px; margin-top:16px;">
          ${scanHistory
            .map(
              (item, index) => `
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
              `
            )
            .join("")}
        </div>
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
      const pdfResponse = await fetch("/api/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ data: lastScanData })
      });

      if (!pdfResponse.ok) {
        const errorData = await safeReadJson(pdfResponse);
        let errorMessage = "Failed to generate PDF.";
        errorMessage = errorData.details
          ? `${errorData.error}: ${errorData.details}`
          : (errorData.error || errorMessage);
        throw new Error(errorMessage);
      }

      const blob = await pdfResponse.blob();
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
      <div class="sp-card-inner">
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="spinner"></span>
          <span>Generating AI ${escapeHtml(type)} suggestions...</span>
        </div>
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

    const data = await safeReadJson(response);

    if (!response.ok) {
      box.innerHTML = renderFixError(data.error || "Failed to generate suggestions.");
      return;
    }

    box.innerHTML = `
      <article class="sp-card">
        <div class="sp-card-inner">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <h3 style="margin:0; color:var(--sp-text, var(--text));">AI ${escapeHtml(type.toUpperCase())} Suggestions</h3>
            <button id="copyFixBtn" class="sp-button-secondary">Copy Suggestions</button>
          </div>
          <div style="margin-top:16px; display:flex; flex-direction:column; gap:12px;">
            ${
              data.suggestions && data.suggestions.length
                ? data.suggestions
                    .map(
                      (item) => `
                        <div class="sp-subcard">
                          ${escapeHtml(item)}
                        </div>
                      `
                    )
                    .join("")
                : `<p>No suggestions available.</p>`
            }
          </div>
        </div>
      </article>
    `;

    attachCopyFixButton(data.suggestions || []);
  } catch (error) {
    box.innerHTML = renderFixError(error.message || String(error));
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
      setTimeout(() => {
        copyBtn.textContent = "Copy Suggestions";
      }, 1500);
    } catch {
      copyBtn.textContent = "Copy failed";
      setTimeout(() => {
        copyBtn.textContent = "Copy Suggestions";
      }, 1500);
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
      setTimeout(() => {
        copyBtn.textContent = "Copy Feedback";
      }, 1500);
    } catch {
      copyBtn.textContent = "Copy failed";
      setTimeout(() => {
        copyBtn.textContent = "Copy Feedback";
      }, 1500);
    }
  });
}

function normalizeScanForApp(data) {
  const source = data?.data || data || {};
  const scanDataSource = source.scanData || {};

  const normalized = {
    url: safeString(source.url, "Unknown"),
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

  const unique = [];
  const seen = new Set();

  for (const item of actions) {
    const clean = safeString(item);
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      unique.push(clean);
    }
    if (unique.length >= 5) break;
  }

  return unique;
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

function setLoadingState(isLoading) {
  scanBtn.disabled = isLoading;
  scanBtn.textContent = isLoading ? "Scanning..." : "Scan Website";
  urlInput.disabled = isLoading;
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

function makeSafeFileName(url) {
  return String(url)
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 60);
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderErrorCard(title, message, details) {
  return `
    <div class="sp-card" style="border:1px solid var(--danger-border); background:var(--danger-bg); margin-top:20px;">
      <div class="sp-card-inner">
        <h3 style="margin-top:0; color:var(--danger-text);">${escapeHtml(title)}</h3>
        <p><strong>Message:</strong> ${escapeHtml(message)}</p>
        ${
          details
            ? `<p style="margin-bottom:0;"><strong>Details:</strong> ${escapeHtml(details)}</p>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderHistoryError(message, details) {
  return `
    <div class="sp-card" style="margin-top:20px; border:1px solid var(--danger-border); background:var(--danger-bg);">
      <div class="sp-card-inner">
        <h3 style="margin-top:0; color:var(--danger-text);">History Error</h3>
        <p><strong>Error:</strong> ${escapeHtml(message)}</p>
        ${
          details
            ? `<p style="margin-bottom:0;"><strong>Details:</strong> ${escapeHtml(details)}</p>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderFixError(message) {
  return `
    <div class="sp-card" style="border:1px solid var(--danger-border); background:var(--danger-bg);">
      <div class="sp-card-inner">
        <h3 style="margin-top:0; color:var(--danger-text);">Fix Error</h3>
        <p style="margin-bottom:0;">${escapeHtml(message)}</p>
      </div>
    </div>
  `;
}

function renderFallbackResult(data) {
  return `
    <div style="display:flex; flex-direction:column; gap:20px; margin-top:20px;">
      <div class="sp-card">
        <div class="sp-card-inner">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;">
            <div>
              <p style="margin:0; font-size:14px; color:var(--muted-text);">Scanned website</p>
              <h2 style="margin:6px 0 0 0; font-size:22px; word-break:break-word; color:var(--text);">${escapeHtml(data.url)}</h2>
            </div>

            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
              <button id="downloadPdfBtn" class="sp-button-secondary">Download PDF</button>

              <div style="
                min-width:120px;
                text-align:center;
                padding:16px;
                border-radius:14px;
                background:rgba(79,70,229,0.12);
                color:#4f46e5;
                font-weight:bold;
                font-size:28px;
              ">
                ${data.score}/100
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="sp-card">
        <div class="sp-card-inner">
          <h3 style="margin-top:0;">Priority Fixes</h3>
          ${
            data.priorityFixes && data.priorityFixes.length
              ? data.priorityFixes.map((item) => `<p>${escapeHtml(item)}</p>`).join("")
              : `<p>No priority fixes available.</p>`
          }
        </div>
      </div>

      <div class="sp-card">
        <div class="sp-card-inner">
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
            <button id="copyFeedbackBtn" class="sp-button-secondary">Copy Feedback</button>
            <button id="fixTitleBtn" class="sp-button-secondary">Fix Title</button>
            <button id="fixMetaBtn" class="sp-button-secondary">Fix Meta</button>
            <button id="fixH1Btn" class="sp-button-secondary">Fix H1</button>
          </div>
          <div id="fixResultsBox"></div>
        </div>
      </div>
    </div>
  `;
}

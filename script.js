const urlInput = document.getElementById("urlInput");
const competitorInput = document.getElementById("competitorInput");
const scanBtn = document.getElementById("scanBtn");
const compareBtn = document.getElementById("compareBtn");
const statusBox = document.getElementById("status");
const resultBox = document.getElementById("result");
const historyBox = document.getElementById("historyBox");

let scanHistory = [];
let lastScanData = null;

loadHistoryFromDatabase();

scanBtn.addEventListener("click", handleScan);
compareBtn.addEventListener("click", handleCompare);

urlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleScan();
  }
});

competitorInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleCompare();
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

  setLoadingState(true, "scan");
  statusBox.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px;">
      <span class="spinner"></span>
      <span>Scanning website...</span>
    </div>
  `;
  resultBox.innerHTML = "";

  try {
    const data = await runScan(url);
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
    statusBox.textContent = "Scan failed.";
    resultBox.innerHTML = renderErrorCard(
      "Error",
      error.message || String(error),
      ""
    );
  } finally {
    setLoadingState(false, "scan");
  }
}

async function handleCompare() {
  const primaryUrl = urlInput.value.trim();
  const competitorUrl = competitorInput.value.trim();

  if (!primaryUrl || !competitorUrl) {
    statusBox.textContent = "Enter both your website and competitor website.";
    resultBox.innerHTML = "";
    return;
  }

  if (normalizeUrlForCompare(primaryUrl) === normalizeUrlForCompare(competitorUrl)) {
    statusBox.textContent = "Your website and competitor website must be different.";
    resultBox.innerHTML = "";
    return;
  }

  setLoadingState(true, "compare");
  statusBox.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px;">
      <span class="spinner"></span>
      <span>Comparing both websites...</span>
    </div>
  `;
  resultBox.innerHTML = "";

  try {
    const response = await fetch("/api/compare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        primaryUrl,
        competitorUrl
      })
    });

    const data = await safeReadJson(response);

    if (!response.ok) {
      throw new Error(
        data.details
          ? `${data.error || "Comparison failed"}: ${data.details}`
          : (data.error || "Comparison failed")
      );
    }

    const primary = normalizeScanForApp(data.primary);
    const competitor = normalizeScanForApp(data.competitor);
    const comparison = normalizeComparison(data.comparison, primary, competitor);

    lastScanData = primary;
    renderComparison(primary, competitor, comparison);

    statusBox.textContent = `Comparison completed. ${comparison.winnerLabel}`;
  } catch (error) {
    statusBox.textContent = "Comparison failed.";
    resultBox.innerHTML = renderErrorCard(
      "Compare Error",
      error.message || String(error),
      ""
    );
  } finally {
    setLoadingState(false, "compare");
  }
}

async function runScan(url) {
  const response = await fetch("/api/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url })
  });

  const data = await safeReadJson(response);

  if (!response.ok) {
    const errorMessage = data.details
      ? `${data.error || "Scan failed"}: ${data.details}`
      : (data.error || "Scan failed");
    throw new Error(errorMessage);
  }

  return data;
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
  if (window.SitePilotResultsUI && typeof window.SitePilotResultsUI.render === "function") {
    window.SitePilotResultsUI.render(
      {
        url: data.url,
        score: data.score,
        title: data.scanData.title,
        metaDescription: data.scanData.metaDescription,
        h1: data.scanData.h1,
        cta: data.scanData.cta,
        linkCount: data.scanData.links,
        imageCount: data.scanData.images,
        buttonCount: data.scanData.buttons,
        issues: data.issues,
        aiFeedback: data.feedback,
        priorityFixes: data.priorityFixes,
        topNextActions: data.topNextActions
      },
      "#result"
    );

    appendSingleScanActionBlocks();
    return;
  }

  resultBox.innerHTML = renderFallbackResult(data);
}

function appendSingleScanActionBlocks() {
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

function renderComparison(primary, competitor, comparison) {
  resultBox.innerHTML = `
    <section class="sitepilot-results">
      <article class="sp-card">
        <div class="sp-card-inner">
          <div class="sp-compare-head">
            <div>
              <div class="sp-kicker">Competitor Comparison</div>
              <h2 class="sp-title" style="margin-top:10px;">AI comparison</h2>
              <p class="sp-summary">${escapeHtml(comparison.summary)}</p>
            </div>
            <div class="sp-compare-badge ${comparison.winnerClass}">
              ${escapeHtml(comparison.winnerLabel)}
            </div>
          </div>
        </div>
      </article>

      <section class="sp-compare-score-grid">
        <article class="sp-card">
          <div class="sp-card-inner">
            <div class="sp-compare-site-label">Your Website</div>
            <div class="sp-compare-site-name">${escapeHtml(getDisplaySiteName(primary.url))}</div>
            <div class="sp-compare-site-url">${escapeHtml(primary.url)}</div>
            <div class="sp-compare-score-card">
              <div class="sp-compare-score-value">${primary.score}</div>
              <div class="sp-compare-score-denom">/100</div>
            </div>
          </div>
        </article>

        <article class="sp-card">
          <div class="sp-card-inner">
            <div class="sp-compare-site-label">Competitor</div>
            <div class="sp-compare-site-name">${escapeHtml(getDisplaySiteName(competitor.url))}</div>
            <div class="sp-compare-site-url">${escapeHtml(competitor.url)}</div>
            <div class="sp-compare-score-card competitor">
              <div class="sp-compare-score-value">${competitor.score}</div>
              <div class="sp-compare-score-denom">/100</div>
            </div>
          </div>
        </article>
      </section>

      <section class="sp-grid-2">
        <article class="sp-card">
          <div class="sp-card-inner">
            <div class="sp-section-head">
              <h3 class="sp-section-title">What competitor does better</h3>
              <span class="sp-section-tag warning">AI Gap</span>
            </div>
            ${renderList(comparison.competitorWins, "warning")}
          </div>
        </article>

        <article class="sp-card">
          <div class="sp-card-inner">
            <div class="sp-section-head">
              <h3 class="sp-section-title">What you should fix now</h3>
              <span class="sp-section-tag danger">Action</span>
            </div>
            ${renderList(comparison.mustFix, "danger")}
          </div>
        </article>
      </section>

      <article class="sp-card">
        <div class="sp-card-inner">
          <div class="sp-section-head">
            <h3 class="sp-section-title">Standout differences</h3>
            <span class="sp-section-tag success">AI Insight</span>
          </div>
          ${renderList(comparison.standoutDifferences, "success")}
        </div>
      </article>

      <section class="sp-grid-2">
        <article class="sp-card">
          <div class="sp-card-inner">
            <div class="sp-section-head">
              <h3 class="sp-section-title">Your website</h3>
              <span class="sp-section-tag accent">Snapshot</span>
            </div>
            <div class="sp-meta-table">
              <div class="sp-meta-row">
                <div class="sp-meta-label">Title</div>
                <div class="sp-meta-value">${escapeHtml(primary.scanData.title || "Not found")}</div>
              </div>
              <div class="sp-meta-row">
                <div class="sp-meta-label">Meta</div>
                <div class="sp-meta-value">${escapeHtml(primary.scanData.metaDescription || "Not found")}</div>
              </div>
              <div class="sp-meta-row">
                <div class="sp-meta-label">H1</div>
                <div class="sp-meta-value">${escapeHtml(primary.scanData.h1 || "Not found")}</div>
              </div>
              <div class="sp-meta-row">
                <div class="sp-meta-label">CTA</div>
                <div class="sp-meta-value">${escapeHtml(primary.scanData.cta || "Not detected")}</div>
              </div>
            </div>
          </div>
        </article>

        <article class="sp-card">
          <div class="sp-card-inner">
            <div class="sp-section-head">
              <h3 class="sp-section-title">Competitor website</h3>
              <span class="sp-section-tag success">Benchmark</span>
            </div>
            <div class="sp-meta-table">
              <div class="sp-meta-row">
                <div class="sp-meta-label">Title</div>
                <div class="sp-meta-value">${escapeHtml(competitor.scanData.title || "Not found")}</div>
              </div>
              <div class="sp-meta-row">
                <div class="sp-meta-label">Meta</div>
                <div class="sp-meta-value">${escapeHtml(competitor.scanData.metaDescription || "Not found")}</div>
              </div>
              <div class="sp-meta-row">
                <div class="sp-meta-label">H1</div>
                <div class="sp-meta-value">${escapeHtml(competitor.scanData.h1 || "Not found")}</div>
              </div>
              <div class="sp-meta-row">
                <div class="sp-meta-label">CTA</div>
                <div class="sp-meta-value">${escapeHtml(competitor.scanData.cta || "Not detected")}</div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section class="sp-grid-2">
        <article class="sp-card">
          <div class="sp-card-inner">
            <div class="sp-section-head">
              <h3 class="sp-section-title">Your priority fixes</h3>
              <span class="sp-section-tag accent">Improve</span>
            </div>
            ${renderList(primary.priorityFixes.slice(0, 3), "")}
          </div>
        </article>

        <article class="sp-card">
          <div class="sp-card-inner">
            <div class="sp-section-head">
              <h3 class="sp-section-title">Your top next actions</h3>
              <span class="sp-section-tag success">Business Focus</span>
            </div>
            ${renderList(primary.topNextActions.slice(0, 5), "success")}
          </div>
        </article>
      </section>

      <article class="sp-card">
        <div class="sp-card-inner">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              <h3 style="margin:0; color:var(--sp-text, var(--text));">Actions</h3>
              <span class="sp-section-tag accent">Your Site</span>
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
    </section>
  `;

  attachCopyButton(primary.feedback || []);
  attachFixButtons();
  attachDownloadPdfButton();
}

function normalizeComparison(comparison, primary, competitor) {
  if (!comparison || typeof comparison !== "object") {
    return buildComparisonFallback(primary, competitor);
  }

  const fallback = buildComparisonFallback(primary, competitor);

  return {
    summary: safeString(comparison.summary, fallback.summary),
    winnerLabel: safeString(comparison.winnerLabel, fallback.winnerLabel),
    winnerClass: ["success", "warning", "danger"].includes(comparison.winnerClass)
      ? comparison.winnerClass
      : fallback.winnerClass,
    competitorWins: normalizeArray(comparison.competitorWins).slice(0, 5).length
      ? normalizeArray(comparison.competitorWins).slice(0, 5)
      : fallback.competitorWins,
    mustFix: normalizeArray(comparison.mustFix).slice(0, 5).length
      ? normalizeArray(comparison.mustFix).slice(0, 5)
      : fallback.mustFix,
    standoutDifferences: normalizeArray(comparison.standoutDifferences).slice(0, 4).length
      ? normalizeArray(comparison.standoutDifferences).slice(0, 4)
      : fallback.standoutDifferences
  };
}

function buildComparisonFallback(primary, competitor) {
  const competitorWins = [];
  const mustFix = [];
  const standoutDifferences = [];

  if (competitor.score > primary.score) {
    competitorWins.push(
      `${getDisplaySiteName(competitor.url)} has a stronger overall page score (${competitor.score} vs ${primary.score}).`
    );
  } else if (primary.score > competitor.score) {
    competitorWins.push(
      `${getDisplaySiteName(primary.url)} already leads on overall score (${primary.score} vs ${competitor.score}).`
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
    competitorWins: dedupeList(competitorWins).slice(0, 5).length
      ? dedupeList(competitorWins).slice(0, 5)
      : ["No major competitor advantages were detected from the current scan data."],
    mustFix: dedupeList(mustFix).slice(0, 5).length
      ? dedupeList(mustFix).slice(0, 5)
      : ["No urgent fixes detected. Focus on improving messaging, trust and CTA performance."],
    standoutDifferences: dedupeList(standoutDifferences).slice(0, 4).length
      ? dedupeList(standoutDifferences).slice(0, 4)
      : ["The two pages look broadly similar from the available scan data."]
  };
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

  return dedupeList(actions).slice(0, 5);
}

function renderList(items, toneClass) {
  if (!items || !items.length) {
    return '<div class="sp-empty">No items available.</div>';
  }

  return `
    <div class="sp-list">
      ${items
        .map(
          (item, index) => `
            <div class="sp-list-item ${toneClass}">
              <div class="sp-list-index">${index + 1}</div>
              <div class="sp-list-text">${escapeHtml(item)}</div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
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

function hasContent(value) {
  return safeString(value).length > 0;
}

function normalizeUrlForCompare(url) {
  return safeString(url)
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
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

function setLoadingState(isLoading, mode = "scan") {
  scanBtn.disabled = isLoading;
  compareBtn.disabled = isLoading;
  urlInput.disabled = isLoading;
  competitorInput.disabled = isLoading;

  scanBtn.textContent = isLoading && mode === "scan" ? "Scanning..." : "Scan Website";
  compareBtn.textContent = isLoading && mode === "compare" ? "Comparing..." : "Compare Websites";
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

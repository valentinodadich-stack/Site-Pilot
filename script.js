const urlInput = document.getElementById("urlInput");
const scanBtn = document.getElementById("scanBtn");
const statusBox = document.getElementById("status");
const resultBox = document.getElementById("result");
const historyBox = document.getElementById("historyBox");

let scanHistory = loadHistory();
let lastScanData = null;

renderHistory();

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
        <div style="padding:16px; border:1px solid #f3c2c2; background:#fff5f5; border-radius:12px;">
          <h3 style="margin-top:0; color:#b42318;">Error</h3>
          <p style="margin-bottom:0;">${escapeHtml(data.error || "Something went wrong.")}</p>
        </div>
      `;
      return;
    }

    lastScanData = data;

    statusBox.textContent = "Scan completed.";
    resultBox.innerHTML = renderResult(data);

    addToHistory(data.url, data.score);
    renderHistory();
    attachCopyButton(data.feedback || []);
    attachFixButtons();
    attachDownloadPdfButton();
  } catch (error) {
    statusBox.textContent = "Request failed.";
    resultBox.innerHTML = `
      <div style="padding:16px; border:1px solid #f3c2c2; background:#fff5f5; border-radius:12px;">
        <h3 style="margin-top:0; color:#b42318;">Error</h3>
        <p style="margin-bottom:0;">${escapeHtml(error.message || String(error))}</p>
      </div>
    `;
  } finally {
    setLoadingState(false);
  }
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
      
      <div style="padding:20px; border-radius:16px; background:#ffffff; border:1px solid #e5e7eb; box-shadow:0 6px 20px rgba(0,0,0,0.06);">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;">
          <div>
            <p style="margin:0; font-size:14px; color:#666;">Scanned website</p>
            <h2 style="margin:6px 0 0 0; font-size:22px; word-break:break-word;">${escapeHtml(data.url)}</h2>
          </div>

          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <button
              id="downloadPdfBtn"
              style="padding:10px 14px; font-size:14px; border:none; border-radius:10px; background:#111827; color:#fff; cursor:pointer;"
            >
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

      <div style="padding:20px; border-radius:16px; background:#ffffff; border:1px solid #e5e7eb; box-shadow:0 6px 20px rgba(0,0,0,0.06);">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <h3 style="margin-top:0; margin-bottom:0;">Scan Data</h3>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="fixTitleBtn" style="padding:10px 12px; font-size:13px; border:none; border-radius:10px; background:#111827; color:#fff; cursor:pointer;">Fix Title</button>
            <button id="fixMetaBtn" style="padding:10px 12px; font-size:13px; border:none; border-radius:10px; background:#111827; color:#fff; cursor:pointer;">Fix Meta</button>
            <button id="fixH1Btn" style="padding:10px 12px; font-size:13px; border:none; border-radius:10px; background:#111827; color:#fff; cursor:pointer;">Fix H1</button>
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

      <div style="padding:20px; border-radius:16px; background:#ffffff; border:1px solid #e5e7eb; box-shadow:0 6px 20px rgba(0,0,0,0.06);">
        <h3 style="margin-top:0;">Issues</h3>
        ${
          data.issues && data.issues.length
            ? `<ul style="padding-left:20px; margin-bottom:0;">
                ${data.issues.map(issue => `
                  <li style="margin-bottom:10px;">${escapeHtml(issue)}</li>
                `).join("")}
              </ul>`
            : `<p style="margin-bottom:0;">No major issues found.</p>`
        }
      </div>

      <div style="padding:20px; border-radius:16px; background:#ffffff; border:1px solid #e5e7eb; box-shadow:0 6px 20px rgba(0,0,0,0.06);">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h3 style="margin:0;">AI Feedback</h3>
            <span style="font-size:12px; background:#111; color:#fff; padding:6px 10px; border-radius:999px;">AI Powered</span>
          </div>
          <button id="copyFeedbackBtn" style="padding:10px 14px; font-size:14px; border:none; border-radius:10px; background:#111827; color:#fff; cursor:pointer;">
            Copy Feedback
          </button>
        </div>
        <div style="margin-top:16px; display:flex; flex-direction:column; gap:12px;">
          ${
            data.feedback && data.feedback.length
              ? data.feedback.map(item => `
                  <div style="padding:14px 16px; border-radius:12px; background:#f8fafc; border:1px solid #e5e7eb;">
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

function attachDownloadPdfButton() {
  const pdfBtn = document.getElementById("downloadPdfBtn");
  if (!pdfBtn) return;

  pdfBtn.addEventListener("click", async () => {
    if (!lastScanData) return;

    if (typeof html2pdf === "undefined") {
      alert("PDF library is not loaded.");
      return;
    }

    const originalText = pdfBtn.textContent;
    pdfBtn.disabled = true;
    pdfBtn.textContent = "Generating PDF...";

    try {
      const wrapper = document.createElement("div");
      wrapper.style.position = "fixed";
      wrapper.style.left = "-99999px";
      wrapper.style.top = "0";
      wrapper.style.width = "800px";
      wrapper.style.background = "#ffffff";
      wrapper.style.padding = "32px";
      wrapper.style.fontFamily = "Arial, sans-serif";
      wrapper.style.color = "#111827";
      wrapper.innerHTML = buildPdfMarkup(lastScanData);

      document.body.appendChild(wrapper);

      const safeDomain = makeSafeFileName(lastScanData.url);
      const filename = `sitepilot-report-${safeDomain}.pdf`;

      const opt = {
        margin: 0.5,
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] }
      };

      await html2pdf().set(opt).from(wrapper).save();

      document.body.removeChild(wrapper);
    } catch (error) {
      alert(`PDF generation failed: ${error.message || error}`);
    } finally {
      pdfBtn.disabled = false;
      pdfBtn.textContent = originalText;
    }
  });
}

function buildPdfMarkup(data) {
  const issuesHtml = data.issues && data.issues.length
    ? data.issues.map(item => `<li style="margin-bottom:8px;">${escapeHtml(item)}</li>`).join("")
    : "<li>No major issues found.</li>";

  const feedbackHtml = data.feedback && data.feedback.length
    ? data.feedback.map(item => `
        <div style="padding:12px 14px; margin-bottom:10px; border:1px solid #e5e7eb; border-radius:10px; background:#f8fafc;">
          ${escapeHtml(item)}
        </div>
      `).join("")
    : "<p>No feedback available.</p>";

  return `
    <div style="font-family:Arial, sans-serif;">
      <div style="margin-bottom:24px;">
        <div style="display:inline-block; padding:6px 10px; font-size:12px; font-weight:700; color:#4338ca; background:#eef2ff; border:1px solid #c7d2fe; border-radius:999px;">
          SitePilot PDF Report
        </div>
        <h1 style="margin:16px 0 8px; font-size:32px;">Website Audit Report</h1>
        <p style="margin:0; color:#475467;">Generated on ${escapeHtml(new Date().toLocaleString())}</p>
      </div>

      <div style="padding:20px; border:1px solid #e5e7eb; border-radius:16px; margin-bottom:20px;">
        <h2 style="margin-top:0; font-size:22px;">Overview</h2>
        <p><strong>Website:</strong> ${escapeHtml(data.url)}</p>
        <p><strong>Score:</strong> ${data.score}/100</p>
      </div>

      <div style="padding:20px; border:1px solid #e5e7eb; border-radius:16px; margin-bottom:20px;">
        <h2 style="margin-top:0; font-size:22px;">Scan Data</h2>
        <p><strong>Title:</strong> ${escapeHtml(data.scanData.title || "None")}</p>
        <p><strong>Meta Description:</strong> ${escapeHtml(data.scanData.metaDescription || "None")}</p>
        <p><strong>H1:</strong> ${escapeHtml(data.scanData.h1 || "None")}</p>
        <p><strong>Links:</strong> ${data.scanData.links}</p>
        <p><strong>Images:</strong> ${data.scanData.images}</p>
        <p><strong>Buttons:</strong> ${data.scanData.buttons}</p>
        <p><strong>CTA Found:</strong> ${escapeHtml(data.scanData.cta || "None")}</p>
      </div>

      <div style="padding:20px; border:1px solid #e5e7eb; border-radius:16px; margin-bottom:20px; page-break-inside:avoid;">
        <h2 style="margin-top:0; font-size:22px;">Issues</h2>
        <ul style="padding-left:20px; margin-bottom:0;">
          ${issuesHtml}
        </ul>
      </div>

      <div style="padding:20px; border:1px solid #e5e7eb; border-radius:16px; margin-bottom:20px;">
        <h2 style="margin-top:0; font-size:22px;">AI Feedback</h2>
        ${feedbackHtml}
      </div>
    </div>
  `;
}

function attachFixButtons() {
  const fixTitleBtn = document.getElementById("fixTitleBtn");
  const fixMetaBtn = document.getElementById("fixMetaBtn");
  const fixH1Btn = document.getElementById("fixH1Btn");

  if (fixTitleBtn) {
    fixTitleBtn.addEventListener("click", () => handleFix("title"));
  }

  if (fixMetaBtn) {
    fixMetaBtn.addEventListener("click", () => handleFix("meta"));
  }

  if (fixH1Btn) {
    fixH1Btn.addEventListener("click", () => handleFix("h1"));
  }
}

async function handleFix(type) {
  if (!lastScanData) return;

  const box = document.getElementById("fixResultsBox");
  if (!box) return;

  box.innerHTML = `
    <div style="padding:20px; border-radius:16px; background:#ffffff; border:1px solid #e5e7eb; box-shadow:0 6px 20px rgba(0,0,0,0.06);">
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
        <div style="padding:20px; border-radius:16px; background:#fff5f5; border:1px solid #f3c2c2;">
          <h3 style="margin-top:0; color:#b42318;">Fix Error</h3>
          <p style="margin-bottom:0;">${escapeHtml(data.error || "Failed to generate suggestions.")}</p>
        </div>
      `;
      return;
    }

    box.innerHTML = `
      <div style="padding:20px; border-radius:16px; background:#ffffff; border:1px solid #e5e7eb; box-shadow:0 6px 20px rgba(0,0,0,0.06);">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <h3 style="margin:0;">AI ${escapeHtml(type.toUpperCase())} Suggestions</h3>
          <button id="copyFixBtn" style="padding:10px 14px; font-size:14px; border:none; border-radius:10px; background:#111827; color:#fff; cursor:pointer;">
            Copy Suggestions
          </button>
        </div>
        <div style="margin-top:16px; display:flex; flex-direction:column; gap:12px;">
          ${
            data.suggestions && data.suggestions.length
              ? data.suggestions.map(item => `
                  <div style="padding:14px 16px; border-radius:12px; background:#f8fafc; border:1px solid #e5e7eb;">
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
      <div style="padding:20px; border-radius:16px; background:#fff5f5; border:1px solid #f3c2c2;">
        <h3 style="margin-top:0; color:#b42318;">Fix Error</h3>
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
      setTimeout(() => {
        copyBtn.textContent = "Copy Suggestions";
      }, 1500);
    } catch (error) {
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
    } catch (error) {
      copyBtn.textContent = "Copy failed";
      setTimeout(() => {
        copyBtn.textContent = "Copy Feedback";
      }, 1500);
    }
  });
}

function addToHistory(url, score) {
  scanHistory = scanHistory.filter((item) => item.url !== url);

  scanHistory.unshift({
    url,
    score,
    date: new Date().toLocaleString()
  });

  if (scanHistory.length > 5) {
    scanHistory = scanHistory.slice(0, 5);
  }

  saveHistory();
}

function renderHistory() {
  if (!scanHistory.length) {
    historyBox.innerHTML = "";
    return;
  }

  historyBox.innerHTML = `
    <div style="padding:20px; border-radius:16px; background:#ffffff; border:1px solid #e5e7eb; box-shadow:0 6px 20px rgba(0,0,0,0.06);">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <h3 style="margin-top:0; margin-bottom:0;">Recent Scans</h3>
        <button id="clearHistoryBtn" style="padding:8px 12px; font-size:13px; border:none; border-radius:10px; background:#ef4444; color:#fff; cursor:pointer;">
          Clear History
        </button>
      </div>
      <div style="display:flex; flex-direction:column; gap:12px; margin-top:16px;">
        ${scanHistory.map(item => `
          <div style="padding:14px 16px; border-radius:12px; background:#f8fafc; border:1px solid #e5e7eb;">
            <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <strong style="word-break:break-word;">${escapeHtml(item.url)}</strong>
              <span>${item.score}/100</span>
            </div>
            <div style="margin-top:6px; font-size:13px; color:#667085;">${escapeHtml(item.date)}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  const clearBtn = document.getElementById("clearHistoryBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", clearHistory);
  }
}

function saveHistory() {
  localStorage.setItem("sitepilot_scan_history", JSON.stringify(scanHistory));
}

function loadHistory() {
  try {
    const saved = localStorage.getItem("sitepilot_scan_history");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function clearHistory() {
  scanHistory = [];
  localStorage.removeItem("sitepilot_scan_history");
  renderHistory();
}

function getScoreColor(score) {
  if (score >= 80) {
    return {
      background: "#ecfdf3",
      text: "#027a48"
    };
  }

  if (score >= 50) {
    return {
      background: "#fffaeb",
      text: "#b54708"
    };
  }

  return {
    background: "#fef3f2",
    text: "#b42318"
  };
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

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

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sitepilot-report.pdf";
      a.click();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert("PDF failed: " + error.message);
    } finally {
      pdfBtn.disabled = false;
      pdfBtn.textContent = "Download PDF";
    }
  });
}

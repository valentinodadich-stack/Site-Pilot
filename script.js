const urlInput = document.getElementById("urlInput");
const scanBtn = document.getElementById("scanBtn");
const statusBox = document.getElementById("status");
const resultBox = document.getElementById("result");

scanBtn.addEventListener("click", async () => {
  const url = urlInput.value.trim();

  if (!url) {
    statusBox.textContent = "Please enter a URL.";
    return;
  }

  statusBox.textContent = "Scanning...";
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
      statusBox.textContent = "Something went wrong.";
      resultBox.innerHTML = `<p style="color:red;">${data.error}</p>`;
      return;
    }

    statusBox.textContent = "Done.";
    resultBox.innerHTML = renderResult(data);
  } catch (error) {
    statusBox.textContent = "Request failed.";
    resultBox.innerHTML = `<p style="color:red;">${error.message || error}</p>`;
  }
});

function renderResult(data) {
  if (!data) return "";

  return `
    <div style="margin-top:20px;">
      <h2>Score: ${data.score}/100</h2>

      <h3>Scan Data</h3>
      <p><strong>Title:</strong> ${data.scanData.title || "None"}</p>
      <p><strong>Meta Description:</strong> ${data.scanData.metaDescription || "None"}</p>
      <p><strong>H1:</strong> ${data.scanData.h1 || "None"}</p>
      <p><strong>Links:</strong> ${data.scanData.links}</p>
      <p><strong>Images:</strong> ${data.scanData.images}</p>
      <p><strong>Buttons:</strong> ${data.scanData.buttons}</p>
      <p><strong>CTA Found:</strong> ${data.scanData.cta || "None"}</p>

      <h3>Issues</h3>
      <ul>
        ${
          data.issues.length > 0
            ? data.issues.map(issue => `<li>${issue}</li>`).join("")
            : "<li>No major issues found</li>"
        }
      </ul>

      <h3>Feedback</h3>
      <ul>
        ${data.feedback.map(item => `<li>${item}</li>`).join("")}
      </ul>
    </div>
  `;
}

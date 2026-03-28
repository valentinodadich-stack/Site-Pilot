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
  resultBox.textContent = "";

  try {
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url })
    });

    const data = await response.json();
    statusBox.textContent = response.ok ? "Done." : "Something went wrong.";
    resultBox.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    statusBox.textContent = "Request failed.";
    resultBox.textContent = String(error);
  }
});

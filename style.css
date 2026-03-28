:root {
  --bg: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
  --text: #111827;
  --muted-text: #667085;
  --card-bg: rgba(255, 255, 255, 0.88);
  --subcard-bg: #f8fafc;
  --border: #e5e7eb;
  --input-bg: #ffffff;
  --input-border: #d0d5dd;
  --button-bg: #111827;
  --button-text: #ffffff;
  --button-shadow: 0 10px 24px rgba(17, 24, 39, 0.16);
  --history-hover: #eef2ff;
  --badge-bg: #eef2ff;
  --badge-border: #c7d2fe;
  --badge-text: #4338ca;
  --danger-bg: #fff5f5;
  --danger-border: #f3c2c2;
  --danger-text: #b42318;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: linear-gradient(180deg, #0b1220 0%, #111827 100%);
    --text: #f3f4f6;
    --muted-text: #9ca3af;
    --card-bg: rgba(17, 24, 39, 0.92);
    --subcard-bg: #111827;
    --border: #374151;
    --input-bg: #111827;
    --input-border: #4b5563;
    --button-bg: #f3f4f6;
    --button-text: #111827;
    --button-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
    --history-hover: #1f2937;
    --badge-bg: #1e1b4b;
    --badge-border: #4338ca;
    --badge-text: #c7d2fe;
    --danger-bg: rgba(127, 29, 29, 0.22);
    --danger-border: #7f1d1d;
    --danger-text: #fca5a5;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
}

.container {
  max-width: 920px;
  margin: 0 auto;
  padding: 48px 20px 80px;
}

.hero-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 32px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(8px);
}

.badge {
  display: inline-block;
  margin-bottom: 16px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--badge-text);
  background: var(--badge-bg);
  border: 1px solid var(--badge-border);
  border-radius: 999px;
}

h1 {
  margin: 0 0 12px 0;
  font-size: 42px;
  line-height: 1.1;
  font-weight: 800;
  color: var(--text);
}

h2, h3, p, strong, span, li {
  color: inherit;
}

.subtext {
  max-width: 700px;
  margin: 0;
  font-size: 16px;
  color: var(--muted-text);
}

.scan-box {
  display: flex;
  gap: 12px;
  margin: 28px 0 20px;
  flex-wrap: wrap;
}

input {
  flex: 1;
  min-width: 260px;
  padding: 14px 16px;
  font-size: 16px;
  border: 1px solid var(--input-border);
  border-radius: 14px;
  outline: none;
  background: var(--input-bg);
  color: var(--text);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
}

button {
  padding: 14px 20px;
  font-size: 15px;
  font-weight: 700;
  border: none;
  border-radius: 14px;
  background: var(--button-bg);
  color: var(--button-text);
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  box-shadow: var(--button-shadow);
}

button:hover {
  opacity: 0.96;
  transform: translateY(-1px);
}

button:active {
  transform: translateY(0);
}

button:disabled,
input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

#status {
  min-height: 24px;
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--muted-text);
}

.result {
  margin-top: 20px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--input-border);
  border-top: 2px solid var(--text);
  border-radius: 50%;
  display: inline-block;
  animation: spin 0.7s linear infinite;
}

.sp-card {
  padding: 20px;
  border-radius: 16px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  box-shadow: 0 6px 20px rgba(0,0,0,0.06);
  color: var(--text);
}

.sp-subcard {
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--subcard-bg);
  border: 1px solid var(--border);
  color: var(--text);
}

.sp-button-secondary {
  padding: 10px 14px;
  font-size: 14px;
  border: none;
  border-radius: 10px;
  background: var(--button-bg);
  color: var(--button-text);
  cursor: pointer;
}

.sp-pill {
  font-size: 12px;
  background: var(--button-bg);
  color: var(--button-text);
  padding: 6px 10px;
  border-radius: 999px;
}

.sp-history-item {
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--subcard-bg);
  border: 1px solid var(--border);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text);
  width: 100%;
  box-shadow: none;
}

.sp-history-item:hover {
  background: var(--history-hover);
  transform: translateY(0);
  opacity: 1;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .container {
    padding: 28px 16px 48px;
  }

  h1 {
    font-size: 32px;
  }

  .hero-card {
    padding: 22px;
    border-radius: 18px;
  }

  .scan-box {
    flex-direction: column;
  }

  button {
    width: 100%;
  }

  .sp-button-secondary {
    width: auto;
  }

  .sp-history-item {
    width: 100%;
  }
}

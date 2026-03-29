(function () {
  function safeString(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    return text || fallback;
  }

  function safeNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function normalizeList(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((item) => safeString(item)).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  function clamp(num, min, max) {
    return Math.min(max, Math.max(min, num));
  }

  function escapeHtml(value) {
    return safeString(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getScoreTone(score) {
    if (score >= 80) {
      return {
        label: 'Strong',
        className: 'success',
        color: 'var(--sp-success)',
        summary:
          'This page already has a strong base. The biggest gains now come from sharpening messaging, CTA clarity and CTR improvements.'
      };
    }

    if (score >= 60) {
      return {
        label: 'Promising',
        className: 'warning',
        color: 'var(--sp-warning)',
        summary:
          'The foundation is solid, but a few focused improvements can noticeably lift SEO, UX and conversion performance.'
      };
    }

    return {
      label: 'Needs Work',
      className: 'danger',
      color: 'var(--sp-danger)',
      summary:
        'There are clear high-impact gaps. Start with clarity, metadata and CTA structure before smaller optimizations.'
      };
    }
  }

  function buildTopNextActions(data) {
    const actions = [];

    if (!data.title || data.title === 'Not found' || data.title.length < 20) {
      actions.push('Rewrite the title to be clearer, more specific and keyword-aligned.');
    }

    if (!data.metaDescription || data.metaDescription === 'Not found' || data.metaDescription.length < 80) {
      actions.push('Improve the meta description so the search snippet is stronger and more clickable.');
    }

    if (!data.h1 || data.h1 === 'Not found') {
      actions.push('Clarify the H1 so visitors instantly understand what the page does.');
    }

    if (!data.cta || data.cta === 'Not detected') {
      actions.push('Add one obvious primary CTA above the fold.');
    }

    if (data.imageCount === 0) {
      actions.push('Add visual proof such as screenshots, examples or trust visuals.');
    }

    if (data.linkCount < 5) {
      actions.push('Strengthen internal linking so the page feels more connected and crawlable.');
    }

    if (data.buttonCount > 0 && data.buttonCount < 2) {
      actions.push('Test stronger CTA placement and more specific button copy.');
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

  function normalizeResult(input) {
    const source = input?.result || input?.scan || input?.data || input || {};

    const normalized = {
      url: safeString(input?.url || source.url || source.scannedUrl || ''),
      score: clamp(safeNumber(source.score ?? source.totalScore ?? 0), 0, 100),
      title: safeString(source.title || source.seoTitle || 'Not found'),
      metaDescription: safeString(source.metaDescription || source.meta || source.description || 'Not found'),
      h1: safeString(source.h1 || source.heading || 'Not found'),
      cta: safeString(source.cta || source.primaryCta || 'Not detected'),
      linkCount: safeNumber(source.linkCount ?? source.links ?? source.linksCount ?? 0),
      imageCount: safeNumber(source.imageCount ?? source.images ?? source.imagesCount ?? 0),
      buttonCount: safeNumber(source.buttonCount ?? source.buttons ?? source.buttonsCount ?? 0),
      issues: normalizeList(source.issues),
      aiFeedback: normalizeList(source.aiFeedback || source.feedback || source.aiSuggestions),
      priorityFixes: normalizeList(source.priorityFixes || source.priority || source.topFixes),
      topNextActions: normalizeList(source.topNextActions || source.nextActions)
    };

    if (!normalized.topNextActions.length) {
      normalized.topNextActions = buildTopNextActions(normalized);
    }

    return normalized;
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
          .join('')}
      </div>
    `;
  }

  function renderResults(resultInput, target) {
    const result = normalizeResult(resultInput);
    const tone = getScoreTone(result.score);
    const targetElement =
      typeof target === 'string' ? document.querySelector(target) : target;

    if (!targetElement) {
      console.error('SitePilot UI: target container not found.');
      return;
    }

    const html = `
      <section class="sitepilot-results">
        <article class="sp-card">
          <div class="sp-card-inner">
            <div class="sp-hero">
              <div class="sp-score-shell">
                <div class="sp-score-ring" style="--score:${result.score}; --ring-color:${tone.color};">
                  <div class="sp-score-core">
                    <div class="sp-score-value">${result.score}</div>
                    <div class="sp-score-denom">/100</div>
                  </div>
                </div>
              </div>

              <div class="sp-hero-meta">
                <div class="sp-kicker">SitePilot Score</div>
                <h2 class="sp-title">Your page is <span style="color:${tone.color};">${tone.label}</span></h2>
                <p class="sp-summary">${escapeHtml(tone.summary)}</p>

                <div class="sp-badges">
                  <div class="sp-badge ${tone.className}">Overall: ${tone.label}</div>
                  <div class="sp-badge">Links: ${result.linkCount}</div>
                  <div class="sp-badge">Images: ${result.imageCount}</div>
                  <div class="sp-badge">Buttons: ${result.buttonCount}</div>
                  <div class="sp-badge">${result.cta !== 'Not detected' ? 'CTA detected' : 'CTA missing'}</div>
                </div>
              </div>
            </div>
          </div>
        </article>

        <section class="sp-grid-4">
          <article class="sp-metric">
            <div class="sp-metric-label">Links</div>
            <div class="sp-metric-value">${result.linkCount}</div>
          </article>

          <article class="sp-metric">
            <div class="sp-metric-label">Images</div>
            <div class="sp-metric-value">${result.imageCount}</div>
          </article>

          <article class="sp-metric">
            <div class="sp-metric-label">Buttons</div>
            <div class="sp-metric-value">${result.buttonCount}</div>
          </article>

          <article class="sp-metric">
            <div class="sp-metric-label">Primary CTA</div>
            <div class="sp-metric-value" style="font-size:18px; line-height:1.3;">
              ${escapeHtml(result.cta)}
            </div>
          </article>
        </section>

        <section class="sp-grid-2">
          <article class="sp-card">
            <div class="sp-card-inner">
              <div class="sp-section-head">
                <h3 class="sp-section-title">Priority Fixes</h3>
                <span class="sp-section-tag accent">High Impact</span>
              </div>
              ${renderList(result.priorityFixes.slice(0, 3), '')}
            </div>
          </article>

          <article class="sp-card">
            <div class="sp-card-inner">
              <div class="sp-section-head">
                <h3 class="sp-section-title">Top Next Actions</h3>
                <span class="sp-section-tag success">Business Focus</span>
              </div>
              ${renderList(result.topNextActions.slice(0, 5), 'success')}
            </div>
          </article>
        </section>

        <section class="sp-grid-2">
          <article class="sp-card">
            <div class="sp-card-inner">
              <div class="sp-section-head">
                <h3 class="sp-section-title">Issues Found</h3>
                <span class="sp-section-tag danger">Detected</span>
              </div>
              ${renderList(result.issues, 'danger')}
            </div>
          </article>

          <article class="sp-card">
            <div class="sp-card-inner">
              <div class="sp-section-head">
                <h3 class="sp-section-title">AI Recommendations</h3>
                <span class="sp-section-tag warning">AI Coach</span>
              </div>
              ${renderList(result.aiFeedback, 'warning')}
            </div>
          </article>
        </section>

        <article class="sp-card">
          <div class="sp-card-inner">
            <div class="sp-section-head">
              <h3 class="sp-section-title">Page Overview</h3>
              <span class="sp-section-tag accent">Metadata</span>
            </div>

            <div class="sp-meta-table">
              <div class="sp-meta-row">
                <div class="sp-meta-label">URL</div>
                <div class="sp-meta-value">${escapeHtml(result.url || 'N/A')}</div>
              </div>

              <div class="sp-meta-row">
                <div class="sp-meta-label">Title</div>
                <div class="sp-meta-value">${escapeHtml(result.title)}</div>
              </div>

              <div class="sp-meta-row">
                <div class="sp-meta-label">Meta Description</div>
                <div class="sp-meta-value">${escapeHtml(result.metaDescription)}</div>
              </div>

              <div class="sp-meta-row">
                <div class="sp-meta-label">H1</div>
                <div class="sp-meta-value">${escapeHtml(result.h1)}</div>
              </div>
            </div>
          </div>
        </article>
      </section>
    `;

    targetElement.innerHTML = html;
  }

  window.SitePilotResultsUI = {
    render: renderResults,
    normalizeResult
  };
})();

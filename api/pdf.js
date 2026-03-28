import PDFDocument from 'pdfkit';

const COLORS = {
  ink: '#0F172A',
  text: '#111827',
  muted: '#6B7280',
  soft: '#94A3B8',
  border: '#E5E7EB',
  panel: '#F8FAFC',
  white: '#FFFFFF',
  accent: '#4F46E5',
  accentSoft: '#EEF2FF',
  success: '#059669',
  successSoft: '#ECFDF5',
  warning: '#D97706',
  warningSoft: '#FFF7ED',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  dark: '#0B1220'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = parseBody(req.body);
    const report = normalizePayload(body);

    const branding = await resolveBranding(report.url);

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 56, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title: `SitePilot Report - ${report.url}`,
        Author: 'SitePilot',
        Subject: 'AI Website Analysis Report',
        Keywords: 'SitePilot, website audit, SEO, UX, conversion, AI',
        CreationDate: new Date()
      }
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      const filename = buildFilename(report.url);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.status(200).end(pdfBuffer);
    });

    await drawReport(doc, report, branding);
    addPageNumbers(doc);
    doc.end();
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      error: 'Failed to generate PDF',
      details: error?.message || 'Unknown error'
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                                   PARSING                                  */
/* -------------------------------------------------------------------------- */

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function normalizePayload(body = {}) {
  const source = body.result || body.scan || body.data || body || {};

  const url = safeString(body.url || source.url || source.scannedUrl || 'Unknown URL');
  const scannedAt = safeString(
    body.scannedAt ||
      source.scannedAt ||
      source.createdAt ||
      source.timestamp ||
      new Date().toISOString()
  );

  const title = safeString(source.title || source.seoTitle || 'Not found');
  const metaDescription = safeString(
    source.metaDescription || source.meta || source.description || 'Not found'
  );
  const h1 = safeString(source.h1 || source.heading || 'Not found');
  const cta = safeString(source.cta || source.primaryCta || 'Not detected');

  const linkCount = safeNumber(source.linkCount ?? source.links ?? source.linksCount ?? 0);
  const imageCount = safeNumber(source.imageCount ?? source.images ?? source.imagesCount ?? 0);
  const buttonCount = safeNumber(source.buttonCount ?? source.buttons ?? source.buttonsCount ?? 0);

  const score = clampNumber(safeNumber(source.score ?? source.totalScore ?? 0), 0, 100);

  const issues = normalizeStringArray(source.issues);
  const aiFeedback = normalizeStringArray(
    source.aiFeedback || source.feedback || source.aiSuggestions
  );
  const priorityFixes = normalizeStringArray(
    source.priorityFixes || source.priority || source.topFixes
  );

  const topNextActionsInput = normalizeStringArray(
    source.topNextActions || source.nextActions
  );

  const topNextActions =
    topNextActionsInput.length > 0
      ? topNextActionsInput.slice(0, 5)
      : buildTopNextActions({
          title,
          metaDescription,
          h1,
          cta,
          linkCount,
          imageCount,
          buttonCount,
          score,
          issues,
          priorityFixes,
          aiFeedback
        });

  return {
    url,
    scannedAt,
    title,
    metaDescription,
    h1,
    cta,
    linkCount,
    imageCount,
    buttonCount,
    score,
    issues,
    aiFeedback,
    priorityFixes,
    topNextActions
  };
}

function normalizeStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => safeString(item))
      .filter(Boolean)
      .slice(0, 20);
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  return [];
}

function safeString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildFilename(url) {
  const clean = safeString(url)
    .replace(/^https?:\/\//i, '')
    .replace(/[^a-z0-9.-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  return `sitepilot-report-${clean || 'website'}.pdf`;
}

/* -------------------------------------------------------------------------- */
/*                             TOP NEXT ACTIONS                               */
/* -------------------------------------------------------------------------- */

function buildTopNextActions(data) {
  const actions = [];

  if (!data.title || data.title === 'Not found' || data.title.length < 20) {
    actions.push(
      'Rewrite the page title so it clearly states the offer and primary keyword in 50–60 characters.'
    );
  }

  if (
    !data.metaDescription ||
    data.metaDescription === 'Not found' ||
    data.metaDescription.length < 80
  ) {
    actions.push(
      'Create a stronger meta description focused on value, clarity and click-through rate.'
    );
  }

  if (!data.h1 || data.h1 === 'Not found' || data.h1.length < 6) {
    actions.push(
      'Improve the H1 so visitors instantly understand what the page does and who it is for.'
    );
  }

  if (!data.cta || data.cta === 'Not detected') {
    actions.push(
      'Add one clear primary CTA above the fold so users know the next step immediately.'
    );
  }

  if (data.buttonCount > 0 && data.buttonCount < 2) {
    actions.push(
      'Test a more visible CTA section with stronger button copy tied to one business goal.'
    );
  }

  if (data.imageCount === 0) {
    actions.push(
      'Add visual proof elements such as product screenshots, trust badges or real product visuals.'
    );
  }

  if (data.linkCount < 5) {
    actions.push(
      'Strengthen internal linking so users and search engines can navigate the page structure more easily.'
    );
  }

  if (data.score < 60) {
    actions.push(
      'Focus first on clarity and conversion basics before making smaller SEO refinements.'
    );
  } else if (data.score < 80) {
    actions.push(
      'The page has a solid base — now tighten messaging, CTA placement and search snippet quality.'
    );
  } else {
    actions.push(
      'Use this page as a strong base and keep iterating on CTR, trust signals and conversion microcopy.'
    );
  }

  for (const fix of data.priorityFixes || []) {
    if (actions.length >= 5) break;
    actions.push(cleanSentence(fix));
  }

  for (const issue of data.issues || []) {
    if (actions.length >= 5) break;
    actions.push(cleanSentence(issue));
  }

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

  return unique.length > 0
    ? unique
    : [
        'Improve title clarity so the page promise is obvious in search results and on-page.',
        'Strengthen the primary CTA to make the next step more specific and compelling.',
        'Refine page messaging to better connect SEO intent with conversion intent.'
      ];
}

function cleanSentence(value) {
  const text = safeString(value);
  if (!text) return '';
  return text.endsWith('.') ? text : `${text}.`;
}

/* -------------------------------------------------------------------------- */
/*                              BRANDING / LOGO                               */
/* -------------------------------------------------------------------------- */

async function resolveBranding(inputUrl) {
  const fallback = {
    siteName: hostnameFromUrl(inputUrl),
    logoBuffer: null,
    logoMime: null,
    logoSourceUrl: null
  };

  try {
    const normalizedUrl = ensureUrl(inputUrl);
    if (!normalizedUrl) return fallback;

    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'SitePilotBot/1.0 (+https://sitepilot.app)'
      }
    });

    if (!response.ok) return fallback;

    const html = await response.text();
    const siteName =
      extractMetaContent(html, 'property', 'og:site_name') ||
      extractMetaContent(html, 'name', 'application-name') ||
      extractTitle(html) ||
      hostnameFromUrl(normalizedUrl);

    const logoCandidates = extractLogoCandidates(html, normalizedUrl);

    for (const candidateUrl of logoCandidates) {
      const imageResult = await downloadUsableImage(candidateUrl);
      if (imageResult) {
        return {
          siteName: safeString(siteName),
          logoBuffer: imageResult.buffer,
          logoMime: imageResult.mime,
          logoSourceUrl: candidateUrl
        };
      }
    }

    return {
      ...fallback,
      siteName: safeString(siteName)
    };
  } catch (error) {
    console.error('Branding resolve error:', error);
    return fallback;
  }
}

function extractLogoCandidates(html, baseUrl) {
  const candidates = [];

  const appleTouch = extractLinkHrefByRelContains(html, 'apple-touch-icon');
  const icon = extractLinkHrefByRelContains(html, 'icon');
  const shortcutIcon = extractLinkHrefByRelContains(html, 'shortcut icon');
  const ogImage = extractMetaContent(html, 'property', 'og:image');

  pushCandidate(candidates, appleTouch, baseUrl);
  pushCandidate(candidates, icon, baseUrl);
  pushCandidate(candidates, shortcutIcon, baseUrl);
  pushCandidate(candidates, ogImage, baseUrl);

  return dedupeStrings(
    candidates.filter((url) => {
      const lower = url.toLowerCase();
      if (lower.endsWith('.svg')) return false;
      if (lower.endsWith('.ico')) return false;
      return true;
    })
  );
}

function pushCandidate(list, value, baseUrl) {
  const resolved = absoluteUrl(value, baseUrl);
  if (resolved) list.push(resolved);
}

function dedupeStrings(items) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = safeString(item).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

async function downloadUsableImage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SitePilotBot/1.0 (+https://sitepilot.app)'
      }
    });

    if (!response.ok) return null;

    const mime = safeString(response.headers.get('content-type')).toLowerCase();

    if (!mime.includes('image/png') && !mime.includes('image/jpeg') && !mime.includes('image/jpg')) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!buffer || buffer.length === 0) return null;

    return { buffer, mime };
  } catch (error) {
    console.error('downloadUsableImage error:', error);
    return null;
  }
}

function extractMetaContent(html, attrName, attrValue) {
  const regex = new RegExp(
    `<meta[^>]*${attrName}=["']${escapeRegex(attrValue)}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    'i'
  );
  const reverseRegex = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*${attrName}=["']${escapeRegex(attrValue)}["'][^>]*>`,
    'i'
  );

  const match = html.match(regex) || html.match(reverseRegex);
  return match ? decodeHtml(match[1]) : '';
}

function extractLinkHrefByRelContains(html, relPart) {
  const regex = /<link\b[^>]*rel=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const rel = safeString(match[1]).toLowerCase();
    const href = safeString(match[2]);
    if (rel.includes(relPart.toLowerCase()) && href) {
      return decodeHtml(href);
    }
  }

  const reverseRegex = /<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']([^"']+)["'][^>]*>/gi;
  while ((match = reverseRegex.exec(html)) !== null) {
    const href = safeString(match[1]);
    const rel = safeString(match[2]).toLowerCase();
    if (rel.includes(relPart.toLowerCase()) && href) {
      return decodeHtml(href);
    }
  }

  return '';
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(match[1]) : '';
}

function absoluteUrl(value, baseUrl) {
  try {
    if (!value) return '';
    return new URL(value, baseUrl).toString();
  } catch {
    return '';
  }
}

function hostnameFromUrl(value) {
  try {
    return new URL(ensureUrl(value)).hostname.replace(/^www\./i, '');
  } catch {
    return safeString(value);
  }
}

function ensureUrl(value) {
  const raw = safeString(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function escapeRegex(value) {
  return safeString(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHtml(value) {
  return safeString(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/* -------------------------------------------------------------------------- */
/*                                   DRAWING                                  */
/* -------------------------------------------------------------------------- */

async function drawReport(doc, report, branding) {
  await drawCover(doc, report, branding);
  doc.addPage();

  drawHeaderBar(doc, report, branding);
  drawOverviewSection(doc, report);
  drawMetricsSection(doc, report);
  drawSummaryCards(doc, report);
  drawListSection(doc, 'Priority Fixes', report.priorityFixes, {
    accentLabel: 'HIGH IMPACT',
    bulletColor: COLORS.accent
  });
  drawListSection(doc, 'Top Next Actions', report.topNextActions, {
    accentLabel: 'BUSINESS FOCUS',
    bulletColor: COLORS.success
  });
  drawListSection(doc, 'Issues Found', report.issues, {
    accentLabel: 'AUTO DETECTED',
    bulletColor: COLORS.danger
  });
  drawListSection(doc, 'AI Recommendations', report.aiFeedback, {
    accentLabel: 'AI COACH',
    bulletColor: COLORS.warning
  });
}

async function drawCover(doc, report, branding) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  doc.rect(0, 0, pageWidth, pageHeight).fill('#FFFFFF');

  doc.save();
  doc.rect(0, 0, pageWidth, 180).fill(COLORS.dark);
  doc.restore();

  doc.save();
  doc.roundedRect(50, 140, pageWidth - 100, 150, 20).fill(COLORS.accentSoft);
  doc.restore();

  drawSitePilotMark(doc, 50, 48);

  doc.fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(28)
    .text('AI Website Analysis Report', 50, 88, {
      width: pageWidth - 100,
      align: 'left'
    });

  doc.fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('Scanned website', 72, 165);

  doc.fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(19)
    .text(report.url, 72, 188, {
      width: pageWidth - 144
    });

  doc.fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(11)
    .text(`Generated: ${formatDate(report.scannedAt)}`, 72, 235);

  if (branding?.logoBuffer) {
    drawBrandLogoBlock(doc, branding, pageWidth - 190, 46, 120, 56);
  }

  drawScoreCard(doc, report.score, 50, 330, pageWidth - 100, 165);

  doc.fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(11)
    .text(
      'SitePilot turns technical page analysis into clear SEO, UX and conversion actions.',
      50,
      565,
      {
        width: pageWidth - 100
      }
    );
}

function drawBrandLogoBlock(doc, branding, x, y, w, h) {
  doc.save();
  doc.roundedRect(x, y, w, h, 14).fill('#FFFFFF');
  doc.restore();

  try {
    doc.image(branding.logoBuffer, x + 12, y + 10, {
      fit: [36, 36],
      align: 'center',
      valign: 'center'
    });
  } catch (error) {
    console.error('Brand logo draw error:', error);
  }

  doc.fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(branding.siteName || 'Brand', x + 56, y + 16, {
      width: w - 64
    });

  doc.fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(7.5)
    .text('Detected brand', x + 56, y + 30, {
      width: w - 64
    });
}

function drawSitePilotMark(doc, x, y) {
  doc.save();
  doc.roundedRect(x, y, 90, 26, 13).fill(COLORS.white);
  doc.restore();

  doc.fillColor(COLORS.accent)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('SITEPILOT', x + 14, y + 8);
}

function drawScoreCard(doc, score, x, y, w, h) {
  doc.save();
  doc.roundedRect(x, y, w, h, 18).fill(COLORS.panel);
  doc.restore();

  doc.fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .fontSize(14)
    .text('Overall Score', x + 24, y + 22);

  const scoreColor =
    score >= 80 ? COLORS.success : score >= 60 ? COLORS.warning : COLORS.danger;

  doc.save();
  doc.circle(x + 80, y + 96, 42).fill('#EEF2F7');
  doc.restore();

  doc.fillColor(scoreColor)
    .font('Helvetica-Bold')
    .fontSize(30)
    .text(String(score), x + 54, y + 82, { width: 52, align: 'center' });

  doc.fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(10)
    .text('/100', x + 59, y + 114, { width: 42, align: 'center' });

  const summary =
    score >= 80
      ? 'Strong page foundation. Focus on refinements that improve click-through rate and conversion.'
      : score >= 60
      ? 'Good base with clear upside. Priority fixes can noticeably improve performance.'
      : 'High-impact opportunities detected. Fix the core clarity, SEO and CTA issues first.';

  doc.fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('Executive summary', x + 155, y + 40);

  doc.fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(11)
    .text(summary, x + 155, y + 62, {
      width: w - 185,
      lineGap: 4
    });

  const badgeText = score >= 80 ? 'Strong' : score >= 60 ? 'Promising' : 'Needs Work';
  const badgeWidth = doc.widthOfString(badgeText) + 24;

  doc.save();
  doc.roundedRect(x + 155, y + 110, badgeWidth, 24, 12).fill(scoreColor);
  doc.restore();

  doc.fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(badgeText, x + 167, y + 117);
}

function drawHeaderBar(doc, report, branding) {
  doc.save();
  doc.roundedRect(50, 44, doc.page.width - 100, 42, 12).fill(COLORS.dark);
  doc.restore();

  doc.fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(14)
    .text('SitePilot Analysis Report', 68, 58);

  if (branding?.logoBuffer) {
    try {
      doc.image(branding.logoBuffer, doc.page.width - 132, 50, {
        fit: [20, 20],
        align: 'center',
        valign: 'center'
      });
    } catch (error) {
      console.error('Header logo draw error:', error);
    }
  }

  doc.fillColor('#D1D5DB')
    .font('Helvetica')
    .fontSize(10)
    .text(formatDate(report.scannedAt), doc.page.width - 210, 60, {
      width: 70,
      align: 'right'
    });

  doc.y = 108;
}

function drawOverviewSection(doc, report) {
  sectionTitle(doc, 'Page Overview', 'CORE METADATA');

  const leftX = 50;
  const rightX = 310;
  const labelWidth = 90;
  const valueWidth = 220;

  drawField(doc, 'URL', report.url, leftX, doc.y, labelWidth, valueWidth);
  drawField(doc, 'Title', report.title, rightX, doc.y - 34, labelWidth, valueWidth);

  drawField(doc, 'Meta', report.metaDescription, leftX, doc.y + 4, labelWidth, valueWidth);
  drawField(doc, 'H1', report.h1, rightX, doc.y - 58, labelWidth, valueWidth);

  drawField(doc, 'Primary CTA', report.cta, leftX, doc.y + 4, labelWidth, valueWidth);

  doc.moveDown(1.3);
}

function drawField(doc, label, value, x, y, labelWidth, valueWidth) {
  const safeValue = safeString(value) || 'Not available';

  doc.fillColor(COLORS.muted)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(label.toUpperCase(), x, y, { width: labelWidth });

  doc.fillColor(COLORS.text)
    .font('Helvetica')
    .fontSize(10.5)
    .text(safeValue, x, y + 12, {
      width: valueWidth,
      lineGap: 2
    });

  doc.y = Math.max(doc.y, y + 44);
}

function drawMetricsSection(doc, report) {
  ensureSpace(doc, 120, report);
  sectionTitle(doc, 'Detected Elements', 'SCAN METRICS');

  const cards = [
    { label: 'Links', value: String(report.linkCount) },
    { label: 'Images', value: String(report.imageCount) },
    { label: 'Buttons', value: String(report.buttonCount) },
    { label: 'CTA', value: report.cta && report.cta !== 'Not detected' ? 'Yes' : 'No' }
  ];

  const startX = 50;
  const y = doc.y;
  const gap = 12;
  const totalWidth = doc.page.width - 100;
  const cardWidth = (totalWidth - gap * 3) / 4;

  cards.forEach((card, index) => {
    const x = startX + index * (cardWidth + gap);

    doc.save();
    doc.roundedRect(x, y, cardWidth, 72, 14).fill(COLORS.panel);
    doc.restore();

    doc.fillColor(COLORS.muted)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(card.label.toUpperCase(), x + 16, y + 14);

    doc.fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(card.value, x + 16, y + 32, {
        width: cardWidth - 32
      });
  });

  doc.y = y + 94;
}

function drawSummaryCards(doc, report) {
  ensureSpace(doc, 180, report);
  sectionTitle(doc, 'What matters most', 'ACTION BLOCKS');

  const leftX = 50;
  const topY = doc.y;
  const totalWidth = doc.page.width - 100;
  const gap = 16;
  const cardWidth = (totalWidth - gap) / 2;

  drawInfoCard(
    doc,
    {
      x: leftX,
      y: topY,
      w: cardWidth,
      h: 132,
      title: 'Priority Focus',
      tag: 'TOP 3',
      body:
        report.priorityFixes.length > 0
          ? report.priorityFixes.slice(0, 3).map((item, i) => `${i + 1}. ${item}`).join('\n')
          : 'No priority fixes were provided in the scan payload.'
    },
    COLORS.accent
  );

  drawInfoCard(
    doc,
    {
      x: leftX + cardWidth + gap,
      y: topY,
      w: cardWidth,
      h: 132,
      title: 'Business Next Moves',
      tag: 'ACTION',
      body:
        report.topNextActions.length > 0
          ? report.topNextActions.slice(0, 3).map((item, i) => `${i + 1}. ${item}`).join('\n')
          : 'No next actions available.'
    },
    COLORS.success
  );

  doc.y = topY + 152;
}

function drawInfoCard(doc, card, accentColor) {
  doc.save();
  doc.roundedRect(card.x, card.y, card.w, card.h, 16).fill(COLORS.panel);
  doc.restore();

  doc.fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(card.title, card.x + 18, card.y + 16);

  const tagWidth = doc.widthOfString(card.tag) + 18;
  doc.save();
  doc.roundedRect(card.x + card.w - tagWidth - 18, card.y + 14, tagWidth, 18, 9).fill(accentColor);
  doc.restore();

  doc.fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(card.tag, card.x + card.w - tagWidth - 9, card.y + 19, {
      width: tagWidth - 18,
      align: 'center'
    });

  doc.fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(10)
    .text(card.body, card.x + 18, card.y + 42, {
      width: card.w - 36,
      lineGap: 4
    });
}

function drawListSection(doc, title, items, options = {}) {
  const safeItems =
    Array.isArray(items) && items.length > 0
      ? items
      : ['No data available for this section.'];

  ensureSpace(doc, 90 + safeItems.length * 28, { scannedAt: new Date().toISOString() });
  sectionTitle(doc, title, options.accentLabel || '');

  const x = 50;
  const y = doc.y;
  const w = doc.page.width - 100;

  doc.save();
  doc.roundedRect(x, y, w, 20 + safeItems.length * 30, 16).fill(COLORS.panel);
  doc.restore();

  let currentY = y + 18;

  safeItems.forEach((item, index) => {
    const bulletColor = options.bulletColor || COLORS.accent;

    doc.save();
    doc.circle(x + 18, currentY + 6, 4).fill(bulletColor);
    doc.restore();

    doc.fillColor(COLORS.text)
      .font('Helvetica')
      .fontSize(10.5)
      .text(`${index + 1}. ${safeString(item)}`, x + 32, currentY - 2, {
        width: w - 50,
        lineGap: 3
      });

    currentY = doc.y + 10;
  });

  doc.y = currentY + 4;
}

function sectionTitle(doc, title, eyebrow = '') {
  if (eyebrow) {
    doc.fillColor(COLORS.accent)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text(eyebrow, 50, doc.y);
    doc.moveDown(0.3);
  }

  doc.fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .fontSize(16)
    .text(title, 50, doc.y);

  doc.moveDown(0.7);
}

function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();

  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(i);

    const pageNumber = i + 1;
    const text = `Page ${pageNumber} of ${range.count}`;

    doc.font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.soft)
      .text(text, 50, doc.page.height - 36, {
        align: 'center',
        width: doc.page.width - 100
      });

    doc.font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.soft)
      .text('Generated by SitePilot', 50, doc.page.height - 36, {
        align: 'left',
        width: 160
      });
  }
}

function ensureSpace(doc, neededHeight, report) {
  if (doc.y + neededHeight > doc.page.height - 70) {
    doc.addPage();
    drawHeaderBar(doc, report || { scannedAt: new Date().toISOString() }, null);
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

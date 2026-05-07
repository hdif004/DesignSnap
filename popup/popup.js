// popup/popup.js — Logique de l'interface Design Snap

'use strict';

// ─── Internationalisation ─────────────────────────────────────────────────────

const LANGS = {
  fr: {
    extract:        'Extraire',
    tabColors:      'Couleurs',
    tabTypo:        'Typo',
    tabRadii:       'Radius & Shadows',
    tabVars:        'Variables CSS',
    emptyPrompt:    'Cliquez sur <strong>Extraire</strong> pour analyser la page.',
    btnMediaDl:     'Télécharger média',
    btnInspector:   'Inspecteur',
    statusReady:    'Prêt — cliquez sur Extraire',
    extracting:     'Extraction en cours…',
    noTabAccess:    'Impossible d\'accéder à cet onglet.',
    systemPage:     'Non disponible sur les pages système.',
    reloadPage:     'Rechargez la page et réessayez.',
    extractFailed:  'Extraction échouée.',
    error:          (e) => `Erreur : ${e}`,
    noTokens:       'Extrayez d\'abord les tokens.',
    statusResult:   (c, f, v) => `Top ${c} couleurs · ${f} polices · ${v} variables CSS`,
    seeAll:         (n) => `↓ Voir tout (${n})`,
    collapse:       '↑ Réduire',
    copied:         '✓ Copié !',
    sFontFamilies:  'Font Families',
    sFontSizes:     'Font Sizes',
    sFontWeights:   'Font Weights',
    sLineHeights:   'Line Heights',
    sBorderRadius:  'Border Radius',
    sBoxShadows:    'Box Shadows',
    varsCount:      (n) => `${n} variables`,
    // Contenu content.js (passé dans les messages)
    pickerBanner:   '⬡ Design Snap · Survolez puis cliquez sur une image ou vidéo — Échap pour quitter',
    pickerFolder:   '📁 Choisir le dossier',
    pickerFolderSet:(n) => `📁 ${n} ✓`,
    pickerQuit:     '× Quitter',
    pickerDone:     (n) => `✓ Téléchargé ! (${n} fichier${n > 1 ? 's' : ''} cette session)`,
    pickerAborted:  'Sélection annulée',
    pickerCorsErr:  (e) => `Erreur fetch (${e}) — dossier Téléchargements utilisé`,
    inspTitle:      '⬡ Design Snap Inspector',
    inspHint:       'Clic = épingler',
    inspPlaceholder:'Survolez un élément…',
    inspCopyCSS:    'Copier CSS de l\'élément',
    inspCopied:     '✓ Copié !',
  },
  en: {
    extract:        'Extract',
    tabColors:      'Colors',
    tabTypo:        'Type',
    tabRadii:       'Radius & Shadows',
    tabVars:        'CSS Variables',
    emptyPrompt:    'Click <strong>Extract</strong> to analyze the page.',
    btnMediaDl:     'Download media',
    btnInspector:   'Inspector',
    statusReady:    'Ready — click Extract',
    extracting:     'Extracting…',
    noTabAccess:    'Cannot access this tab.',
    systemPage:     'Not available on system pages.',
    reloadPage:     'Reload the page and try again.',
    extractFailed:  'Extraction failed.',
    error:          (e) => `Error: ${e}`,
    noTokens:       'Extract tokens first.',
    statusResult:   (c, f, v) => `Top ${c} colors · ${f} fonts · ${v} CSS variables`,
    seeAll:         (n) => `↓ Show all (${n})`,
    collapse:       '↑ Collapse',
    copied:         '✓ Copied!',
    sFontFamilies:  'Font Families',
    sFontSizes:     'Font Sizes',
    sFontWeights:   'Font Weights',
    sLineHeights:   'Line Heights',
    sBorderRadius:  'Border Radius',
    sBoxShadows:    'Box Shadows',
    varsCount:      (n) => `${n} variables`,
    pickerBanner:   '⬡ Design Snap · Hover then click any image or video — Esc to quit',
    pickerFolder:   '📁 Choose folder',
    pickerFolderSet:(n) => `📁 ${n} ✓`,
    pickerQuit:     '× Quit',
    pickerDone:     (n) => `✓ Downloaded! (${n} file${n > 1 ? 's' : ''} this session)`,
    pickerAborted:  'Selection cancelled',
    pickerCorsErr:  (e) => `Fetch error (${e}) — using Downloads folder`,
    inspTitle:      '⬡ Design Snap Inspector',
    inspHint:       'Click = pin',
    inspPlaceholder:'Hover any element…',
    inspCopyCSS:    'Copy element CSS',
    inspCopied:     '✓ Copied!',
  },
};

let currentLang = localStorage.getItem('ds-lang') || 'fr';

/** Retourne la traduction d'une clé, avec arguments optionnels pour les fonctions */
function t(key, ...args) {
  const val = LANGS[currentLang]?.[key] ?? LANGS.fr[key] ?? key;
  return typeof val === 'function' ? val(...args) : val;
}

/** Met à jour tous les éléments data-i18n / data-i18n-html et le toggle */
function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.getElementById('btn-lang').textContent = currentLang === 'fr' ? 'EN' : 'FR';
  document.documentElement.lang = currentLang;
  // Re-rendre le contenu dynamique si des tokens sont déjà extraits
  if (extractedTokens) {
    renderAll(extractedTokens);
    const c = Math.min(extractedTokens.colors.length, 5);
    const f = Math.min(extractedTokens.typography?.fontFamilies.length ?? 0, 3);
    const v = Object.keys(extractedTokens.cssVars).length;
    setStatus(t('statusResult', c, f, v), 'ok');
  } else {
    setStatus(t('statusReady'));
  }
}

// ─── État global ──────────────────────────────────────────────────────────────

let extractedTokens = null;
let _showAllColors  = false;

// ─── Références DOM ───────────────────────────────────────────────────────────

const btnExtract  = document.getElementById('btn-extract');
const statusbar   = document.getElementById('statusbar');
const tabs        = document.querySelectorAll('.tab');
const tabPanels   = document.querySelectorAll('.tab-content');
const btnsCopy    = document.querySelectorAll('.btn-copy');

// ─── Initialisation ───────────────────────────────────────────────────────────

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

btnExtract.addEventListener('click', runExtraction);
document.getElementById('btn-image-picker').addEventListener('click', activateImagePicker);
document.getElementById('btn-inspector').addEventListener('click', activateInspector);
document.getElementById('btn-lang').addEventListener('click', () => {
  currentLang = currentLang === 'fr' ? 'en' : 'fr';
  localStorage.setItem('ds-lang', currentLang);
  applyLang();
});

btnsCopy.forEach(btn => {
  btn.addEventListener('click', () => copyAs(btn.dataset.format, btn));
  btn.disabled = true; // Désactivé jusqu'à la première extraction
});

applyLang();

// ─── Extraction ───────────────────────────────────────────────────────────────

async function runExtraction() {
  btnExtract.disabled = true;
  btnExtract.textContent = '…';
  setStatus(t('extracting'));

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      setStatus(t('noTabAccess'), 'error');
      return;
    }

    // Pages système — le content script ne peut pas y être injecté
    const url = tab.url || '';
    if (/^(chrome|edge|about|chrome-extension):\/\//i.test(url)) {
      setStatus(t('systemPage'), 'error');
      return;
    }

    let response = await sendMessageSafe(tab.id);

    // Fallback : le content script n'était pas encore injecté (page ouverte avant installation)
    if (response === null) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] });
      response = await sendMessageSafe(tab.id);
    }

    if (response?.success) {
      extractedTokens = response.tokens;
      renderAll(extractedTokens);
      btnsCopy.forEach(b => (b.disabled = false));

      const c = Math.min(extractedTokens.colors.length, 5);
      const f = Math.min(extractedTokens.typography?.fontFamilies.length ?? 0, 3);
      const v = Object.keys(extractedTokens.cssVars).length;
      setStatus(t('statusResult', c, f, v), 'ok');
    } else {
      setStatus(response?.error || t('extractFailed'), 'error');
    }
  } catch (err) {
    setStatus(t('error', err.message), 'error');
  } finally {
    btnExtract.disabled = false;
    btnExtract.textContent = t('extract');
  }
}

/** Envoie un message au content script et retourne null si la connexion échoue */
async function sendMessageSafe(tabId, message = { action: 'extractTokens' }) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return null;
  }
}

// ─── Rendu global ─────────────────────────────────────────────────────────────

function renderAll(tokens) {
  renderColors(tokens.colors);
  renderTypography(tokens.typography);
  renderRadiiShadows(tokens.radii, tokens.shadows);
  renderCSSVars(tokens.cssVars);
}

// ─── Onglet Couleurs ──────────────────────────────────────────────────────────

function renderColors(colors) {
  const grid        = document.getElementById('colors-grid');
  const empty       = document.getElementById('colors-empty');
  const toggleWrap  = document.getElementById('colors-toggle-wrap');
  const toggleBtn   = document.getElementById('colors-toggle');

  if (!colors?.length) {
    empty.style.display      = 'flex';
    grid.style.display       = 'none';
    toggleWrap.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  grid.style.display  = 'grid';
  grid.innerHTML      = '';

  const slice = _showAllColors ? colors : colors.slice(0, 5);

  slice.forEach(({ color, count }) => {
    const item   = el('div', 'color-item');
    const swatch = el('div', 'color-swatch');
    const label  = el('div', 'color-value');

    swatch.style.background = color;
    item.title = `${color}`;
    label.textContent = color;

    item.addEventListener('click', () => {
      navigator.clipboard.writeText(color).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = color; ta.style.cssText = 'position:fixed;top:-999px;opacity:0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      });
      label.textContent = '✓';
      label.style.color = '#16a34a';
      setTimeout(() => { label.textContent = color; label.style.color = ''; }, 1200);
    });

    item.append(swatch, label);
    grid.appendChild(item);
  });

  // Bouton toggle
  if (colors.length > 5) {
    toggleWrap.style.display = 'block';
    toggleBtn.textContent = _showAllColors
      ? t('collapse')
      : t('seeAll', colors.length);
    toggleBtn.onclick = () => {
      _showAllColors = !_showAllColors;
      renderColors(colors);
    };
  } else {
    toggleWrap.style.display = 'none';
  }
}

// ─── Onglet Typographie ───────────────────────────────────────────────────────

function renderTypography(typo) {
  const content = document.getElementById('typo-content');
  const empty   = document.getElementById('typo-empty');

  const hasData = typo && (typo.fontFamilies.length || typo.fontSizes.length || typo.fontWeights.length);

  if (!hasData) {
    empty.style.display   = 'flex';
    content.style.display = 'none';
    return;
  }

  empty.style.display   = 'none';
  content.style.display = 'block';
  content.innerHTML = '';

  const sections = [
    { title: t('sFontFamilies'), items: typo.fontFamilies.slice(0, 3) },
    { title: t('sFontSizes'),    items: typo.fontSizes.slice(0, 8) },
    { title: t('sFontWeights'),  items: typo.fontWeights.slice(0, 5) },
    { title: t('sLineHeights'),  items: typo.lineHeights.slice(0, 5) },
  ];

  for (const { title, items } of sections) {
    if (!items.length) continue;
    content.appendChild(buildTokenSection(title, items));
  }
}

function buildTokenSection(title, items) {
  const section  = el('div', 'section');
  const titleEl  = el('div', 'section-title');
  titleEl.textContent = title;
  section.appendChild(titleEl);

  for (const { value, count } of items) {
    const row   = el('div', 'token-row');
    const label = el('span', 'token-label');
    const cnt   = el('span', 'token-count');

    label.textContent = value;
    cnt.textContent   = `×${count}`;
    row.title = value;
    row.addEventListener('click', () => flashCopy(value, row));

    row.append(label, cnt);
    section.appendChild(row);
  }

  return section;
}

// ─── Onglet Radius & Shadows ──────────────────────────────────────────────────

function renderRadiiShadows(radii, shadows) {
  const content = document.getElementById('radii-content');
  const empty   = document.getElementById('radii-empty');

  if (!radii?.length && !shadows?.length) {
    empty.style.display   = 'flex';
    content.style.display = 'none';
    return;
  }

  empty.style.display   = 'none';
  content.style.display = 'block';
  content.innerHTML = '';

  // — Border radius —
  if (radii?.length) {
    const titleEl = el('div', 'section-title');
    titleEl.textContent = t('sBorderRadius');
    content.appendChild(titleEl);

    const grid = el('div', 'radius-grid');

    radii.slice(0, 12).forEach(({ value, count }) => {
      const item    = el('div', 'radius-item');
      const preview = el('div', 'radius-preview');
      const label   = el('div', 'radius-label');

      preview.style.borderRadius = value;
      preview.title = `${value} (×${count})`;
      label.textContent = value;
      item.addEventListener('click', () => flashCopy(value, item));

      item.append(preview, label);
      grid.appendChild(item);
    });

    content.appendChild(grid);
  }

  // — Box Shadows —
  if (shadows?.length) {
    const titleEl = el('div', 'section-title');
    titleEl.textContent = t('sBoxShadows');
    content.appendChild(titleEl);

    shadows.slice(0, 8).forEach(({ value, count }) => {
      const item    = el('div', 'shadow-item');
      const preview = el('div', 'shadow-preview');
      const label   = el('div', 'shadow-value');

      preview.style.boxShadow = value;
      label.textContent = `${value}  ×${count}`;
      item.addEventListener('click', () => flashCopy(value, item));

      item.append(preview, label);
      content.appendChild(item);
    });
  }
}

// ─── Onglet Variables CSS ─────────────────────────────────────────────────────

function renderCSSVars(vars) {
  const content = document.getElementById('vars-content');
  const empty   = document.getElementById('vars-empty');
  const entries = Object.entries(vars || {});

  if (!entries.length) {
    empty.style.display   = 'flex';
    content.style.display = 'none';
    return;
  }

  empty.style.display   = 'none';
  content.style.display = 'block';
  content.innerHTML = '';

  const countLabel = el('div', 'var-count-label');
  countLabel.textContent = t('varsCount', entries.length);
  content.appendChild(countLabel);

  for (const [name, value] of entries) {
    const row      = el('div', 'var-row');
    const nameEl   = el('div', 'var-name');
    const valueEl  = el('div', 'var-value');

    // Ajouter un point de couleur si la valeur est une couleur
    if (/^#|^rgb|^hsl/.test(value)) {
      const dot = el('span', 'color-dot');
      dot.style.background = value;
      nameEl.appendChild(dot);
    }

    nameEl.appendChild(document.createTextNode(name));
    valueEl.textContent = value;
    row.title = `${name}: ${value}`;
    row.addEventListener('click', () => flashCopy(`${name}: ${value};`, row));

    row.append(nameEl, valueEl);
    content.appendChild(row);
  }
}

// ─── Formats de copie ─────────────────────────────────────────────────────────

function copyAs(format, btn) {
  if (!extractedTokens) {
    setStatus(t('noTokens'), 'error');
    return;
  }

  const text = {
    json:     () => formatStyleDictionary(extractedTokens),
    css:      () => formatCSSVariables(extractedTokens),
    tailwind: () => formatTailwind(extractedTokens),
    figma:    () => formatFigmaTokens(extractedTokens),
  }[format]?.();

  if (!text) return;

  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = t('copied');
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 1600);
  }).catch(() => {
    // Fallback pour les contextes sans accès clipboard
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

// — Format Style Dictionary (JSON) —
function formatStyleDictionary(tokens) {
  const obj = {};

  if (tokens.colors.length) {
    obj.color = {};
    tokens.colors.slice(0, 5).forEach(({ color }, i) => {
      obj.color[`color-${pad(i + 1)}`] = { value: color, type: 'color' };
    });
  }

  const typo = tokens.typography;
  if (typo?.fontFamilies.length) {
    obj.fontFamily = {};
    typo.fontFamilies.slice(0, 3).forEach(({ value }, i) => {
      obj.fontFamily[`family-${i + 1}`] = { value, type: 'fontFamilies' };
    });
  }
  if (typo?.fontSizes.length) {
    obj.fontSize = {};
    typo.fontSizes.slice(0, 8).forEach(({ value }, i) => {
      obj.fontSize[`size-${i + 1}`] = { value, type: 'fontSizes' };
    });
  }
  if (typo?.fontWeights.length) {
    obj.fontWeight = {};
    typo.fontWeights.slice(0, 5).forEach(({ value }, i) => {
      obj.fontWeight[`weight-${i + 1}`] = { value, type: 'fontWeights' };
    });
  }

  if (tokens.radii.length) {
    obj.borderRadius = {};
    tokens.radii.slice(0, 10).forEach(({ value }, i) => {
      obj.borderRadius[`radius-${i + 1}`] = { value, type: 'borderRadius' };
    });
  }

  if (tokens.shadows.length) {
    obj.boxShadow = {};
    tokens.shadows.slice(0, 8).forEach(({ value }, i) => {
      obj.boxShadow[`shadow-${i + 1}`] = { value, type: 'boxShadow' };
    });
  }

  // Variables CSS existantes
  const cssVarEntries = Object.entries(tokens.cssVars);
  if (cssVarEntries.length) {
    obj.rawCssVars = {};
    cssVarEntries.forEach(([name, value]) => {
      const key = name.replace(/^--/, '');
      obj.rawCssVars[key] = { value };
    });
  }

  return JSON.stringify(obj, null, 2);
}

// — Format CSS Variables —
function formatCSSVariables(tokens) {
  const lines = [':root {'];

  tokens.colors.slice(0, 5).forEach(({ color }, i) => {
    lines.push(`  --color-${pad(i + 1)}: ${color};`);
  });

  const typo = tokens.typography;
  typo?.fontFamilies.slice(0, 3).forEach(({ value }, i)  => lines.push(`  --font-family-${i + 1}: ${value};`));
  typo?.fontSizes.slice(0, 8).forEach(({ value }, i)     => lines.push(`  --font-size-${i + 1}: ${value};`));
  typo?.fontWeights.slice(0, 5).forEach(({ value }, i)   => lines.push(`  --font-weight-${i + 1}: ${value};`));
  typo?.lineHeights.slice(0, 5).forEach(({ value }, i)   => lines.push(`  --line-height-${i + 1}: ${value};`));

  tokens.radii.slice(0, 10).forEach(({ value }, i)   => lines.push(`  --radius-${i + 1}: ${value};`));
  tokens.shadows.slice(0, 8).forEach(({ value }, i)  => lines.push(`  --shadow-${i + 1}: ${value};`));

  Object.entries(tokens.cssVars).forEach(([name, value]) => lines.push(`  ${name}: ${value};`));

  lines.push('}');
  return lines.join('\n');
}

// — Format Tailwind config —
function formatTailwind(tokens) {
  const colors = {};
  tokens.colors.slice(0, 5).forEach(({ color }, i) => {
    colors[`extracted-${pad(i + 1)}`] = color;
  });

  const fontFamily = {};
  tokens.typography?.fontFamilies.slice(0, 3).forEach(({ value }, i) => {
    fontFamily[`font-${i + 1}`] = value.split(',').map(f => f.trim());
  });

  const fontSize = {};
  tokens.typography?.fontSizes.slice(0, 8).forEach(({ value }, i) => {
    fontSize[`size-${i + 1}`] = value;
  });

  const borderRadius = {};
  tokens.radii.slice(0, 10).forEach(({ value }, i) => {
    borderRadius[`radius-${i + 1}`] = value;
  });

  const boxShadow = {};
  tokens.shadows.slice(0, 8).forEach(({ value }, i) => {
    boxShadow[`shadow-${i + 1}`] = value;
  });

  const config = {
    theme: {
      extend: { colors, fontFamily, fontSize, borderRadius, boxShadow },
    },
  };

  return `/** @type {import('tailwindcss').Config} */\nmodule.exports = ${JSON.stringify(config, null, 2)};`;
}

// — Format Figma Tokens (compatible Tokens Studio plugin) —
function formatFigmaTokens(tokens) {
  const global = {};

  tokens.colors.slice(0, _showAllColors ? undefined : 5).forEach(({ color }, i) => {
    global[`color-${pad(i + 1)}`] = { value: color, type: 'color' };
  });

  const typo = tokens.typography;
  typo?.fontFamilies.slice(0, 3).forEach(({ value }, i) => {
    global[`fontFamily-${i + 1}`] = { value, type: 'fontFamilies' };
  });
  typo?.fontSizes.slice(0, 8).forEach(({ value }, i) => {
    global[`fontSize-${i + 1}`] = { value, type: 'fontSizes' };
  });
  typo?.fontWeights.slice(0, 5).forEach(({ value }, i) => {
    global[`fontWeight-${i + 1}`] = { value, type: 'fontWeights' };
  });
  typo?.lineHeights.slice(0, 5).forEach(({ value }, i) => {
    global[`lineHeight-${i + 1}`] = { value, type: 'lineHeights' };
  });

  tokens.radii.slice(0, 10).forEach(({ value }, i) => {
    global[`borderRadius-${i + 1}`] = { value, type: 'borderRadius' };
  });
  tokens.shadows.slice(0, 8).forEach(({ value }, i) => {
    global[`boxShadow-${i + 1}`] = { value, type: 'boxShadow' };
  });

  return JSON.stringify({ global }, null, 2);
}

// ─── Utilitaires UI ───────────────────────────────────────────────────────────

/** Crée un élément avec une classe CSS */
function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/** Met à jour la barre de statut */
function setStatus(msg, state = '') {
  statusbar.textContent = msg;
  statusbar.className = 'statusbar' + (state ? ' ' + state : '');
}

/** Flash visuel lors d'un clic/copie sur un item inline */
function flashCopy(text, target) {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });

  const prev = target.style.outline;
  target.style.outline = '1.5px solid #16a34a';
  setTimeout(() => (target.style.outline = prev), 500);
}

/** Pad d'un nombre sur 2 chiffres : 1 → "01" */
function pad(n) {
  return n.toString().padStart(2, '0');
}

// ─── Inspecteur ──────────────────────────────────────────────────────────────

async function activateInspector() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const url = tab.url || '';
    if (/^(chrome|edge|about|chrome-extension):\/\//i.test(url)) {
      setStatus(t('systemPage'), 'error');
      return;
    }
    let ok = await sendMessageSafe(tab.id, { action: 'ping' });
    if (!ok) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] });
    }
    await chrome.tabs.sendMessage(tab.id, { action: 'startInspector', lang: currentLang });
    window.close();
  } catch (err) {
    setStatus(t('error', err.message), 'error');
  }
}

// ─── Téléchargement d'image ───────────────────────────────────────────────────

async function activateImagePicker() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const url = tab.url || '';
    if (/^(chrome|edge|about|chrome-extension):\/\//i.test(url)) {
      setStatus(t('systemPage'), 'error');
      return;
    }

    // S'assurer que le content script est injecté
    let ok = await sendMessageSafe(tab.id, { action: 'ping' });
    if (!ok) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] });
    }

    await chrome.tabs.sendMessage(tab.id, { action: 'startImagePicker', lang: currentLang });
    // Fermer le popup pour que l'utilisateur puisse interagir avec la page
    window.close();
  } catch (err) {
    setStatus(t('error', err.message), 'error');
  }
}

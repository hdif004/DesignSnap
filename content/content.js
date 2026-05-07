// content/content.js — Script d'extraction des design tokens
// Injecté automatiquement sur toutes les pages via manifest.json

// Guard contre la double injection (ex: si executeScript est appelé en fallback)
if (typeof window.__designSnapInjected === 'undefined') {
  window.__designSnapInjected = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'ping') {
      sendResponse({ success: true });
      return false;
    }
    if (message.action === 'extractTokens') {
      try {
        sendResponse({ success: true, tokens: extractAllTokens() });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }
    if (message.action === 'startImagePicker') {
      _contentLang = message.lang || 'fr';
      startImagePicker();
      sendResponse({ success: true });
      return false;
    }
    if (message.action === 'startInspector') {
      _contentLang = message.lang || 'fr';
      startInspector();
      sendResponse({ success: true });
      return false;
    }
    return false;
  });
}

// ─── i18n minimal pour le content script ─────────────────────────────────────

let _contentLang = 'fr';

const _CONTENT_STRINGS = {
  fr: {
    pickerBanner:    '⬡ Design Snap · Survolez puis cliquez sur une image ou vidéo — Échap pour quitter',
    pickerFolder:    '📁 Choisir le dossier',
    pickerFolderSet: (n) => `📁 ${n} ✓`,
    pickerQuit:      '× Quitter',
    pickerAborted:   'Sélection annulée',
    pickerDone:      (name, count) => name
      ? `✓ ${name} enregistré (${count} fichier${count > 1 ? 's' : ''})`
      : `✓ Téléchargé (${count} fichier${count > 1 ? 's' : ''})`,
    pickerCorsErr:   (e) => `Erreur fetch (${e}) — téléchargement dans Téléchargements`,
    inspTitle:       '⬡ Design Snap Inspector',
    inspHint:        'Clic = épingler',
    inspPlaceholder: 'Survolez un élément…',
    inspCopyCSS:     'Copier CSS de l\'élément',
    inspCopied:      '✓ Copié !',
  },
  en: {
    pickerBanner:    '⬡ Design Snap · Hover then click any image or video — Esc to quit',
    pickerFolder:    '📁 Choose folder',
    pickerFolderSet: (n) => `📁 ${n} ✓`,
    pickerQuit:      '× Quit',
    pickerAborted:   'Selection cancelled',
    pickerDone:      (name, count) => name
      ? `✓ ${name} saved (${count} file${count > 1 ? 's' : ''})`
      : `✓ Downloaded (${count} file${count > 1 ? 's' : ''})`,
    pickerCorsErr:   (e) => `Fetch error (${e}) — using Downloads folder`,
    inspTitle:       '⬡ Design Snap Inspector',
    inspHint:        'Click = pin',
    inspPlaceholder: 'Hover any element…',
    inspCopyCSS:     'Copy element CSS',
    inspCopied:      '✓ Copied!',
  },
};

function _ct(key, ...args) {
  const strings = _CONTENT_STRINGS[_contentLang] ?? _CONTENT_STRINGS.fr;
  const val = strings[key] ?? _CONTENT_STRINGS.fr[key] ?? key;
  return typeof val === 'function' ? val(...args) : val;
}

// ─── Orchestrateur principal ──────────────────────────────────────────────────

function extractAllTokens() {
  return {
    colors:    extractColors(),
    typography: extractTypography(),
    radii:     extractBorderRadii(),
    shadows:   extractBoxShadows(),
    cssVars:   extractCSSVariables(),
  };
}

// ─── Variables CSS custom (:root) ─────────────────────────────────────────────

function extractCSSVariables() {
  const vars = {};

  // Approche 1 : getComputedStyle(:root) — capture les valeurs résolues
  const rootStyle = getComputedStyle(document.documentElement);
  for (const prop of rootStyle) {
    if (prop.startsWith('--')) {
      vars[prop] = rootStyle.getPropertyValue(prop).trim();
    }
  }

  // Approche 2 : scanner les règles des stylesheets — capture les valeurs brutes
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules || []) {
        if (rule.selectorText === ':root' && rule.style) {
          for (const prop of rule.style) {
            if (prop.startsWith('--')) {
              vars[prop] = rule.style.getPropertyValue(prop).trim();
            }
          }
        }
      }
    } catch (_) {
      // Stylesheet cross-origin — accès refusé par le navigateur, on l'ignore
    }
  }

  return vars;
}

// ─── Couleurs ─────────────────────────────────────────────────────────────────

function extractColors() {
  const colorMap = new Map();
  const props = [
    'color', 'backgroundColor',
    'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor',
  ];

  for (const el of getTargetElements()) {
    const style = getComputedStyle(el);
    for (const prop of props) {
      const hex = normalizeColor(style[prop]);
      if (hex) colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
    }
  }

  return [...colorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([color, count]) => ({ color, count }));
}

// ─── Typographie ──────────────────────────────────────────────────────────────

function extractTypography() {
  const families   = new Map();
  const sizes      = new Map();
  const weights    = new Map();
  const lineHeights = new Map();

  // Polices purement génériques — jamais de vrais tokens design
  const GENERIC_FONTS = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
    'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace',
    'ui-rounded', '-apple-system', 'BlinkMacSystemFont',
  ]);

  for (const el of getTargetElements()) {
    const s = getComputedStyle(el);

    // Filtrer les stacks de polices 100% génériques
    const family = s.fontFamily;
    const familyNames = family.split(',').map(f => f.trim().replace(/['"]/g, ''));
    const hasCustomFont = familyNames.some(f => !GENERIC_FONTS.has(f));
    if (hasCustomFont) inc(families, family);

    inc(sizes,    s.fontSize);
    inc(weights,  s.fontWeight);
    if (s.lineHeight !== 'normal') inc(lineHeights, s.lineHeight);
  }

  const sortMap = m =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));

  return {
    fontFamilies: sortMap(families),
    fontSizes:    sortMap(sizes),
    fontWeights:  sortMap(weights),
    lineHeights:  sortMap(lineHeights),
  };
}

// ─── Border radius ────────────────────────────────────────────────────────────

function extractBorderRadii() {
  const map = new Map();
  for (const el of getTargetElements()) {
    const r = getComputedStyle(el).borderRadius;
    if (r && r !== '0px') inc(map, r);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));
}

// ─── Box shadows ──────────────────────────────────────────────────────────────

function extractBoxShadows() {
  const map = new Map();
  for (const el of getTargetElements()) {
    const s = getComputedStyle(el).boxShadow;
    if (s && s !== 'none') inc(map, s);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

/**
 * Retourne les éléments DOM pertinents pour l'extraction
 * (exclut les balises non-visuelles, limite à 800 éléments pour les perfs)
 */
function getTargetElements() {
  const skip = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'HEAD', 'NOSCRIPT', 'TEMPLATE', 'SVG']);
  const all = document.querySelectorAll('*');
  const result = [];
  for (let i = 0; i < all.length && result.length < 800; i++) {
    if (!skip.has(all[i].tagName.toUpperCase())) result.push(all[i]);
  }
  return result;
}

/**
 * Normalise rgb()/rgba() en #hex ou rgba(…)
 * Retourne null pour les valeurs transparentes ou invalides
 */
function normalizeColor(value) {
  if (!value || value === 'transparent') return null;

  const m = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return null;

  const [, r, g, b, a = '1'] = m;
  const alpha = parseFloat(a);
  if (alpha === 0) return null; // Entièrement transparent

  if (alpha >= 0.999) {
    // Couleur opaque → hex compact
    return '#' + [r, g, b].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }

  // Semi-transparent → conserver rgba
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2).replace(/\.?0+$/, '')})`;
}

/** Incrémente un compteur dans une Map */
function inc(map, key) {
  if (key) map.set(key, (map.get(key) || 0) + 1);
}

// ─── Mode téléchargement (images + vidéos) ───────────────────────────────────

let _pickerActive = false;
let _dirHandle    = null;   // FileSystemDirectoryHandle — dossier choisi par l'user
let _dlCount      = 0;
let _overlay      = null;
let _banner       = null;
let _bannerText   = null;
let _btnFolder    = null;
let _lastTarget   = null;

function startImagePicker() {
  if (_pickerActive) return;
  _pickerActive = true;
  _dlCount = 0;

  // ── Overlay de surbrillance ──
  _overlay = document.createElement('div');
  _overlay.style.cssText = [
    'position:fixed', 'pointer-events:none', 'z-index:2147483646',
    'border:2.5px solid #4ade80',
    'background:rgba(74,222,128,.07)',
    'box-shadow:0 0 0 9999px rgba(0,0,0,.52)',
    'border-radius:3px', 'display:none',
  ].join(';');
  document.documentElement.appendChild(_overlay);

  // ── Bandeau ──
  _banner = document.createElement('div');
  _banner.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
    'background:#0f0f0f', 'border-bottom:2px solid #4ade80',
    'box-shadow:0 2px 20px rgba(0,0,0,.7)',
    'display:flex', 'align-items:center', 'gap:10px',
    'padding:0 14px', 'height:40px',
    'font:500 12.5px -apple-system,BlinkMacSystemFont,sans-serif',
  ].join(';');

  _bannerText = document.createElement('span');
  _bannerText.style.cssText = 'flex:1;color:#4ade80;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  _setBannerText();

  // Bouton "Choisir le dossier" — ouvre le sélecteur natif UNE seule fois
  _btnFolder = document.createElement('button');
  _btnFolder.style.cssText = _btnStyle();
  _updateFolderBtn();
  _btnFolder.addEventListener('click', async e => {
    e.stopPropagation();
    try {
      // showDirectoryPicker() doit être appelé directement dans le handler de clic (user gesture)
      _dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      _updateFolderBtn();
    } catch (err) {
      if (err.name !== 'AbortError') _flashBanner(_ct('pickerAborted'), '#f87171');
    }
  });

  const btnClose = document.createElement('button');
  btnClose.textContent = _ct('pickerQuit');
  btnClose.style.cssText = _btnStyle('#f87171');
  btnClose.addEventListener('click', e => { e.stopPropagation(); stopImagePicker(); });

  _banner.append(_bannerText, _btnFolder, btnClose);
  document.documentElement.appendChild(_banner);

  document.addEventListener('mousemove', _onMove,  true);
  document.addEventListener('click',     _onClick, true);
  document.addEventListener('keydown',   _onKey,   true);
  document.body.style.cursor = 'crosshair';
}

function stopImagePicker() {
  _pickerActive = false;
  _lastTarget   = null;
  document.removeEventListener('mousemove', _onMove,  true);
  document.removeEventListener('click',     _onClick, true);
  document.removeEventListener('keydown',   _onKey,   true);
  document.body.style.cursor = '';
  _overlay?.remove();  _overlay = null;
  _banner?.remove();   _banner  = null;
  _bannerText = null;  _btnFolder = null;
}

// ── Événements ──

function _onMove(e) {
  if (_banner?.contains(e.target)) { _overlay.style.display = 'none'; return; }

  const media = _findMedia(e.target);
  _lastTarget = media;

  if (!media) {
    _overlay.style.display = 'none';
    document.body.style.cursor = 'crosshair';
    return;
  }

  const r = media.getBoundingClientRect();
  _overlay.style.display = 'block';
  _overlay.style.top     = r.top    + 'px';
  _overlay.style.left    = r.left   + 'px';
  _overlay.style.width   = r.width  + 'px';
  _overlay.style.height  = r.height + 'px';
  document.body.style.cursor = 'pointer';
}

function _onClick(e) {
  if (_banner?.contains(e.target)) return;
  e.preventDefault();
  e.stopPropagation();

  const media = _findMedia(e.target) || _lastTarget;
  if (!media) return;
  const url = _getMediaUrl(media);
  if (!url) return;

  _doDownload(url, _buildFilename(url, media));
}

function _onKey(e) {
  if (e.key === 'Escape') { e.stopPropagation(); stopImagePicker(); }
}

// ── Téléchargement ──

async function _doDownload(url, filename) {
  if (_dirHandle) {
    // ─ Dossier choisi : écriture directe via File System Access API ─
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();

      const finalName = await _uniqueName(_dirHandle, filename);
      const fh = await _dirHandle.getFileHandle(finalName, { create: true });
      const writable = await fh.createWritable();
      await writable.write(blob);
      await writable.close();

      _onDone(finalName);
    } catch (err) {
      // CORS ou permission refusée → fallback chrome.downloads dans le dossier par défaut
      _flashBanner(_ct('pickerCorsErr', err.message), '#f87171');
      chrome.runtime.sendMessage({ action: 'download', url, filename, saveAs: false }, _onDone);
    }
  } else {
    // ─ Pas de dossier choisi : dossier Téléchargements par défaut ─
    chrome.runtime.sendMessage({ action: 'download', url, filename, saveAs: false }, _onDone);
  }
}

function _onDone(filenameOrResp) {
  _dlCount++;
  const name = typeof filenameOrResp === 'string' ? filenameOrResp : null;
  _flashBanner(_ct('pickerDone', name, _dlCount), '#fff', 2200);
}

/** Génère un nom unique si le fichier existe déjà dans le dossier cible */
async function _uniqueName(dirHandle, filename) {
  const ext  = filename.includes('.') ? '.' + filename.split('.').pop() : '';
  const base = ext ? filename.slice(0, -ext.length) : filename;
  let candidate = filename;
  let i = 1;
  while (true) {
    try {
      await dirHandle.getFileHandle(candidate); // lance si le fichier n'existe pas
      candidate = `${base}-${i}${ext}`;
      i++;
    } catch {
      return candidate; // fichier inexistant → nom disponible
    }
  }
}

// ── Détection du média ──

function _findMedia(el) {
  let cur = el;
  while (cur && cur !== document.documentElement) {
    const tag = cur.tagName;
    if (tag === 'VIDEO' && (cur.currentSrc || cur.src)) return cur;
    if (tag === 'SOURCE') {
      const vid = cur.closest('video');
      if (vid) return vid;
    }
    if (tag === 'IMG' && (cur.currentSrc || cur.src)) return cur;
    const bg = getComputedStyle(cur).backgroundImage;
    if (bg && bg !== 'none' && /url\(/.test(bg) && !/gradient/.test(bg)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

function _getMediaUrl(el) {
  if (el.tagName === 'VIDEO') return el.currentSrc || el.src || null;
  if (el.tagName === 'IMG')   return el.currentSrc || el.src || null;
  const m = getComputedStyle(el).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
  return m ? m[1] : null;
}

function _buildFilename(url, el) {
  try {
    const path = new URL(url, location.href).pathname;
    const name = path.split('/').pop().split('?')[0];
    if (name && /\.\w{2,5}$/.test(name)) return name;
  } catch (_) { /* URL relative */ }
  return `${el?.tagName === 'VIDEO' ? 'video' : 'image'}-${Date.now()}`;
}

// ── Helpers UI ──

function _setBannerText() {
  if (_bannerText) _bannerText.textContent = _ct('pickerBanner');
}

function _updateFolderBtn() {
  if (!_btnFolder) return;
  if (_dirHandle) {
    _btnFolder.textContent    = _ct('pickerFolderSet', _dirHandle.name);
    _btnFolder.style.color    = '#4ade80';
    _btnFolder.style.borderColor = '#4ade80';
  } else {
    _btnFolder.textContent    = _ct('pickerFolder');
    _btnFolder.style.color    = '#e2e2e2';
    _btnFolder.style.borderColor = '#2e2e2e';
  }
}

/** Affiche brièvement un message dans le bandeau puis restaure le texte normal */
function _flashBanner(msg, color = '#fff', duration = 2200) {
  if (!_bannerText) return;
  _bannerText.textContent = msg;
  _bannerText.style.color = color;
  setTimeout(() => {
    _setBannerText();
    _bannerText.style.color = '#4ade80';
  }, duration);
}

function _btnStyle(color = '#e2e2e2') {
  return [
    'background:#1a1a1a', `color:${color}`,
    'border:1px solid #2e2e2e', 'border-radius:5px',
    'padding:4px 10px', 'font-size:11.5px', 'font-weight:600',
    'cursor:pointer', 'white-space:nowrap', 'flex-shrink:0',
    'transition:color .12s,border-color .12s',
  ].join(';');
}

// ─── Inspecteur d'éléments ───────────────────────────────────────────────────

let _inspectorActive = false;
let _inspectOverlay  = null;
let _inspectPanel    = null;
let _inspectBody     = null;
let _pinnedEl        = null;   // élément "épinglé" au clic

function startInspector() {
  if (_inspectorActive || _pickerActive) return;
  _inspectorActive = true;

  // Contour pointillé vert qui suit le survol
  _inspectOverlay = document.createElement('div');
  _inspectOverlay.style.cssText = [
    'position:fixed', 'pointer-events:none', 'z-index:2147483645',
    'border:2px dashed #16a34a',
    'background:rgba(22,163,74,.04)',
    'border-radius:3px', 'display:none',
  ].join(';');
  document.documentElement.appendChild(_inspectOverlay);

  // Panneau flottant (coin bas-droite)
  _inspectPanel = document.createElement('div');
  _inspectPanel.style.cssText = [
    'position:fixed', 'bottom:16px', 'right:16px', 'z-index:2147483647',
    'width:256px', 'background:#fff',
    'border:1px solid #e2e2e2', 'border-top:3px solid #16a34a',
    'border-radius:8px',
    'box-shadow:0 8px 32px rgba(0,0,0,.14)',
    'font:12px -apple-system,BlinkMacSystemFont,sans-serif',
    'color:#111', 'overflow:hidden',
  ].join(';');

  // En-tête du panneau
  const panelHead = document.createElement('div');
  panelHead.style.cssText = [
    'display:flex', 'align-items:center', 'justify-content:space-between',
    'padding:7px 10px',
    'background:#f5f5f5', 'border-bottom:1px solid #e2e2e2',
  ].join(';');

  const panelTitle = document.createElement('span');
  panelTitle.style.cssText = 'font-weight:700;font-size:10.5px;color:#16a34a;letter-spacing:.02em';
  panelTitle.textContent = _ct('inspTitle');

  const hint = document.createElement('span');
  hint.style.cssText = 'font-size:9.5px;color:#bbb;margin-right:6px';
  hint.textContent = _ct('inspHint');

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:15px;color:#aaa;padding:0;line-height:1';
  closeBtn.addEventListener('click', stopInspector);

  const headRight = document.createElement('div');
  headRight.style.cssText = 'display:flex;align-items:center;gap:4px';
  headRight.append(hint, closeBtn);
  panelHead.append(panelTitle, headRight);

  // Corps du panneau
  _inspectBody = document.createElement('div');
  _inspectBody.style.cssText = 'padding:10px';

  const placeholder = document.createElement('span');
  placeholder.style.cssText = 'font-size:11px;color:#aaa';
  placeholder.textContent = _ct('inspPlaceholder');
  _inspectBody.appendChild(placeholder);

  _inspectPanel.append(panelHead, _inspectBody);
  document.documentElement.appendChild(_inspectPanel);

  document.addEventListener('mousemove', _onInspectMove, true);
  document.addEventListener('click',     _onInspectClick, true);
  document.addEventListener('keydown',   _onInspectKey,   true);
}

function stopInspector() {
  _inspectorActive = false;
  _pinnedEl        = null;
  document.removeEventListener('mousemove', _onInspectMove, true);
  document.removeEventListener('click',     _onInspectClick, true);
  document.removeEventListener('keydown',   _onInspectKey,   true);
  _inspectOverlay?.remove(); _inspectOverlay = null;
  _inspectPanel?.remove();   _inspectPanel   = null;
  _inspectBody = null;
}

function _onInspectMove(e) {
  if (_inspectPanel?.contains(e.target)) return;
  if (_pinnedEl) return; // épinglé → ne pas mettre à jour au hover

  const target = e.target;
  if (!target || target === document.documentElement || target === document.body) return;

  _updateInspectOverlay(target);
  _updateInspectBody(target);
}

function _onInspectClick(e) {
  if (_inspectPanel?.contains(e.target)) return;
  e.stopPropagation();

  if (_pinnedEl === e.target) {
    // Deuxième clic sur le même élément → désépingler
    _pinnedEl = null;
    const hint = _inspectPanel?.querySelector('span[style*="épingler"]') ||
                 _inspectPanel?.querySelector('span:nth-child(1)');
  } else {
    _pinnedEl = e.target;
    _updateInspectOverlay(e.target);
    _updateInspectBody(e.target);
  }
}

function _onInspectKey(e) {
  if (e.key === 'Escape') { e.stopPropagation(); stopInspector(); }
}

function _updateInspectOverlay(el) {
  const r = el.getBoundingClientRect();
  _inspectOverlay.style.display = 'block';
  _inspectOverlay.style.top     = r.top    + 'px';
  _inspectOverlay.style.left    = r.left   + 'px';
  _inspectOverlay.style.width   = r.width  + 'px';
  _inspectOverlay.style.height  = r.height + 'px';
}

function _updateInspectBody(el) {
  if (!_inspectBody) return;
  _inspectBody.innerHTML = '';

  const s   = getComputedStyle(el);
  const tag = el.tagName.toLowerCase();
  const id  = el.id ? `#${el.id}` : '';
  const cls = typeof el.className === 'string' && el.className.trim()
    ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
    : '';

  // Sélecteur de l'élément
  const selector = document.createElement('div');
  selector.style.cssText = [
    'font-family:Menlo,Consolas,monospace', 'font-size:10px',
    'color:#16a34a', 'font-weight:600',
    'margin-bottom:8px', 'white-space:nowrap',
    'overflow:hidden', 'text-overflow:ellipsis',
  ].join(';');
  selector.title = `<${tag}${id}${cls}>`;
  selector.textContent = `<${tag}${id}${cls}>`;
  _inspectBody.appendChild(selector);

  // Tableau des propriétés
  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse';

  const colorHex = normalizeColor(s.color);
  const bgHex    = normalizeColor(s.backgroundColor);
  const fontName = s.fontFamily.split(',')[0].replace(/['"]/g, '').trim();

  const rows = [
    { label: 'color',      value: colorHex || s.color,         dot: colorHex || s.color },
    { label: 'background', value: bgHex    || s.backgroundColor, dot: bgHex || s.backgroundColor },
    { label: 'font',       value: fontName },
    { label: 'size',       value: `${s.fontSize}  /  ${s.fontWeight}` },
  ];

  if (s.borderRadius !== '0px') rows.push({ label: 'radius', value: s.borderRadius });
  if (s.boxShadow   !== 'none') rows.push({ label: 'shadow', value: s.boxShadow.substring(0, 38) + (s.boxShadow.length > 38 ? '…' : '') });

  for (const row of rows) {
    const tr = document.createElement('tr');

    const tdL = document.createElement('td');
    tdL.style.cssText = 'padding:2.5px 0;color:#999;font-size:10px;width:72px;vertical-align:middle';
    tdL.textContent = row.label;

    const tdV = document.createElement('td');
    tdV.style.cssText = 'padding:2.5px 0;font-size:10px;font-family:Menlo,Consolas,monospace;color:#111;word-break:break-all';

    if (row.dot) {
      const dot = document.createElement('span');
      dot.style.cssText = `display:inline-block;width:9px;height:9px;border-radius:50%;background:${row.dot};border:1px solid rgba(0,0,0,.12);margin-right:4px;vertical-align:middle;flex-shrink:0`;
      tdV.appendChild(dot);
    }
    tdV.appendChild(document.createTextNode(row.value || '—'));

    tr.append(tdL, tdV);
    table.appendChild(tr);
  }

  _inspectBody.appendChild(table);

  // Séparateur
  const sep = document.createElement('div');
  sep.style.cssText = 'border-top:1px solid #f0f0f0;margin:8px 0';
  _inspectBody.appendChild(sep);

  // Bouton "Copier CSS"
  const copyBtn = document.createElement('button');
  copyBtn.textContent = _ct('inspCopyCSS');
  copyBtn.style.cssText = [
    'width:100%', 'background:#f5f5f5', 'border:1px solid #e2e2e2',
    'border-radius:5px', 'padding:5px', 'font-size:11px',
    'font-weight:600', 'cursor:pointer', 'color:#111',
  ].join(';');

  const cssText = _buildElementCSS(s);
  copyBtn.addEventListener('click', e => {
    e.stopPropagation();
    navigator.clipboard.writeText(cssText).then(() => {
      copyBtn.textContent = _ct('inspCopied');
      copyBtn.style.color = '#16a34a';
      setTimeout(() => {
        copyBtn.textContent = _ct('inspCopyCSS');
        copyBtn.style.color = '#111';
      }, 1500);
    });
  });

  _inspectBody.appendChild(copyBtn);
}

/** Génère un bloc CSS à partir des propriétés calculées de l'élément */
function _buildElementCSS(s) {
  const props = [
    ['color',            s.color],
    ['background-color', s.backgroundColor],
    ['font-family',      s.fontFamily],
    ['font-size',        s.fontSize],
    ['font-weight',      s.fontWeight],
    ['line-height',      s.lineHeight],
    ['border-radius',    s.borderRadius],
    ['box-shadow',       s.boxShadow],
    ['padding',          s.padding],
    ['margin',           s.margin],
  ].filter(([, v]) => v && v !== 'none' && v !== 'normal' && v !== '0px');

  return props.map(([k, v]) => `  ${k}: ${v};`).join('\n');
}

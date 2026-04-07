const STORAGE_KEY = 'scripture-display';
const DEFAULTS = { fontSize: 18, lineHeight: 2.0, maxWidth: 800, font: 'serif' };
const FONTS = {
  serif:    'var(--font-serif)',
  sans:     'var(--font-sans)',
  dyslexic: '"OpenDyslexicRegular", var(--font-sans)'
};

let _dyslexicLink = null;
let _cfg = null;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_cfg));
}

function apply(pane) {
  pane.style.setProperty('--reader-font-size', `${_cfg.fontSize}px`);
  pane.style.setProperty('--reader-line-height', `${_cfg.lineHeight}`);
  pane.style.setProperty('--reader-max-width', `${_cfg.maxWidth}px`);
  pane.style.setProperty('--reader-font-family', FONTS[_cfg.font] || FONTS.serif);

  if (_cfg.font === 'dyslexic' && !_dyslexicLink) {
    _dyslexicLink = document.createElement('link');
    _dyslexicLink.rel = 'stylesheet';
    _dyslexicLink.href = 'https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic-regular.css';
    document.head.appendChild(_dyslexicLink);
  } else if (_cfg.font !== 'dyslexic' && _dyslexicLink) {
    _dyslexicLink.remove();
    _dyslexicLink = null;
  }
}

export function initDisplay($) {
  _cfg = load();
  apply($.readingPane);

  const btn = document.getElementById('display-btn');
  if (!btn) return;

  _settings.create(btn, [
    { type: 'slider', label: 'Font size', min: 14, max: 24, step: 1,
      value: _cfg.fontSize, format: v => `${v}px`,
      onChange: v => { _cfg.fontSize = Number(v); save(); apply($.readingPane); } },
    { type: 'slider', label: 'Line height', min: 1.4, max: 2.4, step: 0.1,
      value: _cfg.lineHeight, format: v => `${v}`,
      onChange: v => { _cfg.lineHeight = Number(v); save(); apply($.readingPane); } },
    { type: 'slider', label: 'Column width', min: 500, max: 900, step: 50,
      value: _cfg.maxWidth, format: v => `${v}px`,
      onChange: v => { _cfg.maxWidth = Number(v); save(); apply($.readingPane); } },
    { type: 'mode', label: 'Font', dataAttr: 'font',
      buttons: [
        { value: 'serif', label: 'Serif', active: _cfg.font === 'serif' },
        { value: 'sans', label: 'Sans', active: _cfg.font === 'sans' },
        { value: 'dyslexic', label: 'Dyslexic', active: _cfg.font === 'dyslexic' }
      ],
      onChange: val => { _cfg.font = val; save(); apply($.readingPane); } }
  ], { width: 280 });
}

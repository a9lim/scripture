const STORAGE_KEY = 'scripture-display';
const DEFAULTS = { fontSize: 18, lineHeight: 2.0, maxWidth: 800, font: 'serif' };
const FONTS = {
  serif:    'var(--font-serif)',
  sans:     'var(--font-sans)',
  dyslexic: '"OpenDyslexicRegular", var(--font-sans)'
};

let _el = null;
let _dyslexicLink = null;
let _settings = null;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
}

function apply(pane) {
  pane.style.setProperty('--reader-font-size', `${_settings.fontSize}px`);
  pane.style.setProperty('--reader-line-height', `${_settings.lineHeight}`);
  pane.style.setProperty('--reader-max-width', `${_settings.maxWidth}px`);
  pane.style.setProperty('--reader-font-family', FONTS[_settings.font] || FONTS.serif);

  if (_settings.font === 'dyslexic' && !_dyslexicLink) {
    _dyslexicLink = document.createElement('link');
    _dyslexicLink.rel = 'stylesheet';
    _dyslexicLink.href = 'https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic-regular.css';
    document.head.appendChild(_dyslexicLink);
  } else if (_settings.font !== 'dyslexic' && _dyslexicLink) {
    _dyslexicLink.remove();
    _dyslexicLink = null;
  }
}

function buildDropdown(pane) {
  const el = document.createElement('div');
  el.className = 'display-dropdown glass';
  el.hidden = true;

  el.innerHTML = `
    <div class="display-row">
      <label class="display-label">Font size</label>
      <input type="range" class="sim-slider" id="ds-fontsize" min="14" max="24" step="1" value="${_settings.fontSize}">
      <span class="display-val" id="ds-fontsize-val">${_settings.fontSize}px</span>
    </div>
    <div class="display-row">
      <label class="display-label">Line height</label>
      <input type="range" class="sim-slider" id="ds-lineheight" min="1.4" max="2.4" step="0.1" value="${_settings.lineHeight}">
      <span class="display-val" id="ds-lineheight-val">${_settings.lineHeight}</span>
    </div>
    <div class="display-row">
      <label class="display-label">Column width</label>
      <input type="range" class="sim-slider" id="ds-maxwidth" min="500" max="900" step="50" value="${_settings.maxWidth}">
      <span class="display-val" id="ds-maxwidth-val">${_settings.maxWidth}px</span>
    </div>
    <div class="display-row">
      <label class="display-label">Font</label>
      <div class="display-font-group" data-scope="font">
        <button class="mode-btn${_settings.font === 'serif' ? ' active' : ''}" data-font="serif">Serif</button>
        <button class="mode-btn${_settings.font === 'sans' ? ' active' : ''}" data-font="sans">Sans</button>
        <button class="mode-btn${_settings.font === 'dyslexic' ? ' active' : ''}" data-font="dyslexic">Dyslexic</button>
      </div>
    </div>
  `;

  _forms.bindSlider(el.querySelector('#ds-fontsize'), el.querySelector('#ds-fontsize-val'), (v) => {
    _settings.fontSize = Number(v); save(); apply(pane);
  }, (v) => `${v}px`);

  _forms.bindSlider(el.querySelector('#ds-lineheight'), el.querySelector('#ds-lineheight-val'), (v) => {
    _settings.lineHeight = Number(v); save(); apply(pane);
  }, (v) => `${v}`);

  _forms.bindSlider(el.querySelector('#ds-maxwidth'), el.querySelector('#ds-maxwidth-val'), (v) => {
    _settings.maxWidth = Number(v); save(); apply(pane);
  }, (v) => `${v}px`);

  _forms.bindModeGroup(el.querySelector('.display-font-group'), 'font', (val) => {
    _settings.font = val; save(); apply(pane);
  });

  return el;
}

export function initDisplay($) {
  _settings = load();
  apply($.readingPane);

  _el = buildDropdown($.readingPane);
  document.body.appendChild(_el);

  const btn = document.getElementById('display-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    _el.hidden = !_el.hidden;
    if (!_el.hidden) {
      const rect = btn.getBoundingClientRect();
      _el.style.top = `${rect.bottom + 4}px`;
      _el.style.right = `${window.innerWidth - rect.right}px`;
    }
  });

  document.addEventListener('click', (e) => {
    if (_el.hidden) return;
    if (e.target.closest('.display-dropdown') || e.target.closest('#display-btn')) return;
    _el.hidden = true;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !_el.hidden) _el.hidden = true;
  });
}

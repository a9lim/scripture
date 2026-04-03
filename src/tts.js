/* ===================================================================
   tts.js — Text-to-Speech via SpeechSynthesis API.
   Control bar, sequential verse reading, active-verse highlighting.
   =================================================================== */

const SVG_NS = 'http://www.w3.org/2000/svg';

let bar = null;
let speaking = false;
let paused = false;
let verseQueue = [];
let currentIndex = 0;
let rate = 1;
let selectedVoice = null;
let versesContainer = null;

/* -- SVG icon helpers ------------------------------------------------ */

function svgIcon(children) {
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('width', '16');
  el.setAttribute('height', '16');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', '2');
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  el.setAttribute('aria-hidden', 'true');
  for (const c of children) el.appendChild(c);
  return el;
}

function svgPath(d) {
  const el = document.createElementNS(SVG_NS, 'path');
  el.setAttribute('d', d);
  return el;
}

function svgLine(x1, y1, x2, y2) {
  const el = document.createElementNS(SVG_NS, 'line');
  el.setAttribute('x1', x1);
  el.setAttribute('y1', y1);
  el.setAttribute('x2', x2);
  el.setAttribute('y2', y2);
  return el;
}

function svgPolygon(points) {
  const el = document.createElementNS(SVG_NS, 'polygon');
  el.setAttribute('points', points);
  return el;
}

function svgRect(attrs) {
  const el = document.createElementNS(SVG_NS, 'rect');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function makePlayIcon() {
  return svgIcon([svgPolygon('5 3 19 12 5 21 5 3')]);
}

function makePauseIcon() {
  return svgIcon([
    svgLine('6', '4', '6', '20'),
    svgLine('18', '4', '18', '20')
  ]);
}

function makeStopIcon() {
  return svgIcon([svgRect({ x: '4', y: '4', width: '16', height: '16', rx: '2' })]);
}

/* -- Build control bar ----------------------------------------------- */

function buildBar($) {
  bar = document.createElement('div');
  bar.className = 'tts-bar glass';
  bar.hidden = true;

  // Play/Pause
  const playPauseBtn = document.createElement('button');
  playPauseBtn.className = 'tool-btn tts-play-pause';
  playPauseBtn.type = 'button';
  playPauseBtn.setAttribute('aria-label', 'Pause');
  playPauseBtn.replaceChildren(makePauseIcon());
  playPauseBtn.addEventListener('click', togglePauseTTS);

  // Stop
  const stopBtn = document.createElement('button');
  stopBtn.className = 'tool-btn tts-stop';
  stopBtn.type = 'button';
  stopBtn.setAttribute('aria-label', 'Stop');
  stopBtn.replaceChildren(makeStopIcon());
  stopBtn.addEventListener('click', stopTTS);

  // Speed label
  const speedLabel = document.createElement('span');
  speedLabel.className = 'tts-label';
  speedLabel.textContent = 'Speed';

  // Speed slider
  const speedSlider = document.createElement('input');
  speedSlider.type = 'range';
  speedSlider.className = 'sim-slider tts-speed';
  speedSlider.min = '0.5';
  speedSlider.max = '2';
  speedSlider.step = '0.1';
  speedSlider.value = '1';
  speedSlider.setAttribute('aria-label', 'Speech rate');

  // Speed value display
  const speedVal = document.createElement('span');
  speedVal.className = 'tts-val';
  speedVal.textContent = '1.0x';

  _forms.bindSlider(speedSlider, speedVal, (v) => {
    rate = parseFloat(v);
  }, (v) => `${parseFloat(v).toFixed(1)}x`);

  // Voice selector
  const voiceSelect = document.createElement('select');
  voiceSelect.className = 'sim-select tts-voice-select';
  voiceSelect.setAttribute('aria-label', 'Voice');

  function populateVoices() {
    const voices = speechSynthesis.getVoices();
    const english = voices.filter(v => v.lang.startsWith('en'));
    voiceSelect.replaceChildren();
    for (const v of english) {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      opt.textContent = `${v.name} (${v.lang})`;
      voiceSelect.appendChild(opt);
    }
    if (english.length > 0 && !selectedVoice) {
      selectedVoice = english[0];
    }
  }

  populateVoices();
  if (typeof speechSynthesis.onvoiceschanged !== 'undefined') {
    speechSynthesis.onvoiceschanged = populateVoices;
  }

  voiceSelect.addEventListener('change', () => {
    const voices = speechSynthesis.getVoices();
    selectedVoice = voices.find(v => v.voiceURI === voiceSelect.value) || null;
  });

  bar.append(playPauseBtn, stopBtn, speedLabel, speedSlider, speedVal, voiceSelect);
  $.toolbar.after(bar);
}

/* -- Verse collection ------------------------------------------------ */

function collectVerses(container) {
  const rows = container.querySelectorAll('.verse-row');
  const result = [];
  for (const row of rows) {
    const verseEl = row.querySelector('.verse');
    const numEl = row.querySelector('.verse-num');
    if (!verseEl) continue;
    const num = numEl ? parseInt(numEl.dataset.verse, 10) : null;
    result.push({ text: verseEl.textContent.trim(), row, num });
  }
  return result;
}

/* -- Highlight management -------------------------------------------- */

function clearHighlight() {
  if (!versesContainer) return;
  const prev = versesContainer.querySelector('.tts-active');
  if (prev) prev.classList.remove('tts-active');
}

function highlightRow(row) {
  clearHighlight();
  if (row) {
    row.classList.add('tts-active');
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/* -- Play/Pause icon swap -------------------------------------------- */

function updatePlayPauseIcon() {
  if (!bar) return;
  const btn = bar.querySelector('.tts-play-pause');
  if (!btn) return;
  if (paused) {
    btn.replaceChildren(makePlayIcon());
    btn.setAttribute('aria-label', 'Resume');
  } else {
    btn.replaceChildren(makePauseIcon());
    btn.setAttribute('aria-label', 'Pause');
  }
}

/* -- Sequential speech ----------------------------------------------- */

function speakNext() {
  if (!speaking || currentIndex >= verseQueue.length) {
    stopTTS();
    return;
  }

  const verse = verseQueue[currentIndex];
  highlightRow(verse.row);

  const utt = new SpeechSynthesisUtterance(verse.text);
  utt.rate = rate;
  if (selectedVoice) utt.voice = selectedVoice;

  utt.onend = () => {
    currentIndex++;
    if (speaking) speakNext();
  };

  utt.onerror = (e) => {
    if (e.error === 'canceled' || e.error === 'interrupted') return;
    currentIndex++;
    if (speaking) speakNext();
  };

  speechSynthesis.speak(utt);
}

/* -- Public API ------------------------------------------------------ */

export function initTTS($) {
  if (!('speechSynthesis' in window)) return;
  buildBar($);
}

export function startTTS(container, startVerse) {
  if (!('speechSynthesis' in window)) {
    showToast('Speech synthesis not supported');
    return;
  }

  stopTTS();
  versesContainer = container;
  verseQueue = collectVerses(container);

  if (verseQueue.length === 0) {
    showToast('No verses to read');
    return;
  }

  // Find start index
  currentIndex = 0;
  if (startVerse != null) {
    const idx = verseQueue.findIndex(v => v.num === startVerse);
    if (idx !== -1) currentIndex = idx;
  }

  speaking = true;
  paused = false;
  if (bar) {
    bar.hidden = false;
    updatePlayPauseIcon();
  }

  speakNext();
}

export function stopTTS() {
  speaking = false;
  paused = false;
  speechSynthesis.cancel();
  clearHighlight();
  if (bar) {
    bar.hidden = true;
    updatePlayPauseIcon();
  }
}

export function togglePauseTTS() {
  if (!speaking) return;
  if (paused) {
    speechSynthesis.resume();
    paused = false;
  } else {
    speechSynthesis.pause();
    paused = true;
  }
  updatePlayPauseIcon();
}

export function isTTSActive() {
  return speaking;
}

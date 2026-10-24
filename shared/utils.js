/* ═══════════════════════════════════════════════
   shared/utils.js — Pure utility functions for all a9l.im sites.
   Loaded after shared/tokens.js; exposes globals consumed by
   ES6 modules and plain scripts across all four projects.
   ═══════════════════════════════════════════════ */

/**
 * Escape a string for safe insertion as HTML text content.
 * Uses the browser's own text node escaping via a cached detached element.
 * @param {string} str  Raw string
 * @returns {string} HTML-safe string
 */
var _escDiv = document.createElement('div');
function escapeHtml(str) {
    _escDiv.textContent = str;
    return _escDiv.innerHTML;
}

/**
 * @param {Function} fn  Function to debounce
 * @param {number} ms    Delay in milliseconds
 * @returns {Function}
 */
function debounce(fn, ms) {
    let t;
    return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms);
    };
}

/**
 * Leading-edge throttle: fires immediately, then suppresses for `ms`.
 * @param {Function} fn  Function to throttle
 * @param {number} ms    Minimum interval in milliseconds
 * @returns {Function}
 */
function throttle(fn, ms) {
    let last = 0;
    return function(...args) {
        const now = Date.now();
        if (now - last >= ms) {
            last = now;
            fn.apply(this, args);
        }
    };
}

/** @param {number} val @param {number} min @param {number} max @returns {number} */
function clamp(val, min, max) {
    return val < min ? min : val > max ? max : val;
}

/** @param {number} a @param {number} b @param {number} t  Interpolant [0, 1] @returns {number} */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Mulberry32 — fast 32-bit seeded PRNG. Returns a generator yielding
 * floats in [0, 1) on each call, deterministic from `seed`; miasma uses
 * it for seeded runs.
 * @param {number} seed  32-bit integer seed
 * @returns {() => number} Generator yielding floats in [0, 1)
 */
function mulberry32(seed) {
    let a = seed | 0;
    return function() {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), a | 1);
        t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Box-Muller transform: one standard-normal sample N(0, 1) from a
 * uniform generator. Clamps u1 away from 0 to avoid log(0) = -Infinity.
 * @param {() => number} [rng=Math.random]  Uniform [0, 1) generator
 * @returns {number} Standard normal sample
 */
function gaussian(rng) {
    rng = rng || Math.random;
    let u1 = rng();
    if (u1 < 1e-12) u1 = 1e-12;
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng());
}

/**
 * Return an easing function for a CSS cubic-bezier(x1, y1, x2, y2).
 * Inverts the x(u) Bezier to find the parameter u for a given time t,
 * then evaluates y(u). Uses Newton-Raphson iteration (up to 8 steps)
 * because the x->u mapping has no closed-form inverse.
 * @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2
 * @returns {(t: number) => number} Easing function mapping [0,1] -> [0,1]
 */
function cubicBezier(x1, y1, x2, y2) {
    return function(t) {
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        let u = t;
        for (let i = 0; i < 8; i++) {
            const a = 1 - u;
            // x(u) - t: residual of cubic Bezier x-component minus target time
            const xu = 3 * a * a * u * x1 + 3 * a * u * u * x2 + u * u * u - t;
            // dx/du: derivative for Newton step
            const dxu = 3 * a * a * x1 + 6 * a * u * (x2 - x1) + 3 * u * u * (1 - x2);
            if (Math.abs(dxu) < 1e-6) break; // near-zero derivative — avoid divergence
            u -= xu / dxu;
        }
        u = clamp(u, 0, 1);
        const a = 1 - u;
        return 3 * a * a * u * y1 + 3 * a * u * u * y2 + u * u * u;
    };
}

/**
 * Wire backdrop-click and close-button dismiss for a modal overlay.
 * Clicking the overlay background (not its children) or the close button
 * calls the hide function to dismiss the overlay.
 * @param {HTMLElement} overlayEl  The overlay container (backdrop).
 * @param {HTMLElement} [closeBtn] Optional close button inside the overlay.
 * @param {function} [hideFn]     Custom hide function. Default: sets overlayEl.hidden = true.
 */
function initOverlayDismiss(overlayEl, closeBtn, hideFn) {
    if (!overlayEl) return;
    var hide = hideFn || function() { overlayEl.hidden = true; };
    if (closeBtn) closeBtn.addEventListener('click', hide);
    overlayEl.addEventListener('click', function(e) {
        if (e.target === overlayEl) hide();
    });
}

/**
 * Resize a canvas buffer to match its CSS size × devicePixelRatio.
 * Only reassigns width/height when the buffer size actually changed
 * (avoids clearing the canvas on every call). Sets the 2D context
 * transform so draw calls use CSS-pixel coordinates.
 *
 * Accepts an optional `el` to measure size from (defaults to canvas itself).
 * When `syncCSS` is true, also sets canvas.style.width/height to match
 * (useful when the canvas doesn't inherit its size from CSS layout).
 *
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} [opts]
 * @param {HTMLElement} [opts.el]       Element to measure (default: canvas)
 * @param {boolean}     [opts.syncCSS]  Also set canvas.style.width/height
 * @returns {{ width: number, height: number, dpr: number, changed: boolean }}
 */
function resizeCanvasDPR(canvas, ctx, opts) {
    var el = (opts && opts.el) || canvas;
    var rect = el.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    // Hidden canvases have a 0x0 layout box. Preserve their intrinsic buffer
    // size as the CSS-pixel fallback instead of collapsing the buffer to zero;
    // callers can render safely before a hidden panel is first revealed.
    var w = Math.floor(rect.width)  || canvas.clientWidth  || canvas.width / dpr;
    var h = Math.floor(rect.height) || canvas.clientHeight || canvas.height / dpr;
    var bw = Math.round(w * dpr);
    var bh = Math.round(h * dpr);
    var changed = canvas.width !== bw || canvas.height !== bh;
    if (changed) {
        canvas.width = bw;
        canvas.height = bh;
    }
    if (opts && opts.syncCSS) {
        canvas.style.width  = w + 'px';
        canvas.style.height = h + 'px';
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: w, height: h, dpr: dpr, changed: changed };
}

/**
 * Animate an element's text content from its current value to `end`
 * over `duration` ms with quartic ease-out. Cancels any in-flight
 * animation for the same `id`.
 *
 * @param {HTMLElement} el        Target element
 * @param {number}      end       Target numeric value
 * @param {number}      duration  Animation duration in ms
 * @param {function}    [formatFn=Math.round]  Formats the interpolated value for display
 * @param {string}      id        Unique animation ID (for cancellation)
 */
var _animCounters = {};
function animateValue(el, end, duration, formatFn, id) {
    if (!el) return;
    if (formatFn === undefined) formatFn = Math.round;
    var start = el._currentVal || 0;
    if (start === end) {
        el.textContent = formatFn(end);
        el._currentVal = end;
        return;
    }
    var startTs = null;
    function step(ts) {
        if (!startTs) startTs = ts;
        var progress = Math.min((ts - startTs) / duration, 1);
        var ease = 1 - Math.pow(1 - progress, 4);
        var current = progress < 1 ? start + (end - start) * ease : end;
        el.textContent = formatFn(current);
        el._currentVal = current;
        if (progress < 1) {
            _animCounters[id] = requestAnimationFrame(step);
        } else {
            delete _animCounters[id];
        }
    }
    if (_animCounters[id]) cancelAnimationFrame(_animCounters[id]);
    _animCounters[id] = requestAnimationFrame(step);
}

/**
 * Trap keyboard focus within an overlay element.
 * @param {HTMLElement} overlayEl  The overlay container
 * @returns {Function} Cleanup function that removes the trap
 */
function trapFocus(overlayEl) {
    var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    function _handler(e) {
        if (e.key !== 'Tab') return;
        var focusable = Array.from(overlayEl.querySelectorAll(FOCUSABLE)).filter(function(el) {
            return el.offsetParent !== null;
        });
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
            if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    }
    overlayEl.addEventListener('keydown', _handler);
    return function() { overlayEl.removeEventListener('keydown', _handler); };
}

/**
 * Show a brief toast notification. Creates the container on first use.
 * Styled by `.toast` / `#toast-container` in shared/base.css.
 * @param {string} message  Text to display
 * @param {number} [duration=2000]  Visible time in ms before fade-out
 */
/**
 * Cycle active tab forward or backward.
 * All sim projects use [/] keys for this — extracted to shared utility.
 * @param {number} dir  +1 for next, -1 for previous
 */
function cycleTab(dir) {
    var btns = document.querySelectorAll('.tab-btn');
    var idx = 0;
    btns.forEach(function(b, i) { if (b.classList.contains('active')) idx = i; });
    var next = (idx + dir + btns.length) % btns.length;
    btns[next].click();
}

/**
 * Set mobile-specific hint text on an element.
 * Only runs on coarse-pointer (touch) devices.
 * @param {string} elementId   ID of the hint element
 * @param {string} text        Touch-specific hint text
 * @param {string} [fallback]  Fallback CSS selector if ID not found
 */
function setMobileHint(elementId, text, fallback) {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    var el = document.getElementById(elementId);
    if (!el && fallback) el = document.querySelector(fallback);
    if (el) el.textContent = text;
}

/**
 * Wire a mode toggle button with consistent aria attributes.
 * @param {HTMLElement} btn        The toggle button
 * @param {function}    getState   Returns current boolean state
 * @param {function}    setState   Sets new boolean state
 * @param {string}      labelOff   Aria-label when off
 * @param {string}      labelOn    Aria-label when on
 * @param {function}    [onToggle] Called with new state after toggle
 */
function bindModeToggle(btn, getState, setState, labelOff, labelOn, onToggle) {
    if (!btn) return;
    function update() {
        var s = getState();
        btn.setAttribute('aria-pressed', String(s));
        btn.setAttribute('aria-label', s ? labelOn : labelOff);
        btn.title = (s ? labelOn : labelOff) + ' (X)';
    }
    btn.addEventListener('click', function() {
        setState(!getState());
        update();
        if (onToggle) onToggle(getState());
    });
    update();
}

function showToast(message, duration) {
    if (duration === undefined) duration = 2000;
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('role', 'status');
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    // Switch to rounded-rect style if text will wrap at max-width (~460px)
    requestAnimationFrame(() => {
        if (toast.scrollHeight > toast.offsetHeight + 2 || toast.offsetWidth >= 450) {
            toast.classList.add('toast-multiline');
        }
        toast.classList.add('visible');
    });
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300); // matches CSS transition duration
    }, duration);
}

/* ═══════════════════════════════════════════════
   shared/tooltip.js — Cursor-following tooltip for
   all a9l.im sim projects. Lightweight positioned
   overlay with fade transition.

   CSS: .sim-tooltip / .sim-tooltip.visible in
   shared/base.css.
   ═══════════════════════════════════════════════ */

/**
 * Create a tooltip instance.
 *
 * @returns {{ show(cx,cy,text?), hide(), el: HTMLElement }}
 *   - show(clientX, clientY, text?) — position & reveal; sets textContent if text given
 *   - hide() — fade out
 *   - el — the DOM element for direct innerHTML / textContent manipulation
 */
function createSimTooltip() {
    var el = document.createElement('div');
    el.className = 'sim-tooltip';
    el.setAttribute('role', 'tooltip');
    document.body.appendChild(el);

    function _position(cx, cy) {
        var pad = 12;
        var left = cx + pad;
        var top = cy - 10;
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        if (left + el.offsetWidth > vw - 8) left = cx - el.offsetWidth - 8;
        if (top + el.offsetHeight > vh - 8) top = vh - 8 - el.offsetHeight;
        if (top < 8) top = 8;
        el.style.left = left + 'px';
        el.style.top = top + 'px';
    }

    return {
        el: el,
        show: function(cx, cy, text) {
            if (text !== undefined) el.textContent = text;
            _position(cx, cy);
            el.classList.add('visible');
        },
        hide: function() {
            el.classList.remove('visible');
        }
    };
}

/**
 * Bind long-press touch to show a tooltip via a project-specific hit-test.
 *
 * @param {HTMLElement} el         Element to listen on (canvas or container)
 * @param {Function}    hitTestFn  (clientX, clientY) => { text, screenX, screenY } | null
 * @param {{ show, hide, el: HTMLElement }} tooltip  Tooltip instance from createSimTooltip()
 * @returns {Function} Cleanup function
 */
function bindTooltipTouch(el, hitTestFn, tooltip) {
    var HOLD_MS = 400;
    var MOVE_THRESHOLD = 8;
    var DISMISS_MS = 3000;
    var timer = null;
    var dismissTimer = null;
    var startX = 0, startY = 0;

    function clearTimers() {
        if (timer) { clearTimeout(timer); timer = null; }
        if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
    }

    function onStart(e) {
        if (e.touches.length !== 1) { clearTimers(); return; }
        var t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        clearTimers();
        timer = setTimeout(function () {
            timer = null;
            var hit = hitTestFn(t.clientX, t.clientY);
            if (hit) {
                tooltip.show(hit.screenX || t.clientX, hit.screenY || t.clientY, hit.text);
                dismissTimer = setTimeout(function () { tooltip.hide(); }, DISMISS_MS);
            }
        }, HOLD_MS);
    }

    function onMove(e) {
        if (!timer) return;
        var t = e.touches[0];
        var dx = t.clientX - startX, dy = t.clientY - startY;
        if (dx * dx + dy * dy > MOVE_THRESHOLD * MOVE_THRESHOLD) clearTimers();
    }

    function onEnd() {
        if (timer) { clearTimeout(timer); timer = null; }
    }

    function onStartDismiss(e) {
        if (tooltip.el.classList.contains('visible') && e.target !== el && !el.contains(e.target)) {
            tooltip.hide();
            if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
        }
    }

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchstart', onStartDismiss, { passive: true });

    return function () {
        el.removeEventListener('touchstart', onStart);
        el.removeEventListener('touchmove', onMove);
        el.removeEventListener('touchend', onEnd);
        document.removeEventListener('touchstart', onStartDismiss);
        clearTimers();
    };
}

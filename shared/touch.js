/* ===================================================================
   shared/touch.js — Swipe-to-dismiss for bottom-sheet panels.
   Used by the a9l.im simulation projects.
   Only active at viewport widths <= 900px where panels become
   bottom sheets instead of side panels.
   =================================================================== */

/**
 * Attach swipe-down-to-dismiss behavior to a bottom-sheet panel.
 * Dragging starts only from the sheet handle element, and only
 * permits downward movement (upward drags are ignored).
 *
 * @param {HTMLElement} panel  The panel element (must have .open class when visible)
 * @param {Object} [options]
 * @param {Function}  options.onDismiss       Called when sheet is swiped away
 * @param {string}   [options.handleSelector='.sheet-handle']  CSS selector for drag handle
 */
function initSwipeDismiss(panel, options = {}) {
    const handleSel = options.handleSelector || '.sheet-handle';
    const THRESHOLD_RATIO = 0.3;    // dismiss if dragged past 30% of panel height
    const VELOCITY_THRESHOLD = 0.5; // px/ms — fast flick dismisses even below 30%

    let startY = 0;
    let currentY = 0;
    let startTime = 0;
    let dragging = false;

    function getHandle() {
        return panel.querySelector(handleSel);
    }

    function onTouchStart(e) {
        // Only activate in mobile layout where the panel is a bottom sheet
        if (window.innerWidth > 900) return;
        if (!panel.classList.contains('open')) return;

        const handle = getHandle();
        if (!handle || !handle.contains(e.target)) return;

        dragging = true;
        startY = e.touches[0].clientY;
        currentY = startY;
        startTime = Date.now();

        // Disable CSS transition during drag for 1:1 finger tracking
        panel.style.transition = 'none';
    }

    function onTouchMove(e) {
        if (!dragging) return;

        currentY = e.touches[0].clientY;
        const dy = currentY - startY;

        if (dy < 0) {
            // Upward drag — reset transform, don't allow pulling sheet higher
            panel.style.transform = '';
            return;
        }

        panel.style.transform = 'translateY(' + dy + 'px)';
        // preventDefault stops page scroll while dragging the sheet
        e.preventDefault();
    }

    function onTouchEnd() {
        if (!dragging) return;
        dragging = false;

        const dy = currentY - startY;
        const elapsed = Date.now() - startTime;
        const velocity = elapsed > 0 ? dy / elapsed : 0;
        const panelH = panel.offsetHeight;

        // Re-enable CSS transition for snap-back or dismiss animation
        panel.style.transition = '';

        if (dy > panelH * THRESHOLD_RATIO || velocity > VELOCITY_THRESHOLD) {
            panel.style.transform = '';
            panel.classList.remove('open');
            if (typeof _haptics !== 'undefined') _haptics.trigger('light');
            if (options.onDismiss) options.onDismiss();
        } else {
            // Below threshold — snap back to open position
            panel.style.transform = '';
        }
    }

    // touchstart/end are passive — only touchmove needs preventDefault
    panel.addEventListener('touchstart', onTouchStart, { passive: true });
    panel.addEventListener('touchmove', onTouchMove, { passive: false });
    panel.addEventListener('touchend', onTouchEnd, { passive: true });
}

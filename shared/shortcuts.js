/* ═══════════════════════════════════════════════
   shared/shortcuts.js — Keyboard shortcut registry
   for the three a9l.im simulation projects.
   ═══════════════════════════════════════════════ */

/**
 * Initialize a keyboard shortcut system.
 *
 * @param {Array<Object>} shortcuts  Shortcut definitions:
 *   - key:    Key name matching KeyboardEvent.key, with optional Ctrl+/Shift+ prefix
 *   - label:  Human-readable description
 *   - group:  Category for grouping (e.g. "Simulation", "View")
 *   - action: Handler function
 *   - when:   Optional predicate — shortcut only fires if when() returns true
 * @param {Object} [opts]
 * @returns {{ destroy: Function }}
 */
function initShortcuts(shortcuts, opts) {
    if (!opts) opts = {};

    /** Normalize key strings for lookup: lowercase, no whitespace. */
    function normalizeKey(key) {
        if (key === ' ') return 'space';
        return key.toLowerCase().replace(/\s+/g, '');
    }

    /**
     * Convert a KeyboardEvent to its normalized key string.
     * Combines modifiers (ctrl/shift/alt) with the key name.
     * Uses Ctrl for both Ctrl and Meta (Cmd) for cross-platform support.
     */
    function eventToKey(e) {
        var parts = [];
        if (e.ctrlKey || e.metaKey) parts.push('ctrl');
        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');

        var key = e.key;
        if (key === ' ') key = 'space';
        else if (key === '+' || key === '=') key = e.shiftKey ? '+' : key;
        else key = key.toLowerCase();

        // Avoid "ctrl+ctrl" when only a modifier key is pressed
        if (key !== 'control' && key !== 'meta' && key !== 'shift' && key !== 'alt') {
            parts.push(key);
        }

        return parts.join('+');
    }

    /** True if focus is in a text-editable element (suppress shortcuts). */
    function isInputFocused() {
        var el = document.activeElement;
        if (!el) return false;
        var tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    var keyMap = {};
    shortcuts.forEach(function(s) {
        keyMap[normalizeKey(s.key)] = s;
    });

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            var escEntry = keyMap['escape'];
            if (escEntry && (!escEntry.when || escEntry.when())) {
                e.preventDefault();
                escEntry.action();
            }
            return;
        }

        if (isInputFocused()) return;

        var evKey = eventToKey(e);
        var entry = keyMap[normalizeKey(evKey)];
        if (entry && (!entry.when || entry.when())) {
            e.preventDefault();
            entry.action();
        }
    }

    document.addEventListener('keydown', onKeyDown);

    return {
        destroy: function() {
            document.removeEventListener('keydown', onKeyDown);
        }
    };
}

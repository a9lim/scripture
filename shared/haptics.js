/* ═══════════════════════════════════════════════
   shared/haptics.js — Haptic feedback for all a9l.im sites.
   Thin wrapper around the Web Vibration API with named presets.
   Silently no-ops on platforms without vibration support.
   Loaded as a plain <script>; exposes global _haptics.
   ═══════════════════════════════════════════════ */

var _haptics = (function () {
    var canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    var hadGesture = false;

    if (canVibrate) {
        var unlock = function () {
            hadGesture = true;
            document.removeEventListener('pointerdown', unlock, true);
        };
        document.addEventListener('pointerdown', unlock, true);
    }

    var patterns = {
        // Notification (task outcomes)
        success: [10, 60, 10],
        warning: [20, 40, 20, 40, 20],
        error:   [30, 50, 30],
        // Impact (physical interactions)
        light:   8,
        medium:  15,
        heavy:   30,
        // Selection (discrete stepping)
        selection: 5,
        // Extra
        soft:    4,
        rigid:   12,
        nudge:   10,
        buzz:    [12, 8, 12],
    };

    return {
        trigger: function (type) {
            if (canVibrate && hadGesture) navigator.vibrate(patterns[type] || patterns.medium);
        },
        patterns: patterns,
    };
})();

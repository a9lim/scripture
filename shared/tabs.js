// shared/tabs.js — Tab switching for sidebar panels.
// Loaded as a plain <script> (not a module) so tabs work even if the main module fails.
(function () {
    var btns = document.querySelectorAll('.tab-btn');
    var activeBtn = null;
    var activePanel = null;

    // Assign IDs and aria-labelledby (btn IDs use 'tabbtn-' prefix to avoid
    // colliding with panel IDs which use 'tab-' prefix)
    btns.forEach(function (btn, i) {
        if (!btn.id) btn.id = 'tabbtn-' + (btn.dataset.tab || i);
        var panel = document.getElementById('tab-' + btn.dataset.tab);
        if (panel) panel.setAttribute('aria-labelledby', btn.id);
    });

    // Find initial active state
    for (var i = 0; i < btns.length; i++) {
        if (btns[i].classList.contains('active')) { activeBtn = btns[i]; break; }
    }
    if (activeBtn) activePanel = document.getElementById('tab-' + activeBtn.dataset.tab);

    function activate(btn) {
        if (btn === activeBtn) return;
        if (activeBtn) { activeBtn.classList.remove('active'); activeBtn.setAttribute('aria-selected', 'false'); activeBtn.setAttribute('tabindex', '-1'); }
        if (activePanel) activePanel.classList.remove('active');
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        btn.setAttribute('tabindex', '0');
        btn.focus();
        if (typeof _haptics !== 'undefined') _haptics.trigger('selection');
        var target = document.getElementById('tab-' + btn.dataset.tab);
        if (target) target.classList.add('active');
        activeBtn = btn;
        activePanel = target;
    }

    // Set initial tabindex: only active tab is in tab order
    btns.forEach(function (btn) {
        btn.setAttribute('tabindex', btn === activeBtn ? '0' : '-1');
    });

    btns.forEach(function (btn) {
        btn.addEventListener('click', function () { activate(btn); });
    });

    // Arrow key navigation within tablist
    btns.forEach(function (btn, idx) {
        btn.addEventListener('keydown', function (e) {
            var target = null;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                target = btns[(idx + 1) % btns.length];
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                target = btns[(idx - 1 + btns.length) % btns.length];
            } else if (e.key === 'Home') {
                target = btns[0];
            } else if (e.key === 'End') {
                target = btns[btns.length - 1];
            }
            if (target) { e.preventDefault(); activate(target); }
        });
    });
})();

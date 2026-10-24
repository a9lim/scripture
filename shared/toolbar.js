/* ═══════════════════════════════════════════════
   shared/toolbar.js — Toolbar button utilities
   Shared across all projects for consistent toolbar controls:
   play/pause, speed, theme toggle, sidebar toggle.
   ═══════════════════════════════════════════════ */

// eslint-disable-next-line no-unused-vars
var _toolbar = (function () {
    'use strict';

    // Simulation canvases draw Greek, operators and arrows that only the STIX
    // Two fallback faces carry; start loading them before the first frame.
    if (document.body && document.body.classList.contains('sim-body') && typeof _loadTextFonts === 'function') {
        _loadTextFonts();
    }

    // ── Play / Pause ──
    // Uses _ICON from shared/icons.js (must be loaded first).
    // Safe: _ICON contains only hardcoded SVG markup, never user input.

    function updatePlayBtn(btn, playing) {
        btn.setAttribute('aria-label', playing ? 'Pause simulation' : 'Play simulation');
        btn.title = playing ? 'Pause' : 'Play';
        var markup = playing ? _ICON.pause : _ICON.play;
        btn.textContent = '';
        btn.insertAdjacentHTML('afterbegin', markup);
        btn.classList.toggle('playing', playing);
    }

    // ── Speed ──

    /**
     * Update a speed button's label and title.
     * @param {HTMLElement} btn - The speed button element (must contain a .speed-label span).
     * @param {number} speed - The current speed multiplier value.
     */
    function updateSpeedBtn(btn, speed) {
        var label = btn.querySelector('.speed-label');
        if (label) label.textContent = speed + 'x';
        btn.title = 'Speed: ' + speed + 'x';
    }

    // ── Theme ──

    /** Update <meta name="theme-color"> to match the current theme canvas color.
     *  Creates the tag if missing. Safari/iOS uses this for the status bar tint. */
    function _syncThemeColor() {
        var theme = document.documentElement.dataset.theme || 'light';
        var color = (typeof _PALETTE !== 'undefined' && _PALETTE[theme])
            ? _PALETTE[theme].canvas
            : (theme === 'dark' ? '#121111' : '#FCFCFB');
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'theme-color';
            document.head.appendChild(meta);
        }
        meta.content = color;
    }

    /**
     * Read saved theme or system preference and set data-theme on <html>.
     * Wires a system-preference change listener (only fires when no explicit save).
     * @param {string} [storageKey] - localStorage key for persistence. Omit to skip persistence.
     * @param {function} [onChange] - Called with the new theme string after any automatic change.
     */
    function initTheme(storageKey, onChange) {
        var saved = null;
        if (storageKey) {
            try { saved = localStorage.getItem(storageKey); } catch (e) { /* ignore */ }
        }
        if (saved === 'dark' || saved === 'light') {
            document.documentElement.dataset.theme = saved;
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.dataset.theme = 'dark';
        }
        _syncThemeColor();
        // Follow system preference when user hasn't made an explicit choice
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
            if (storageKey) {
                try { if (localStorage.getItem(storageKey)) return; } catch (ex) { /* ignore */ }
            }
            document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
            _syncThemeColor();
            if (onChange) onChange(document.documentElement.dataset.theme);
        });
    }

    /**
     * Toggle data-theme between light/dark and persist if storageKey given.
     * @param {string} [storageKey] - localStorage key for persistence.
     * @returns {string} The new theme ('light' or 'dark').
     */
    function toggleTheme(storageKey) {
        var html = document.documentElement;
        var next = html.dataset.theme === 'dark' ? 'light' : 'dark';
        html.dataset.theme = next;
        if (storageKey) {
            try { localStorage.setItem(storageKey, next); } catch (e) { /* ignore */ }
        }
        _syncThemeColor();
        return next;
    }

    // ── Sidebar ──

    /**
     * Toggle sidebar panel open/closed. Updates active class and aria-expanded.
     * @param {HTMLElement} toggleBtn - The sidebar toggle button.
     * @param {HTMLElement} panel - The sidebar panel element.
     * @returns {boolean} Whether the panel is now open.
     */
    function toggleSidebar(toggleBtn, panel) {
        panel.classList.toggle('open');
        var isOpen = panel.classList.contains('open');
        if (toggleBtn) {
            toggleBtn.classList.toggle('active', isOpen);
            toggleBtn.setAttribute('aria-expanded', String(isOpen));
        }
        return isOpen;
    }

    /**
     * Force-close a sidebar panel.
     * @param {HTMLElement} toggleBtn - The sidebar toggle button.
     * @param {HTMLElement} panel - The sidebar panel element.
     */
    function closeSidebar(toggleBtn, panel) {
        panel.classList.remove('open');
        if (toggleBtn) {
            toggleBtn.classList.remove('active');
            toggleBtn.setAttribute('aria-expanded', 'false');
        }
    }

    /**
     * Full sidebar setup: toggle button, close button, swipe dismiss, optional desktop auto-open.
     * @param {HTMLElement} toggleBtn - The sidebar toggle button.
     * @param {HTMLElement} panel - The sidebar panel element.
     * @param {HTMLElement} [closeBtn] - Optional close/X button inside the panel.
     * @param {Object} [opts]
     * @param {function} [opts.onToggle] - Called with isOpen boolean after any open/close.
     * @param {boolean} [opts.openOnDesktop=true] - Auto-open when viewport > 900px. Set false to disable.
     */
    function initSidebar(toggleBtn, panel, closeBtn, opts) {
        var onToggle = (opts && opts.onToggle) || null;

        toggleBtn.addEventListener('click', function () {
            var isOpen = toggleSidebar(toggleBtn, panel);
            if (typeof _haptics !== 'undefined') _haptics.trigger('light');
            if (onToggle) onToggle(isOpen);
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                closeSidebar(toggleBtn, panel);
                if (typeof _haptics !== 'undefined') _haptics.trigger('light');
                if (onToggle) onToggle(false);
            });
        }

        // Swipe-to-dismiss on mobile bottom sheet
        if (typeof initSwipeDismiss === 'function') {
            initSwipeDismiss(panel, {
                onDismiss: function () {
                    closeSidebar(toggleBtn, panel);
                    if (onToggle) onToggle(false);
                }
            });
        }

        // Auto-open on desktop (default true), animated via double-rAF
        if (!(opts && opts.openOnDesktop === false) && window.innerWidth > 900) {
            var openAnimated = function () {
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        panel.classList.add('open');
                        toggleBtn.classList.add('active');
                        toggleBtn.setAttribute('aria-expanded', 'true');
                        if (onToggle) onToggle(true);
                    });
                });
            };
            if (document.body.classList.contains('app-ready')) {
                openAnimated();
            } else {
                var obs = new MutationObserver(function (mutations) {
                    for (var i = 0; i < mutations.length; i++) {
                        if (document.body.classList.contains('app-ready')) {
                            obs.disconnect();
                            openAnimated();
                            return;
                        }
                    }
                });
                obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
            }
        }
    }

    return {
        updatePlayBtn: updatePlayBtn,
        updateSpeedBtn: updateSpeedBtn,
        initTheme: initTheme,
        toggleTheme: toggleTheme,
        toggleSidebar: toggleSidebar,
        closeSidebar: closeSidebar,
        initSidebar: initSidebar
    };
})();
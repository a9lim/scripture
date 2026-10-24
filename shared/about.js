/* ═══════════════════════════════════════════════
   shared/about.js — About / help overlay for the
   a9l.im simulation projects.
   "?" opens the panel; Escape closes it.
   ═══════════════════════════════════════════════ */

/**
 * Initialize an about/help overlay panel.
 *
 * @param {Object} config
 *   - title:       Panel heading text
 *   - description: Paragraph shown below the heading
 *   - controls:    Array of { label, value } — simulation controls section
 *   - shortcuts:   Array of { key, label, group } — keyboard shortcuts section
 *   - repo:        GitHub repo URL for the AGPL footer link
 * @returns {{ show: Function, hide: Function, destroy: Function }}
 */
function initAboutPanel(config) {
    if (!config) config = {};

    var overlayEl = null;
    var visible = false;
    var hideTimer = null;
    var _previousFocus = null;
    var _trapCleanup = null;

    /** True if focus is in a text-editable element (suppress "?" toggle). */
    function isAboutInputFocused() {
        var el = document.activeElement;
        if (!el) return false;
        var tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    /** Format a key string for human-readable display. */
    function formatKey(key) {
        if (key === ' ') return 'Space';
        return key
            .replace(/ctrl\+/i, 'Ctrl + ')
            .replace(/shift\+/i, 'Shift + ')
            .replace(/alt\+/i, 'Alt + ')
            .replace(/^space$/i, 'Space')
            .replace(/^escape$/i, 'Esc');
    }

    /** Build a close icon DOM element from _ICON. */
    function buildCloseIcon() {
        var d = document.createElement('div');
        d.insertAdjacentHTML('afterbegin', _ICON.close);
        return d.firstChild;
    }

    /** Build and cache the overlay DOM (called once). */
    function buildOverlay() {
        var overlay = document.createElement('div');
        overlay.className = 'about-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-label', config.title || 'About');
        overlay.setAttribute('aria-modal', 'true');

        // Close when clicking the backdrop (outside content)
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) hide();
        });

        var content = document.createElement('div');
        content.className = 'about-content glass';
        overlay.appendChild(content);

        // ── Header ──────────────────────────────────────────────
        var header = document.createElement('div');
        header.className = 'about-header';

        var title = document.createElement('h2');
        title.textContent = config.title || 'About';
        header.appendChild(title);

        var closeBtn = document.createElement('button');
        closeBtn.className = 'tool-btn about-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.appendChild(buildCloseIcon());
        closeBtn.addEventListener('click', hide);
        header.appendChild(closeBtn);

        content.appendChild(header);

        // ── Description + Controls section ──────────────────────
        if (config.description || (config.controls && config.controls.length)) {
            var descSection = document.createElement('div');
            descSection.className = 'about-section';

            if (config.description) {
                var desc = document.createElement('p');
                desc.className = 'about-desc';
                desc.textContent = config.description;
                descSection.appendChild(desc);
            }

            if (config.controls && config.controls.length) {
                var ctrlLabel = document.createElement('div');
                ctrlLabel.className = 'about-group-label';
                ctrlLabel.textContent = 'Controls';
                descSection.appendChild(ctrlLabel);

                config.controls.forEach(function(ctrl) {
                var row = document.createElement('div');
                row.className = 'about-row';

                var labelEl = document.createElement('span');
                labelEl.className = 'about-label';
                labelEl.textContent = ctrl.label;

                var valueEl = document.createElement('span');
                valueEl.className = 'about-value';
                valueEl.textContent = ctrl.value;

                row.appendChild(labelEl);
                row.appendChild(valueEl);
                descSection.appendChild(row);
                });
            }

            content.appendChild(descSection);
        }

        // ── Shortcuts section ─────────────────────────────────────
        if (config.shortcuts && config.shortcuts.length) {
            var shortcutSection = document.createElement('div');
            shortcutSection.className = 'about-section';

            // Group shortcuts while preserving registration order
            var groups = {};
            var groupOrder = [];
            config.shortcuts.forEach(function(s) {
                var groupKey = s.group || 'General';
                if (!groups[groupKey]) {
                    groups[groupKey] = [];
                    groupOrder.push(groupKey);
                }
                groups[groupKey].push(s);
            });

            groupOrder.forEach(function(groupKey) {
                var groupLabel = document.createElement('div');
                groupLabel.className = 'about-group-label';
                groupLabel.textContent = groupKey;
                shortcutSection.appendChild(groupLabel);

                groups[groupKey].forEach(function(s) {
                    var row = document.createElement('div');
                    row.className = 'about-row';

                    var labelEl = document.createElement('span');
                    labelEl.className = 'about-label';
                    labelEl.textContent = s.label;

                    var keyEl = document.createElement('kbd');
                    keyEl.className = 'about-key';
                    keyEl.textContent = formatKey(s.key);

                    row.appendChild(labelEl);
                    row.appendChild(keyEl);
                    shortcutSection.appendChild(row);
                });
            });

            content.appendChild(shortcutSection);
        }

        // ── Credits section ──────────────────────────────────────
        if (config.credits && config.credits.length) {
            var creditSection = document.createElement('div');
            creditSection.className = 'about-section';

            var creditLabel = document.createElement('div');
            creditLabel.className = 'about-group-label';
            creditLabel.textContent = 'Sources';
            creditSection.appendChild(creditLabel);

            config.credits.forEach(function(c) {
                var row = document.createElement('div');
                row.className = 'about-row';

                var labelEl = document.createElement('span');
                labelEl.className = 'about-label';
                labelEl.textContent = c.label;

                if (c.url) {
                    var linkEl = document.createElement('a');
                    linkEl.href = c.url;
                    linkEl.target = '_blank';
                    linkEl.rel = 'noopener noreferrer';
                    linkEl.className = 'about-value';
                    linkEl.textContent = c.value || c.url;
                    row.appendChild(labelEl);
                    row.appendChild(linkEl);
                } else {
                    var valueEl = document.createElement('span');
                    valueEl.className = 'about-value';
                    valueEl.textContent = c.value;
                    row.appendChild(labelEl);
                    row.appendChild(valueEl);
                }

                creditSection.appendChild(row);
            });

            content.appendChild(creditSection);
        }

        // ── Last Updated ──────────────────────────────────────────
        if (config.lastUpdated) {
            var dateEl = document.createElement('div');
            dateEl.className = 'about-updated';
            var timeEl = document.createElement('time');
            timeEl.setAttribute('datetime', config.lastUpdated);
            timeEl.textContent = 'Updated ' + config.lastUpdated;
            dateEl.appendChild(timeEl);
            content.appendChild(dateEl);
        }

        // ── AGPL Footer ───────────────────────────────────────────
        var footer = document.createElement('div');
        footer.className = 'about-footer';

        footer.appendChild(document.createTextNode('AGPL-3.0'));

        if (config.repo) {
            footer.appendChild(document.createTextNode(' | '));
            var githubLink = document.createElement('a');
            githubLink.href = config.repo;
            githubLink.target = '_blank';
            githubLink.rel = 'noopener noreferrer';
            githubLink.textContent = 'GitHub';
            footer.appendChild(githubLink);
        }

        content.appendChild(footer);

        return overlay;
    }

    function show() {
        if (visible) return;
        visible = true;

        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }

        if (!overlayEl) {
            overlayEl = buildOverlay();
        }

        document.body.appendChild(overlayEl);
        document.body.style.overflow = 'hidden';

        _previousFocus = document.activeElement;
        requestAnimationFrame(function() {
            var closeBtn = overlayEl.querySelector('.about-close');
            if (closeBtn) closeBtn.focus();
        });
        if (typeof trapFocus === 'function') _trapCleanup = trapFocus(overlayEl);

        // Trigger fade-in on next frame
        requestAnimationFrame(function() {
            overlayEl.classList.add('about-overlay-visible');
        });
    }

    function hide() {
        if (!visible) return;
        if (_trapCleanup) { _trapCleanup(); _trapCleanup = null; }
        if (_previousFocus) { _previousFocus.focus(); _previousFocus = null; }
        visible = false;
        document.body.style.overflow = '';

        if (overlayEl) {
            overlayEl.classList.remove('about-overlay-visible');
            hideTimer = setTimeout(function() {
                if (overlayEl && overlayEl.parentNode) {
                    overlayEl.parentNode.removeChild(overlayEl);
                }
                hideTimer = null;
            }, 200);
        }
    }

    function toggle() {
        if (visible) hide();
        else show();
    }

    // ── Keyboard handler ──────────────────────────────────────────
    function onKeyDown(e) {
        if (e.key === 'Escape') {
            if (visible) {
                e.stopPropagation();
                hide();
            }
            return;
        }

        if (e.key === '?' && !isAboutInputFocused()) {
            e.preventDefault();
            toggle();
        }
    }

    document.addEventListener('keydown', onKeyDown, { capture: true });

    // ── #about-btn click handler ──────────────────────────────────
    var aboutBtn = document.getElementById('about-btn');
    if (aboutBtn) {
        aboutBtn.addEventListener('click', toggle);
    }

    function destroy() {
        document.removeEventListener('keydown', onKeyDown, { capture: true });
        if (aboutBtn) {
            aboutBtn.removeEventListener('click', toggle);
        }
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
        if (overlayEl && overlayEl.parentNode) {
            overlayEl.parentNode.removeChild(overlayEl);
        }
        overlayEl = null;
        visible = false;
    }

    return { show: show, hide: hide, destroy: destroy };
}

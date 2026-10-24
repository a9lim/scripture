/* ═══════════════════════════════════════════════
   shared/forms.js — Form control wiring utilities
   Shared across sim projects for consistent handling of
   mode-toggle groups, range sliders, and toggle checkboxes.
   ═══════════════════════════════════════════════ */

// eslint-disable-next-line no-unused-vars
var _forms = (function () {
    'use strict';

    /**
     * Bind a mode-toggle button group with event delegation.
     * Clicks on .mode-btn children swap the .active class and call onChange.
     * Triggers 'selection' haptic automatically.
     * @param {HTMLElement} container - The container element holding .mode-btn children.
     * @param {string} dataAttr - The data-* attribute name to read from clicked button.
     * @param {function} onChange - Called with the attribute value string.
     */
    function positionIndicator(indicator, btn) {
        indicator.style.width = btn.offsetWidth + 'px';
        indicator.style.transform = 'translateX(' + (btn.offsetLeft - 3) + 'px)';
    }

    function bindModeGroup(container, dataAttr, onChange) {
        var btns = container.querySelectorAll('.mode-btn');
        var active = container.querySelector('.mode-btn.active');

        // Create sliding indicator
        var indicator = document.createElement('div');
        indicator.className = 'mode-indicator';
        container.insertBefore(indicator, container.firstChild);
        if (active) {
            // Defer positioning until container has layout (panel may start off-screen)
            indicator.style.transition = 'none';
            var ro = new ResizeObserver(function () {
                var cur = container.querySelector('.mode-btn.active');
                if (cur && cur.offsetWidth > 0) {
                    positionIndicator(indicator, cur);
                    indicator.offsetHeight; // eslint-disable-line no-unused-expressions
                    indicator.style.transition = '';
                    ro.disconnect();
                }
            });
            ro.observe(container);
        }

        btns.forEach(function(b) { b.setAttribute('aria-pressed', b === active ? 'true' : 'false'); });
        container.addEventListener('click', function (e) {
            var btn = e.target.closest('.mode-btn');
            if (!btn || btn === active) return;
            if (active) active.classList.remove('active');
            btn.classList.add('active');
            active = btn;
            positionIndicator(indicator, btn);
            btns.forEach(function(b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
            onChange(btn.dataset[dataAttr]);
            if (typeof _haptics !== 'undefined') _haptics.trigger('selection');
        });
    }

    /**
     * Bind a range slider to a value display element and callback.
     * Parses the slider value as a float, updates the display, and calls onChange.
     * @param {HTMLInputElement} slider - The range input element.
     * @param {HTMLElement} [display] - Element whose textContent is set to the formatted value.
     * @param {function} [onChange] - Called with the parsed float value.
     * @param {function} [format] - Format function (value → string). Default: toString.
     */
    function updateSliderFill(slider) {
        var min = parseFloat(slider.min) || 0;
        var max = parseFloat(slider.max) || 100;
        var val = parseFloat(slider.value);
        var pct = ((val - min) / (max - min)) * 100;
        slider.style.setProperty('--slider-fill', pct + '%');
    }

    function bindSlider(slider, display, onChange, format) {
        updateSliderFill(slider);
        slider.setAttribute('aria-valuenow', slider.value);
        slider.setAttribute('aria-valuemin', slider.min || '0');
        slider.setAttribute('aria-valuemax', slider.max || '100');
        slider.addEventListener('input', function () {
            var v = parseFloat(slider.value);
            updateSliderFill(slider);
            slider.setAttribute('aria-valuenow', slider.value);
            if (display) display.textContent = format ? format(v) : v.toString();
            if (onChange) onChange(v);
        });
    }

    /**
     * Bind a toggle checkbox to a callback.
     * Triggers 'light' haptic automatically on change.
     * @param {HTMLInputElement} checkbox - The checkbox input element.
     * @param {function} onChange - Called with the checked boolean.
     */
    function bindToggle(checkbox, onChange) {
        checkbox.addEventListener('change', function () {
            onChange(checkbox.checked);
            if (typeof _haptics !== 'undefined') _haptics.trigger('light');
        });
    }

    /**
     * Bind declarative dependencies between form controls.
     * Supports two relationship types:
     *   show — animated reveal/collapse of a target element
     *   enable — enable/disable with cascading uncheck for toggles
     *
     * @param {Array<Object>} deps - Dependency definitions, evaluated in order.
     *   { target: string|Element, show: () => boolean }   — visible when fn returns true
     *   { target: string|Element, enable: () => boolean } — enabled when fn returns true
     * @param {Object} [opts]
     * @param {function} [opts.onDisable] - Called with (element) when a checked toggle is
     *   force-unchecked by a disable dep. Use for sim-specific state sync.
     * @returns {function} updateDeps — call to re-evaluate all dependencies
     */
    function bindDeps(deps, opts) {
        opts = opts || {};

        var resolved = deps.map(function (d) {
            var el = typeof d.target === 'string' ? document.getElementById(d.target) : d.target;
            var wrap = null;

            if (d.show) {
                // Clear any pre-existing hiding so the wrapper controls visibility
                el.style.display = '';
                el.classList.remove('hidden');

                // Wrap target in a grid container for animated collapse
                wrap = document.createElement('div');
                wrap.className = 'dep-reveal dep-init';
                el.parentNode.insertBefore(wrap, el);
                wrap.appendChild(el);
            }

            return { el: el, wrap: wrap, show: d.show || null, enable: d.enable || null };
        });

        function update() {
            for (var i = 0; i < resolved.length; i++) {
                var dep = resolved[i];

                if (dep.enable) {
                    var enabled = dep.enable();
                    var disabled = !enabled;
                    dep.el.disabled = disabled;
                    var row = dep.el.closest('.ctrl-row') || dep.el.closest('.settings-dd-row') || dep.el.closest('.checkbox-label');
                    if (row) row.classList.toggle('ctrl-disabled', disabled);
                    // Cascade: uncheck disabled toggles
                    if (disabled && dep.el.type === 'checkbox' && dep.el.checked) {
                        dep.el.checked = false;
                        dep.el.setAttribute('aria-checked', 'false');
                        if (opts.onDisable) opts.onDisable(dep.el);
                    }
                }

                if (dep.show) {
                    var visible = dep.show();
                    dep.wrap.classList.toggle('dep-hidden', !visible);
                }
            }
        }

        // Set initial state without transitions
        update();

        // Enable transitions after initial layout
        requestAnimationFrame(function () {
            for (var i = 0; i < resolved.length; i++) {
                if (resolved[i].wrap) resolved[i].wrap.classList.remove('dep-init');
            }
        });

        return update;
    }

    return {
        bindModeGroup: bindModeGroup,
        bindSlider: bindSlider,
        updateSliderFill: updateSliderFill,
        bindToggle: bindToggle,
        bindDeps: bindDeps
    };
})();

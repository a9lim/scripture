/* ═══════════════════════════════════════════════
   shared/settings.js — Settings dropdown builder
   Creates a fixed-position dropdown anchored to a
   trigger button with slider/mode-group rows,
   click-outside and Escape dismiss.
   ═══════════════════════════════════════════════ */

// eslint-disable-next-line no-unused-vars
var _settings = (function () {
    'use strict';

    /**
     * Create a settings dropdown.
     * @param {HTMLElement} triggerBtn — button that toggles the dropdown
     * @param {Array} rows — row descriptors (see below)
     * @param {Object} [opts] — { width (px, default 260), className }
     *
     * Row types:
     *   { type: 'slider', label, min, max, step, value, format(v), onChange(v) }
     *   { type: 'mode',   label, dataAttr, buttons: [{ value, label, active }], onChange(val) }
     *   { type: 'toggle', label, id, checked, disabled, onChange(checked) }
     *
     * @returns {HTMLElement} the dropdown element (already appended to body)
     */
    function create(triggerBtn, rows, opts) {
        opts = opts || {};
        var dd = document.createElement('div');
        dd.className = 'settings-dd glass' + (opts.className ? ' ' + opts.className : '');
        dd.hidden = true;
        dd.style.width = (opts.width || 260) + 'px';

        rows.forEach(function (r) {
            if (r.type === 'slider') addSlider(dd, r);
            else if (r.type === 'mode') addModeGroup(dd, r);
            else if (r.type === 'toggle') addToggle(dd, r);
        });

        document.body.appendChild(dd);

        triggerBtn.addEventListener('click', function () {
            dd.hidden = !dd.hidden;
            if (!dd.hidden) position(dd, triggerBtn);
        });

        document.addEventListener('click', function (e) {
            if (dd.hidden) return;
            if (e.target.closest('.settings-dd') || e.target === triggerBtn || triggerBtn.contains(e.target)) return;
            dd.hidden = true;
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !dd.hidden) dd.hidden = true;
        });

        return dd;
    }

    function position(dd, btn) {
        var rect = btn.getBoundingClientRect();
        dd.style.top = (rect.bottom + 4) + 'px';
        dd.style.right = (window.innerWidth - rect.right) + 'px';
    }

    function addSlider(dd, r) {
        var row = document.createElement('div');
        row.className = 'settings-dd-row';

        var lbl = document.createElement('label');
        lbl.className = 'settings-dd-label';
        lbl.textContent = r.label;

        var sl = document.createElement('input');
        sl.type = 'range';
        sl.className = 'sim-slider';
        sl.min = String(r.min);
        sl.max = String(r.max);
        sl.step = String(r.step);
        sl.value = String(r.value);

        var fmt = r.format || String;
        var val = document.createElement('span');
        val.className = 'settings-dd-val';
        val.textContent = fmt(r.value);

        row.append(lbl, sl, val);
        dd.appendChild(row);

        if (typeof _forms !== 'undefined') {
            _forms.bindSlider(sl, val, r.onChange, fmt);
        } else {
            sl.addEventListener('input', function () {
                var v = parseFloat(sl.value);
                val.textContent = fmt(v);
                if (r.onChange) r.onChange(v);
            });
        }
    }

    function addModeGroup(dd, r) {
        var row = document.createElement('div');
        row.className = 'settings-dd-row';

        var lbl = document.createElement('label');
        lbl.className = 'settings-dd-label';
        lbl.textContent = r.label;

        var group = document.createElement('div');
        group.className = 'mode-toggles';
        if (r.id) group.id = r.id;
        group.setAttribute('data-scope', r.dataAttr);

        r.buttons.forEach(function (b) {
            var btn = document.createElement('button');
            btn.className = 'mode-btn' + (b.active ? ' active' : '');
            btn.setAttribute('data-' + r.dataAttr, b.value);
            btn.textContent = b.label;
            group.appendChild(btn);
        });

        row.append(lbl, group);
        dd.appendChild(row);

        if (typeof _forms !== 'undefined') {
            _forms.bindModeGroup(group, r.dataAttr, r.onChange);
        }
    }

    function addToggle(dd, r) {
        var row = document.createElement('div');
        row.className = 'settings-dd-row';

        var lbl = document.createElement('label');
        lbl.className = 'settings-dd-label';
        lbl.textContent = r.label;
        if (r.id) lbl.htmlFor = r.id;

        var wrap = document.createElement('div');
        wrap.className = 'tog-wrap';

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        if (r.id) cb.id = r.id;
        cb.checked = !!r.checked;
        if (r.disabled) cb.disabled = true;
        cb.setAttribute('role', 'switch');
        cb.setAttribute('aria-checked', String(!!r.checked));

        var togLabel = document.createElement('label');
        if (r.id) togLabel.htmlFor = r.id;
        togLabel.className = 'tog';
        var thumb = document.createElement('span');
        thumb.className = 'tog-thumb';
        togLabel.appendChild(thumb);

        wrap.append(cb, togLabel);
        row.append(lbl, wrap);
        dd.appendChild(row);

        cb.addEventListener('change', function () {
            cb.setAttribute('aria-checked', String(cb.checked));
            if (r.onChange) r.onChange(cb.checked);
        });
    }

    return { create: create };
})();

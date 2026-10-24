// shared/dropdown.js — Custom dropdown replacement for native <select>.
// Loaded as a plain <script> (not a module). Auto-enhances select.sim-select elements.
// Fires native 'change' events on the hidden <select> so existing JS works untouched.
(function () {
    function enhance(sel) {
        if (sel._customDropdown) return;
        sel._customDropdown = true;

        // Hide native select
        sel.style.position = 'absolute';
        sel.style.opacity = '0';
        sel.style.pointerEvents = 'none';
        sel.style.width = '0';
        sel.style.height = '0';
        sel.style.overflow = 'hidden';
        sel.setAttribute('tabindex', '-1');
        sel.setAttribute('aria-hidden', 'true');

        // Wrapper
        var wrap = document.createElement('div');
        wrap.className = 'sim-dropdown';
        if (sel.disabled) wrap.classList.add('disabled');
        sel.parentNode.insertBefore(wrap, sel);
        wrap.appendChild(sel);

        // Trigger button
        var trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'sim-dropdown-trigger';
        trigger.setAttribute('role', 'combobox');
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        if (sel.getAttribute('aria-label'))
            trigger.setAttribute('aria-label', sel.getAttribute('aria-label'));
        wrap.appendChild(trigger);

        // Chevron
        var chevron = document.createElement('span');
        chevron.className = 'sim-dropdown-chevron';
        chevron.textContent = '\u25BE'; // ▾
        trigger.appendChild(chevron);

        // Listbox
        var list = document.createElement('div');
        list.className = 'sim-dropdown-list';
        list.setAttribute('role', 'listbox');
        list.id = 'sdl-' + Math.random().toString(36).slice(2, 8);
        trigger.setAttribute('aria-controls', list.id);
        wrap.appendChild(list);

        var focusIdx = -1;

        function buildOptions() {
            // Clear list using DOM methods
            while (list.firstChild) list.removeChild(list.firstChild);
            var opts = sel.options;
            for (var i = 0; i < opts.length; i++) {
                var item = document.createElement('div');
                item.className = 'sim-dropdown-item';
                item.setAttribute('role', 'option');
                item.dataset.index = i;
                item.textContent = opts[i].textContent;
                if (opts[i].disabled) {
                    item.classList.add('disabled');
                    item.setAttribute('aria-disabled', 'true');
                }
                if (i === sel.selectedIndex) {
                    item.classList.add('selected');
                    item.setAttribute('aria-selected', 'true');
                }
                list.appendChild(item);
            }
            syncLabel();
        }

        function syncLabel() {
            var opt = sel.options[sel.selectedIndex];
            var label = opt ? opt.textContent : '';
            // Set text before chevron
            var text = trigger.childNodes[0];
            if (text && text.nodeType === 3) {
                text.textContent = label;
            } else {
                trigger.insertBefore(document.createTextNode(label), chevron);
            }
        }

        function open() {
            if (sel.disabled) return;
            wrap.classList.add('open');
            trigger.setAttribute('aria-expanded', 'true');
            focusIdx = sel.selectedIndex;
            scrollToFocus();
        }

        function close() {
            if (!isOpen() || wrap.classList.contains('closing')) return;
            wrap.classList.add('closing');
            trigger.setAttribute('aria-expanded', 'false');
            focusIdx = -1;
            list.addEventListener('animationend', function handler() {
                list.removeEventListener('animationend', handler);
                wrap.classList.remove('open', 'closing');
            });
        }

        function isOpen() { return wrap.classList.contains('open'); }

        function selectItem(idx) {
            if (idx < 0 || idx >= sel.options.length) return;
            if (sel.options[idx].disabled) return;
            sel.selectedIndex = idx;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            buildOptions();
            close();
        }

        function scrollToFocus() {
            var items = list.children;
            if (focusIdx >= 0 && focusIdx < items.length) {
                for (var i = 0; i < items.length; i++)
                    items[i].classList.toggle('focused', i === focusIdx);
                items[focusIdx].scrollIntoView({ block: 'nearest' });
            }
        }

        // Events
        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            if (isOpen()) close(); else open();
        });

        list.addEventListener('click', function (e) {
            var item = e.target.closest('.sim-dropdown-item');
            if (item && !item.classList.contains('disabled')) {
                selectItem(parseInt(item.dataset.index, 10));
            }
        });

        trigger.addEventListener('keydown', function (e) {
            var key = e.key;
            if (key === 'Enter' || key === ' ') {
                e.preventDefault();
                if (isOpen() && focusIdx >= 0) selectItem(focusIdx);
                else open();
            } else if (key === 'Escape') {
                close();
            } else if (key === 'ArrowDown') {
                e.preventDefault();
                if (!isOpen()) { open(); return; }
                var next = focusIdx + 1;
                while (next < sel.options.length && sel.options[next].disabled) next++;
                if (next < sel.options.length) { focusIdx = next; scrollToFocus(); }
            } else if (key === 'ArrowUp') {
                e.preventDefault();
                if (!isOpen()) { open(); return; }
                var prev = focusIdx - 1;
                while (prev >= 0 && sel.options[prev].disabled) prev--;
                if (prev >= 0) { focusIdx = prev; scrollToFocus(); }
            } else if (key === 'Home') {
                e.preventDefault();
                focusIdx = 0;
                while (focusIdx < sel.options.length && sel.options[focusIdx].disabled) focusIdx++;
                scrollToFocus();
            } else if (key === 'End') {
                e.preventDefault();
                focusIdx = sel.options.length - 1;
                while (focusIdx >= 0 && sel.options[focusIdx].disabled) focusIdx--;
                scrollToFocus();
            }
        });

        document.addEventListener('click', function (e) {
            if (isOpen() && !wrap.contains(e.target)) close();
        });

        // Watch for external changes to the native select
        var moTimer = 0;
        var mo = new MutationObserver(function () {
            clearTimeout(moTimer);
            moTimer = setTimeout(buildOptions, 0);
        });
        mo.observe(sel, { childList: true, subtree: true, attributes: true });
        sel.addEventListener('change', function () { buildOptions(); });

        buildOptions();
    }

    function init() {
        var sels = document.querySelectorAll('select.sim-select');
        for (var i = 0; i < sels.length; i++) enhance(sels[i]);
    }

    // Public API for dynamically added selects
    window._dropdown = { enhance: enhance };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

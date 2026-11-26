/* Adds a Copy button to every code block. Copies only the command lines (those starting with "curl"). */
(function () {
  'use strict';
  document.querySelectorAll('pre.code').forEach((pre) => {
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-code';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy the command');
    btn.addEventListener('click', async () => {
      const lines = pre.textContent.split('\n');
      const cmds = lines.filter((l) => l.trim().startsWith('curl'));
      try {
        await navigator.clipboard.writeText((cmds.length ? cmds : lines).join('\n').trim());
        btn.textContent = 'Copied';
        btn.dataset.done = '';
      } catch (e) {
        btn.textContent = 'Select and copy';
      }
      setTimeout(() => { btn.textContent = 'Copy'; delete btn.dataset.done; }, 1800);
    });
    wrap.appendChild(btn);
  });
})();

/* Back-to-top button: shown once the page is scrolled. */
(function () {
  'use strict';
  const btn = document.getElementById('to-top');
  if (!btn) return;
  const update = () => { btn.hidden = window.scrollY < 600; };
  window.addEventListener('scroll', update, { passive: true });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0 });
    const first = document.querySelector('main h1, #url');
    if (first) first.focus({ preventScroll: true });
  });
  update();
})();

/* Expose the top bar height so sticky elements (table header) sit right under it. */
(function () {
  'use strict';
  const bar = document.querySelector('.topbar');
  if (!bar) return;
  const set = () => document.documentElement.style.setProperty('--topbar-h', `${bar.offsetHeight}px`);
  window.addEventListener('resize', set);
  set();
})();

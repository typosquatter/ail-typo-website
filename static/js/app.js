/* typosquatting-finder front-end. Vanilla JS, talks to the existing Flask routes:
   POST /typo, GET /status/<sid>, GET /domains/<sid>, POST /stop/<sid>, GET /share/<sid>. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const cfg = window.TYPO || { share: 0, algos: [] };

  const POLL_MS = 2000;
  const SIMILAR_HIGH = 50;   // similarity score (0-100) from which a page counts as a copy
  const SIMILAR_MID = 25;

  // Flags set by the backend on a domain, in the order the old UI ranked them.
  const FLAGS = [
    { key: 'included_domain',   label: 'In your list',      group: 'mine',   title: 'Present in the include list you uploaded' },
    { key: 'ns_identified',     label: 'Your name server',  group: 'mine',   title: 'Uses one of the name servers you entered' },
    { key: 'mx_identified',     label: 'Your mail server',  group: 'mine',   title: 'Uses one of the mail servers you entered' },
    { key: 'exclude_domain',    label: 'Excluded',          group: 'known',  title: 'Present in the exclude list you uploaded' },
    { key: 'bank_domains',      label: 'Known bank',        group: 'known',  title: 'In the list of known banking websites' },
    { key: 'university_domains',label: 'University',        group: 'known',  title: 'In the list of university domains' },
    { key: 'majestic_million',  label: 'Top 100k',          group: 'known',  title: 'In the top 100,000 most visited websites (Majestic)' },
    { key: 'tranco',            label: 'Tranco top 100k',   group: 'known',  title: 'In the top 100,000 of the Tranco list' },
    { key: 'moz-top500',        label: 'Moz top 500',       group: 'known',  title: 'In the top 500 of the Moz list' },
    { key: 'google_crux',       label: 'CrUX top 1M',       group: 'known',  title: 'In the top million of the Google CrUX list' },
    { key: 'parking_domains',   label: 'Parked',            group: 'parked', title: 'Hosted on a known domain parking service' },
    { key: 'CatchAll',          label: 'Catch-all mail',    group: 'other',  title: 'Accepts mail for any address' },
  ];

  const FILTERS = [
    { id: 'all',     label: 'All',                test: () => true },
    { id: 'similar', label: 'Look like your site', test: (r) => r.score !== null && r.score >= SIMILAR_HIGH },
    { id: 'unknown', label: 'Unknown',            test: (r) => !r.flags.some((f) => f.group === 'known' || f.group === 'mine') },
    { id: 'mine',    label: 'Yours',              test: (r) => r.flags.some((f) => f.group === 'mine') },
    { id: 'parked',  label: 'Parked',             test: (r) => r.flags.some((f) => f.group === 'parked') },
    { id: 'known',   label: 'Known legitimate',   test: (r) => r.flags.some((f) => f.group === 'known') },
  ];

  const state = {
    run: 0,
    sid: null,
    domain: '',
    timer: null,
    started: 0,
    lastRegistered: -1,
    finished: false,
    rows: [],
    original: null,
    filter: 'all',
    text: '',
    sort: { key: null, dir: 1 },
    seen: new Map(),   // domain -> order in which it was found
    seq: 0,
    lastComplete: 0,   // last 'complete' count seen while the search ran
    stopAt: null,      // checked count when the user pressed Stop (front only, nothing saved)
  };

  /* ---------- small helpers ---------- */

  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'text') node.textContent = v;
        else if (k === 'class') node.className = v;
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    (children || []).forEach((c) => c && node.append(c));
    return node;
  }

  const fmt = (n) => Number(n || 0).toLocaleString('en-US');

  function plural(n, one, many) { return `${fmt(n)} ${n === 1 ? one : many}`; }

  function seconds(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) return plural(s, 'second', 'seconds');
    const m = Math.floor(s / 60);
    return `${plural(m, 'minute', 'minutes')} ${s % 60 ? plural(s % 60, 'second', 'seconds') : ''}`.trim();
  }

  function cleanMessage(msg) {
    msg = String(msg || 'Something went wrong. Try again in a moment.');
    return msg.includes(']') ? msg.split(']').slice(1).join(']').trim() : msg;
  }

  function number(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  // Mark the part of `variant` that differs from `original` (common prefix and suffix kept plain).
  function markedDomain(variant, original) {
    const wrap = el('span', { class: 'dom' });
    if (!original || variant === original) { wrap.textContent = variant; return wrap; }
    let p = 0;
    while (p < variant.length && p < original.length && variant[p] === original[p]) p++;
    let s = 0;
    while (s < variant.length - p && s < original.length - p &&
           variant[variant.length - 1 - s] === original[original.length - 1 - s]) s++;
    const mid = variant.slice(p, variant.length - s);
    wrap.append(variant.slice(0, p));
    if (mid) wrap.append(el('mark', { text: mid }));
    wrap.append(variant.slice(variant.length - s));
    return wrap;
  }

  /* ---------- country flags (local SVGs in /static/flags, from flag-icons, MIT) ---------- */

  const FLAG_CODES = 'ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz ca cc cd cf cg ch ci ck cl cm cn co cp cr cu cv cw cx cy cz de dg dj dk dm do dz ec ee eg eh er es et eu fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu ic id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pc pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug um un us uy uz va vc ve vg vi vn vu wf ws xk xx ye yt za zm zw'.split(' ');
  const COUNTRY_ALIASES = {
    'czech republic': 'cz', 'russian federation': 'ru', 'republic of korea': 'kr', 'korea': 'kr',
    'iran, islamic republic of': 'ir', 'viet nam': 'vn', 'hong kong sar': 'hk', 'macao': 'mo',
    'the netherlands': 'nl', 'turkey': 'tr', 'türkiye': 'tr', 'ivory coast': 'ci', 'eswatini': 'sz',
    'united states of america': 'us', 'usa': 'us', 'uk': 'gb', 'great britain': 'gb',
    'taiwan, province of china': 'tw', 'moldova, republic of': 'md', 'tanzania, united republic of': 'tz',
  };
  const countryToCode = (() => {
    const map = Object.assign({}, COUNTRY_ALIASES);
    try {
      const names = new Intl.DisplayNames(['en'], { type: 'region' });
      FLAG_CODES.forEach((c) => {
        const n = names.of(c.toUpperCase());
        if (n && n.toUpperCase() !== c.toUpperCase()) map[n.toLowerCase()] = c;
      });
    } catch (e) { /* old browser: aliases only */ }
    return (name) => map[String(name || '').trim().toLowerCase()] || null;
  })();

  function flagImg(country) {
    const code = countryToCode(country);
    if (!code) return null;
    return el('img', { class: 'flag', src: `/static/flags/${code}.svg`, alt: '', width: '16', height: '12', loading: 'lazy' });
  }

  /* ---------- options ---------- */

  const algoBoxes = () => Array.from(document.querySelectorAll('#algos input'));

  function updateOptionsCount() {
    const n = algoBoxes().filter((b) => b.checked).length;
    $('options-count').textContent = n === 0 || n === algoBoxes().length
      ? 'all algorithms'
      : plural(n, 'algorithm', 'algorithms');
    $('toggle-algos').textContent = n === algoBoxes().length ? 'Clear' : 'Select all';
  }

  $('algos').addEventListener('change', updateOptionsCount);
  $('toggle-algos').addEventListener('click', () => {
    const all = algoBoxes().every((b) => b.checked);
    algoBoxes().forEach((b) => { b.checked = !all; });
    updateOptionsCount();
  });
  $('importer_include').addEventListener('change', (e) => {
    $('importer-help').textContent = e.target.checked
      ? 'A text file with one domain per line. Matching results are marked as yours, and listed domains are always shown.'
      : 'A text file with one domain per line. Matching results are marked as excluded.';
  });

  document.querySelectorAll('[data-try]').forEach((b) => b.addEventListener('click', () => {
    $('url').value = b.dataset.try;
    start();
  }));

  /* ---------- search lifecycle ---------- */

  function setHint(msg) {
    $('form-hint').textContent = msg || '';
    $('form-hint').hidden = !msg;
  }

  function setButton(mode) {
    const b = $('scan');
    b.dataset.mode = mode;
    b.disabled = mode === 'wait';
    b.textContent = mode === 'stop' ? 'Stop' : mode === 'wait' ? 'Starting…' : 'Find look-alikes';
  }

  function resetReport(domain) {
    clearTimeout(state.timer);
    state.run += 1;
    Object.assign(state, {
      sid: null, domain, started: Date.now(), lastRegistered: -1, finished: false,
      rows: [], original: null, filter: 'all', text: '',
      seen: new Map(), seq: 0, lastComplete: 0, stopAt: null,
    });
    $('filter-text').value = '';
    document.body.classList.add('has-report');
    $('report').hidden = false;
    $('report').dataset.state = 'running';
    $('subject-caption').textContent = 'Looking for look-alikes of';
    renderSubject(domain);
    $('progress-text').textContent = 'Generating variations';
    $('progress-time').textContent = '';
    setProgress(0, 0, 0);
    ['t-total', 't-complete', 't-registered', 't-similar'].forEach((id) => { $(id).textContent = '0'; });
    $('verdict').hidden = true;
    $('actions').hidden = true;
    $('copied').hidden = true;
    $('results').hidden = true;
    $('domains-body').replaceChildren();
  }

  function renderSubject(domain) {
    const node = $('subject-domain');
    const dot = domain.indexOf('.');
    node.replaceChildren();
    if (dot > 0) {
      node.append(domain.slice(0, dot), el('span', { class: 'tld', text: domain.slice(dot) }));
    } else node.textContent = domain;
  }

  function setProgress(pct, complete, total) {
    $('progress-fill').style.width = `${pct}%`;
    $('progress-bar').setAttribute('aria-valuenow', String(pct));
    $('progress-pct').textContent = `${pct}%`;
    if (total) $('progress-text').textContent = `${fmt(complete)} of ${fmt(total)} variations checked`;
  }

  async function start() {
    const value = $('url').value.trim();
    if (!value) { setHint('Type a domain name first, for example circl.lu.'); $('url').focus(); return; }
    setHint('');

    const form = new FormData();
    form.append('url', value);
    const picked = algoBoxes().filter((b) => b.checked).map((b) => b.value);
    if (picked.length === 0 || picked.length === algoBoxes().length) form.append('runAll', 'runAll');
    else picked.forEach((a) => form.append(a, a));
    if ($('catchAll').checked) form.append('catchAll', 'catchAll');
    const file = $('importer').files[0];
    // The backend only applies NS, MX and domain lists to freshly resolved domains, not to cached ones.
    const needsFresh = Boolean($('ns_input').value.trim() || $('mx_input').value.trim() || file);
    if (!$('use_cache').checked || needsFresh) form.append('use_cache', 'use_cache');
    form.append('NS', $('ns_input').value);
    form.append('MX', $('mx_input').value);
    if (file) {
      form.append('file_1', file);
      if ($('importer_include').checked) form.append('include_mode', '1');
    }

    setButton('wait');
    let res, body;
    try {
      res = await fetch('/typo', { method: 'POST', body: form });
      body = await res.json().catch(() => ({}));
    } catch (e) {
      setButton('search');
      setHint('The server could not be reached. Check your connection and try again.');
      return;
    }
    if (res.status !== 201) {
      setButton('search');
      setHint(cleanMessage(body.message));
      return;
    }
    resetReport(value.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
    state.sid = body.id;
    // The address bar now points at this search: reloading resumes it, and it is the share link.
    history.replaceState(null, '', `/${encodeURIComponent(state.sid)}`);
    remember(state.sid, state.domain);
    setButton('stop');
    applyStatus(body, state.run);
    poll(state.run);
  }

  async function stop() {
    if (!state.sid) return;
    // The backend empties its queue on stop, so /status then reports every variation as complete.
    // Keep the real number checked so far, for display only.
    try {
      const fresh = await (await fetch(`/status/${encodeURIComponent(state.sid)}`)).json();
      if (fresh && fresh.remaining > 0) state.lastComplete = fresh.complete;
    } catch (e) { /* keep the last polled count */ }
    state.stopAt = state.lastComplete;
    $('scan').disabled = true;
    try { await fetch(`/stop/${encodeURIComponent(state.sid)}`, { method: 'POST' }); } catch (e) { /* the next poll reports the state */ }
    $('scan').disabled = false;
  }

  async function poll(run) {
    if (run !== state.run) return;
    let data;
    try {
      const res = await fetch(`/status/${encodeURIComponent(state.sid)}`);
      if (res.status === 404) { fail('This search has expired. Searches are kept for one hour.'); return; }
      data = await res.json();
    } catch (e) {
      state.timer = setTimeout(() => poll(run), POLL_MS * 2);
      return;
    }
    if (run !== state.run) return;
    await applyStatus(data, run);
    if (!state.finished) state.timer = setTimeout(() => poll(run), POLL_MS);
  }

  async function applyStatus(data, run) {
    const total = data.total || 0;
    let complete = data.complete || 0;
    if (state.stopAt !== null) complete = Math.min(complete, state.stopAt);
    else if (!state.finished) state.lastComplete = complete;
    const pct = total ? Math.round((complete / total) * 100) : 0;
    setProgress(pct, complete, total);
    $('t-total').textContent = fmt(total);
    $('t-complete').textContent = fmt(complete);
    $('t-registered').textContent = fmt(data.registered);
    $('progress-time').textContent = state.started ? seconds(Date.now() - state.started) : '';

    const done = total > 0 && data.remaining === 0;
    if (data.registered !== state.lastRegistered || done) {
      state.lastRegistered = data.registered;
      await fetchDomains(run);
    }
    if (done && run === state.run) finish(data);
  }

  async function fetchDomains(run) {
    let list;
    try {
      const res = await fetch(`/domains/${encodeURIComponent(state.sid)}`);
      if (!res.ok) return;
      list = await res.json();
    } catch (e) { return; }
    if (run !== state.run) return;

    const rows = [];
    let original = null;
    const firstLoad = state.seen.size === 0;
    (list || []).forEach((entry) => {
      Object.entries(entry || {}).forEach(([name, d]) => {
        const row = toRow(name, d || {});
        if (!state.seen.has(name)) {
          state.seen.set(name, ++state.seq);
          row.fresh = !firstLoad;
        }
        row.seq = state.seen.get(name);
        if (name === state.domain) { row.original = true; original = row; } else rows.push(row);
      });
    });
    state.original = original;
    state.rows = rows;
    $('t-similar').textContent = fmt(rows.filter(FILTERS[1].test).length);
    renderResults();
  }

  function toRow(name, d) {
    const flags = FLAGS.filter((f) => d[f.key]).map((f) =>
      f.key === 'CatchAll' && typeof d.CatchAll === 'string' ? { ...f, title: d.CatchAll } : f);
    return {
      name,
      d,
      flags,
      variation: d.variation || '',
      score: number(d.ratio),
      sim: number(d.website_sim),
      diff: number(d.ressource_diff),
      ip: (d.A || [])[0] || (d.AAAA || [])[0] || '',
      ns: (d.NS || [])[0] || '',
      mx: ((d.MX || [])[0] || '').split(' ').pop(),
      title: d.website_title || '',
    };
  }

  function finish(data) {
    state.finished = true;
    setButton('search');
    const stopped = state.stopAt !== null || (data.stopped && data.complete < data.total);
    const checked = state.stopAt !== null ? state.stopAt : data.complete;
    $('report').dataset.state = stopped ? 'stopped' : 'done';
    $('subject-caption').textContent = stopped ? 'Search stopped for' : 'Look-alikes found for';
    $('progress-text').textContent = stopped
      ? `Stopped after ${fmt(checked)} of ${fmt(data.total)} variations`
      : `${fmt(data.total)} variations checked`;
    $('progress-time').textContent = state.started && !cfg.share ? `in ${seconds(Date.now() - state.started)}` : '';
    if (!stopped) {
      setProgress(100, data.total, data.total);
      $('progress-text').textContent = `${fmt(data.total)} variations checked`;
    }
    renderVerdict(data);
    setDownloads();
    $('actions').hidden = false;
  }

  function fail(msg) {
    state.finished = true;
    clearTimeout(state.timer);
    setButton('search');
    $('report').dataset.state = 'stopped';
    $('subject-caption').textContent = 'Could not load the search for';
    $('verdict').hidden = false;
    $('verdict').dataset.tone = 'info';
    $('verdict').replaceChildren(el('strong', { text: msg }), el('p', { text: 'Run the search again to get fresh results.' }));
  }

  /* ---------- verdict ---------- */

  function warningIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('class', 'verdict-icon');
    svg.setAttribute('aria-hidden', 'true');
    const body = document.createElementNS(ns, 'path');
    body.setAttribute('class', 'icon-body');
    body.setAttribute('d', 'M24 4 L45 42 H3 Z');
    const mark = document.createElementNS(ns, 'path');
    mark.setAttribute('class', 'icon-mark');
    mark.setAttribute('d', 'M24 18 V30');
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('class', 'icon-dot');
    dot.setAttribute('cx', '24'); dot.setAttribute('cy', '36'); dot.setAttribute('r', '2.6');
    svg.append(body, mark, dot);
    return svg;
  }

  function renderVerdict(data) {
    const v = $('verdict');
    const similar = state.rows.filter(FILTERS[1].test);
    const unknown = state.rows.filter(FILTERS[2].test);
    v.hidden = false;
    v.removeAttribute('role');

    if (similar.length) {
      v.dataset.tone = 'bad';
      v.setAttribute('role', 'alert');
      const names = similar.slice(0, 3).map((r) => r.name).join(', ') + (similar.length > 3 ? ` and ${fmt(similar.length - 3)} more` : '');
      v.replaceChildren(warningIcon(), el('div', null, [
        el('strong', { text: similar.length === 1 ? 'One look-alike copies your site' : `${fmt(similar.length)} look-alikes copy your site` }),
        el('p', { class: 'verdict-lead', text: names }),
        el('p', { text: 'Their pages share most of their text and resources with yours, which is typical of phishing kits. Check them, and report the ones you do not own to the registrar, the host, or CIRCL.' }),
      ]));
      return;
    }
    if (data.registered === 0) {
      v.dataset.tone = 'ok';
      v.replaceChildren(el('strong', { text: 'No look-alike is registered' }),
        el('p', { text: 'None of the variations resolves in DNS today. This can change at any time: run the search again from time to time.' }));
      return;
    }
    v.dataset.tone = 'info';
    v.replaceChildren(
      el('strong', { text: `${plural(state.rows.length, 'look-alike is', 'look-alikes are')} registered` }),
      el('p', { text: unknown.length
        ? `${plural(unknown.length, 'is', 'are')} not on any list of known legitimate sites. A registered domain is not proof of abuse: look at who owns it and what it serves.`
        : 'All of them are on lists of known legitimate sites or match your own infrastructure.' }));
  }

  /* ---------- results table ---------- */

  function renderFilters() {
    const box = $('filters');
    box.replaceChildren();
    FILTERS.forEach((f) => {
      const n = state.rows.filter(f.test).length;
      if (f.id !== 'all' && n === 0) return;
      const b = el('button', { type: 'button', 'aria-pressed': String(state.filter === f.id) }, [
        f.label, el('span', { class: 'n', text: fmt(n) })]);
      b.addEventListener('click', () => { state.filter = f.id; renderResults(); });
      box.append(b);
    });
  }

  function sortValue(r, key) {
    switch (key) {
      case 'domain': return r.name;
      case 'ip': return r.ip ? r.ip.split(/[.:]/).map((x) => x.padStart(5, '0')).join('.') : null;
      case 'ns': return r.ns || null;
      case 'mx': return r.mx || null;
      case 'title': return r.title ? r.title.toLowerCase() : null;
      case 'ratio': return r.score;
      default: return null;
    }
  }

  function sortedRows() {
    const f = FILTERS.find((x) => x.id === state.filter) || FILTERS[0];
    const text = state.text;
    let rows = state.rows.filter(f.test).filter((r) => !text || r.name.includes(text) || r.title.toLowerCase().includes(text));
    const { key, dir } = state.sort;
    if (key) {
      rows = rows.slice().sort((a, b) => {
        const va = sortValue(a, key), vb = sortValue(b, key);
        if (va === null && vb === null) return 0;
        if (va === null) return 1;      // empty values always last
        if (vb === null) return -1;
        return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))) * dir;
      });
    } else {
      // Default: most recently found first.
      rows = rows.slice().sort((a, b) => b.seq - a.seq);
    }
    return rows;
  }

  function listCell(values, label) {
    const td = el('td', { class: 'data', 'data-label': label });
    const items = (values || []).filter(Boolean);
    if (!items.length) return td;
    td.append(el('span', { text: items[0] }));
    if (items.length > 1) {
      const det = el('details', null, [el('summary', { class: 'more', text: `${items.length - 1} more` })]);
      const ul = el('ul');
      items.slice(1).forEach((x) => ul.append(el('li', { text: x })));
      det.append(ul);
      td.append(det);
    }
    return td;
  }

  function rowNode(r) {
    const d = r.d;
    const tr = el('tr', { class: r.original ? 'is-original' : r.fresh ? 'is-fresh' : null, 'data-domain': r.name });

    const first = el('td', { 'data-label': null });
    first.append(markedDomain(r.name, state.domain));
    const meta = el('div', { class: 'dom-meta' });
    if (r.original) meta.append(el('span', { class: 'tag tag-orig', text: 'Your domain' }));
    else if (r.variation) meta.append(el('span', { text: (cfg.names || {})[r.variation] || r.variation }));
    r.flags.forEach((f) => meta.append(el('span', {
      class: `tag ${f.group === 'mine' ? 'tag-mine' : f.group === 'known' ? 'tag-known' : ''}`, text: f.label, title: f.title })));
    const copy = el('button', { type: 'button', 'aria-label': `Copy ${r.name}`, title: 'Copy' }, [el('i', { class: 'fa-regular fa-copy', 'aria-hidden': 'true' }), ' Copy']);
    copy.addEventListener('click', () => copyText(r.name, copy));
    const share = el('button', { type: 'button', title: 'Copy a link to this result' }, [el('i', { class: 'fa-solid fa-share-nodes', 'aria-hidden': 'true' }), ' Share']);
    share.addEventListener('click', () => shareRow(r.name, share));
    const open = el('a', { href: `http://${r.name}`, target: '_blank', rel: 'noopener noreferrer nofollow', title: 'Open the site in a new tab' }, [el('i', { class: 'fa-solid fa-arrow-up-right-from-square', 'aria-hidden': 'true' }), ' Open']);
    first.append(meta, el('div', { class: 'row-actions' }, [copy, share, open]));

    const ip = listCell([...(d.A || []), ...(d.AAAA || [])], 'Address');
    if (d.geoip && d.geoip !== 'Unknown') {
      // Country and flag always right under the first address, above the "n more" list.
      const geo = el('span', { class: 'geo' }, [flagImg(d.geoip), d.geoip]);
      if (ip.firstChild) ip.firstChild.after(geo); else ip.append(geo);
    }

    const ns = listCell(d.NS, 'Name server');
    const mx = listCell((d.MX || []).map((x) => String(x).split(' ').pop()), 'Mail server');
    const title = el('td', { class: 'title-cell', 'data-label': 'Page title', text: r.title });

    const score = el('td', { 'data-label': 'Similarity' });
    if (r.score !== null && !r.original) {
      const level = r.score >= SIMILAR_HIGH ? 'high' : r.score >= SIMILAR_MID ? 'mid' : 'low';
      const bar = el('span', { class: 'score-bar' }, [el('i', { style: `width:${Math.min(100, r.score)}%` })]);
      const tip = [`Score ${r.score}`, r.sim !== null ? `text ${r.sim}%` : '', r.diff !== null ? `resources ${r.diff}%` : ''].filter(Boolean).join(', ');
      score.append(el('span', { class: 'score', 'data-level': level, title: tip }, [bar, `${Math.round(r.score)}%`]));
    }
    tr.append(first, ip, ns, mx, title, score);
    return tr;
  }

  function renderResults() {
    const body = $('domains-body');
    if (!state.rows.length && !state.original) { $('results').hidden = true; return; }
    $('results').hidden = false;
    renderFilters();
    const rows = sortedRows();
    const frag = document.createDocumentFragment();
    if (state.original && state.filter === 'all' && !state.text) frag.append(rowNode(state.original));
    rows.forEach((r) => frag.append(rowNode(r)));
    body.replaceChildren(frag);
    $('no-results').hidden = rows.length > 0 || !state.rows.length;
    const focused = new URLSearchParams(location.search).get('focus');
    if (focused) highlightRow(focused, false);
    applyFocus();
    document.querySelectorAll('#domains th').forEach((th) => {
      if (th.dataset.key === state.sort.key) th.setAttribute('aria-sort', state.sort.dir > 0 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
  }

  document.querySelectorAll('#domains th[data-key] button').forEach((b) => b.addEventListener('click', () => {
    const key = b.parentElement.dataset.key;
    if (state.sort.key === key) {
      if (state.sort.dir === 1) state.sort.dir = -1; else state.sort = { key: null, dir: 1 };
    } else state.sort = { key, dir: key === 'ratio' ? -1 : 1 };
    renderResults();
  }));

  $('filter-text').addEventListener('input', (e) => { state.text = e.target.value.trim().toLowerCase(); renderResults(); });

  /* ---------- link to one result: /<sid>?focus=<domain> ---------- */

  function rowLink(name) {
    return `${location.origin}/${encodeURIComponent(state.sid)}?focus=${encodeURIComponent(name)}`;
  }

  async function shareRow(name, button) {
    const link = rowLink(name);
    history.replaceState(null, '', `/${encodeURIComponent(state.sid)}?focus=${encodeURIComponent(name)}`);
    highlightRow(name, false);
    await copyText(link, button);
  }

  function highlightRow(name, scroll) {
    document.querySelectorAll('#domains-body tr.is-focus').forEach((tr) => tr.classList.remove('is-focus'));
    const tr = Array.from(document.querySelectorAll('#domains-body tr')).find((x) => x.dataset.domain === name);
    if (!tr) return false;
    tr.classList.add('is-focus');
    if (scroll) {
      const bar = document.querySelector('.topbar');
      const head = document.querySelector('#domains thead');
      const offset = (bar ? bar.offsetHeight : 0) + (head && head.offsetParent ? head.offsetHeight : 0) + 12;
      window.scrollTo({ top: tr.getBoundingClientRect().top + window.scrollY - offset });
    }
    return true;
  }

  // Requested result from the URL, applied once it has been loaded.
  const wanted = new URLSearchParams(location.search).get('focus');
  let wantedDone = false;
  function applyFocus() {
    if (!wanted || wantedDone) return;
    if (state.filter !== 'all' || state.text) return;
    if (highlightRow(wanted, true)) wantedDone = true;
  }

  /* ---------- actions ---------- */

  function setDownloads() {
    const base = `/download/${encodeURIComponent(state.sid)}`;
    $('dl-json').href = `${base}/json`;
    $('dl-list').href = `${base}/list`;
    $('dl-misp-json').href = `${base}/misp-json`;
    $('dl-misp-feed').href = `${base}/misp-feed`;
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      if (button) {
        const label = button.lastChild;
        const old = label.textContent;
        label.textContent = ' Copied';
        setTimeout(() => { label.textContent = old; }, 1500);
      }
      return true;
    } catch (e) { return false; }
  }

  $('share').addEventListener('click', async () => {
    const link = `${location.origin}/${state.sid}`;
    const ok = await copyText(link);
    $('copied').textContent = ok ? 'Link copied, valid for one hour' : link;
    $('copied').hidden = false;
  });

  $('new-search').addEventListener('click', () => {
    clearTimeout(state.timer);
    state.run += 1;
    document.body.classList.remove('has-report');
    $('report').hidden = true;
    $('url').value = '';
    history.replaceState(null, '', '/');
    setButton('search');
    $('url').focus();
    window.scrollTo(0, 0);
  });

  document.addEventListener('click', (e) => {
    const menu = $('download-menu');
    if (menu.open && !menu.contains(e.target)) menu.open = false;
  });

  $('lookup').addEventListener('submit', (e) => {
    e.preventDefault();
    if ($('scan').dataset.mode === 'stop') stop(); else start();
  });

  /* ---------- shared link ---------- */

  // The backend only saves a search to Redis once it ends, so /share/<sid> answers 404 while it runs.
  // Remember which domain each of our own searches is for, to resume it after a reload.
  const STORE = 'typo-searches';
  function remember(sid, domain) {
    try {
      const all = JSON.parse(localStorage.getItem(STORE) || '{}');
      all[sid] = { domain, at: Date.now() };
      for (const [k, v] of Object.entries(all)) if (Date.now() - v.at > 3600e3) delete all[k];
      localStorage.setItem(STORE, JSON.stringify(all));
    } catch (e) { /* storage disabled: reload will not resume */ }
  }
  function recall(sid) {
    try { return (JSON.parse(localStorage.getItem(STORE) || '{}')[sid] || {}).domain || null; } catch (e) { return null; }
  }

  async function openShared(sid) {
    let res, text;
    try {
      res = await fetch(`/share/${encodeURIComponent(sid)}`);
      text = await res.text();
    } catch (e) { setHint('The server could not be reached. Reload the page to try again.'); return; }
    if (!res.ok) {
      // Still running? It is then only in the server's memory.
      const known = recall(sid);
      let running = false;
      try { running = known !== null && (await fetch(`/status/${encodeURIComponent(sid)}`)).ok; } catch (e) { /* offline */ }
      if (!running) {
        setHint(known
          ? 'This search is no longer available. Searches are kept for one hour: run it again below.'
          : 'This search is still running or has expired. Open the link again in a moment, or run it again below.');
        return;
      }
      text = known;
    }
    $('url').value = text;
    resetReport(text);
    state.sid = sid;
    state.started = 0;
    setButton('stop');
    poll(state.run);
  }

  setButton('search');
  updateOptionsCount();
  if (cfg.share && cfg.share !== '0' && cfg.share !== 0) {
    openShared(String(cfg.share));
  } else {
    // /?domain=circl.lu starts a new search for that domain.
    const asked = new URLSearchParams(location.search).get('domain');
    if (asked) {
      $('url').value = asked.trim().slice(0, 253);
      start();
    }
  }
})();

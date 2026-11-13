// tinta-pages: what makes a page more than its HTML. Runs once on load.
//  1. Numbers the sections (§1, §1.2), gives every heading an id and a
//     "#" link, and builds the contents (with the section in view marked).
//  2. Adds a "Comment" button to every heading when the viewer can comment
//     (the page declares capabilities: {comments: {composer_only: true}}).
//  3. Draws the charts: <figure class="t-chart" data-chart="funnel|bars">.
//  4. Enlarges screenshots on click, and lets sections settle in on load.
(() => {
  const main = document.querySelector('.t-main');
  if (!main) return;

  const slug = (text) =>
    text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section';
  const used = new Set();
  const uniqueId = (text) => {
    const base = slug(text);
    let id = base;
    for (let n = 2; used.has(id) || document.getElementById(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
  const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    for (const child of children) node.append(child);
    return node;
  };

  // 1. Headings, numbers and contents
  const entries = [];
  // Body sections are numbered §1, §2; appendices (section.t-appendix) §A, §B.
  const sections = [...main.querySelectorAll(':scope > section')];
  let body = 0;
  let appendix = 0;
  sections.forEach((section) => {
    const h2 = section.querySelector('h2');
    if (!h2) return;
    const number = section.classList.contains('t-appendix') ? String.fromCharCode(65 + appendix++) : `${++body}`;
    h2.id ||= uniqueId(h2.textContent);
    h2.dataset.tAnchored = '1';
    h2.prepend(el('span', { className: 't-sec-num', textContent: `§${number}`, ariaHidden: 'true' }));
    entries.push({ heading: h2, number: `§${number}`, sub: false, section });
    section.querySelectorAll('h3[data-toc]').forEach((h3, j) => {
      h3.id ||= uniqueId(h3.textContent);
      entries.push({ heading: h3, number: `${number}.${j + 1}`, sub: true, section });
    });
  });

  const comments = { api: null, buttons: [] };
  for (const entry of entries) {
    const { heading, section } = entry;
    const link = el('a', { className: 't-tool', href: `#${heading.id}`, textContent: '#', title: 'Link to this section', ariaLabel: `Link to ${heading.textContent}` });
    const comment = el('button', { className: 't-tool', type: 'button', textContent: 'Comment', hidden: true, title: 'Comment on this section' });
    comment.addEventListener('click', async () => {
      try {
        await comments.api?.openComposer({ element: section });
      } catch (error) {
        if (error?.code === 'unavailable' || error?.code === 'not_granted') comments.buttons.forEach((b) => (b.hidden = true));
      }
    });
    comments.buttons.push(comment);
    heading.append(el('span', { className: 't-tools' }, link, comment));
  }

  if (entries.length) {
    const list = el('ol');
    const links = new Map();
    for (const { heading, number, sub } of entries) {
      const title = [...heading.childNodes].filter((n) => !(n.classList?.contains('t-sec-num') || n.classList?.contains('t-tools'))).map((n) => n.textContent).join('').trim();
      const a = el('a', { href: `#${heading.id}` }, el('span', { className: 't-num', textContent: number }), el('span', { textContent: title }));
      links.set(heading, a);
      list.append(el('li', { className: sub ? 't-sub' : '' }, a));
    }
    const toc = el('details', { className: 't-toc' },
      el('summary', {}, el('span', { className: 't-toc-label' }, el('span', { textContent: 'Contents' }), el('span', { className: 't-chev', textContent: '▾', ariaHidden: 'true' }))),
      list);
    const wide = matchMedia('(min-width: 1080px)');
    toc.open = wide.matches;
    wide.addEventListener('change', () => (toc.open = wide.matches));
    list.addEventListener('click', () => { if (!wide.matches) toc.open = false; });
    main.before(toc);

    // Mark the heading nearest the top of the screen.
    const marks = [...links.keys()];
    const update = () => {
      let current = marks[0];
      for (const heading of marks) if (heading.getBoundingClientRect().top < 120) current = heading;
      links.forEach((a, heading) => a.setAttribute('aria-current', String(heading === current)));
    };
    addEventListener('scroll', update, { passive: true });
    update();
  }

  // 2. Comments: only if the viewer can comment here.
  const lightUpComments = () =>
    window.claude?.use?.('comments').then((api) => {
      if (!api) return;
      comments.api = api;
      comments.buttons.forEach((b) => (b.hidden = false));
    }).catch(() => {});
  if (window.claude) lightUpComments();
  else addEventListener('load', lightUpComments, { once: true });

  // 3. Charts
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  // Moves numbers {value, shown} from `from` to `to` over ~0.8 s, easing
  // out, calling draw on each frame; at once for reduced motion.
  const tween = (from, to, draw) => {
    if (still.matches || (from.value === to.value && from.shown === to.shown)) return draw(to);
    const start = performance.now();
    const frame = (now) => {
      const k = Math.min(1, (now - start) / 800);
      const e = 1 - (1 - k) ** 3;
      draw({ value: from.value + (to.value - from.value) * e, shown: from.shown + (to.shown - from.shown) * e });
      if (k < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  const fmt = (n) => n.toLocaleString('en-GB');
  const pct = (n) => (n >= 10 ? n.toFixed(0) : n.toFixed(1)) + '%';
  const parse = (fig, name, fallback) => {
    try { return JSON.parse(fig.dataset[name]); } catch { return fallback; }
  };

  // A segmented control; calls pick(value) and keeps aria-pressed right.
  const segmented = (label, options, initial, pick) => {
    const group = el('div', { className: 't-seg', role: 'group', ariaLabel: label });
    for (const option of options) {
      const button = el('button', { type: 'button', textContent: option });
      button.setAttribute('aria-pressed', String(option === initial));
      button.addEventListener('click', () => {
        group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
        pick(option);
      });
      group.append(button);
    }
    return group;
  };

  // data-chart="funnel": steps that each keep part of the one before.
  //   data-series='{"Oct 2026": [["Finished onboarding", 2173], ...], ...}'
  //   data-default="Oct 2026", data-hot="2" (first step drawn in the accent)
  // data-chart="bars": independent bars on one scale.
  //   data-series='{"All": [["Booked", 207], ["Held", 63]]}'
  const drawChart = (fig) => {
    const kind = fig.dataset.chart;
    const series = parse(fig, 'series', {});
    const names = Object.keys(series);
    if (!names.length) return;
    let name = fig.dataset.default && series[fig.dataset.default] ? fig.dataset.default : names[0];
    let base = 'first';
    const hot = Number(fig.dataset.hot ?? Infinity);
    const unit = fig.dataset.unit ?? '';

    const head = el('div', { className: 't-chart-head' }, el('span', { className: 't-chart-title', textContent: fig.dataset.title ?? '' }));
    const controls = el('div', { className: 't-seg-wrap', style: 'display:flex;flex-wrap:wrap;gap:8px' });
    if (names.length > 1) controls.append(segmented('Choose a series', names, name, (v) => { name = v; render(); }));
    if (kind === 'funnel') controls.append(segmented('Show percentages of', ['of the first', 'of the step before'], 'of the first', (v) => { base = v === 'of the first' ? 'first' : 'previous'; render(); }));
    head.append(controls);
    const rows = el('div', { className: 't-rows' });
    const detail = el('p', { className: 't-detail', ariaLive: 'polite' });
    const caption = fig.querySelector('figcaption');
    fig.replaceChildren(head, rows, detail, ...(caption ? [caption] : []));

    const describe = (data, i) => {
      const [label, value] = data[i];
      if (kind !== 'funnel') return `<strong>${label}:</strong> ${fmt(value)} ${unit}`;
      if (i === 0) return `<strong>${fmt(value)} ${unit}</strong> ${label.toLowerCase()} in ${name}. Hover or tab through the steps to see where they drop off.`;
      const before = data[i - 1][1];
      return `<strong>${fmt(value)}</strong> ${label.toLowerCase()}: ${pct((value / before) * 100)} of the step before and ${pct((value / data[0][1]) * 100)} of everyone. <strong>${fmt(before - value)}</strong> dropped off here.`;
    };

    // Each row keeps the numbers it shows, so a switch can slide the bar
    // (a CSS transition on its width) and count from the old numbers.
    const label = (value, shown, first) =>
      kind === 'funnel' && !first ? `${fmt(Math.round(value))} · ${pct(shown * 100)}` : fmt(Math.round(value));

    const render = ({ countFrom } = {}) => {
      const data = series[name];
      const max = Math.max(...data.map(([, v]) => v));
      [...rows.children].slice(data.length).forEach((row) => row.remove());
      data.forEach(([text, value], i) => {
        const share = kind === 'funnel' ? value / data[0][1] : value / max;
        const shown = kind === 'funnel' && base === 'previous' && i > 0 ? value / data[i - 1][1] : share;
        let row = rows.children[i];
        if (!row) {
          row = el('div', { className: 't-row', tabIndex: 0 },
            el('span', { className: 't-row-label' }),
            el('div', { className: 't-track' }, el('div', { className: 't-fill' }), el('span', { className: 't-val' })));
          row.addEventListener('mouseenter', () => (detail.innerHTML = row.tDescribe()));
          row.addEventListener('focus', () => (detail.innerHTML = row.tDescribe()));
          row.tNow = { value: 0, shown: 0 };
          rows.append(row);
        }
        row.querySelector('.t-row-label').textContent = text;
        row.querySelector('.t-fill').className = `t-fill${i >= hot ? ' t-hot' : ''}`;
        const val = row.querySelector('.t-val');
        val.className = `t-val ${share > 0.3 ? 't-in' : 't-out'}`;
        row.style.setProperty('--w', `${Math.max(share * 100, 0.6)}%`);
        row.style.setProperty('--i', i);
        row.tDescribe = () => describe(data, i);
        row.setAttribute('aria-label', describe(data, i).replace(/<[^>]+>/g, ''));
        // countFrom: 0 counts up from nothing, null draws at once (the first
        // render), otherwise from what the row shows now.
        const from = countFrom === 0 ? { value: 0, shown: 0 } : countFrom === null ? { value, shown } : row.tNow;
        row.tNow = { value, shown };
        tween(from, row.tNow, (n) => (val.textContent = label(n.value, n.shown, i === 0)));
      });
      detail.innerHTML = describe(data, Math.min(Number.isFinite(hot) ? hot : 0, data.length - 1));
    };
    render({ countFrom: null });

    // The first time the chart comes into view, the bars grow and the
    // numbers count up. At rest (and for reduced motion) it's fully drawn.
    if ('IntersectionObserver' in window && !still.matches) {
      const seen = new IntersectionObserver((hits) => {
        if (!hits.some((h) => h.isIntersecting)) return;
        seen.disconnect();
        fig.classList.add('t-animate');
        render({ countFrom: 0 });
        setTimeout(() => fig.classList.remove('t-animate'), 2000);
      }, { threshold: 0.35 });
      seen.observe(fig);
    }
  };
  document.querySelectorAll('.t-chart[data-chart]').forEach(drawChart);

  // Terms: a.t-term links to its glossary entry (dl.t-glossary > div[id] >
  // dt + dd) and shows the definition on hover and to screen readers.
  document.querySelectorAll('a.t-term[href^="#"]').forEach((term) => {
    const entry = document.getElementById(term.getAttribute('href').slice(1));
    const definition = entry?.querySelector('dd');
    if (!definition) return;
    definition.id ||= `${entry.id}-def`;
    term.title = definition.textContent.trim().replace(/\s+/g, ' ');
    term.setAttribute('aria-describedby', definition.id);
  });

  // 4. Screenshots enlarge on click; Escape or a click closes them.
  document.addEventListener('click', (event) => {
    const shot = event.target.closest?.('.t-shot');
    if (!shot) return;
    const box = el('div', { className: 't-lightbox', role: 'dialog', ariaLabel: shot.alt || 'Screenshot' }, el('img', { src: shot.currentSrc || shot.src, alt: shot.alt }));
    const close = () => { box.remove(); removeEventListener('keydown', onKey); shot.focus?.(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    box.addEventListener('click', close);
    addEventListener('keydown', onKey);
    document.body.append(box);
  });
  document.querySelectorAll('.t-shot').forEach((img) => { img.tabIndex = 0; img.addEventListener('keydown', (e) => { if (e.key === 'Enter') img.click(); }); });

  // Code blocks: label each with its language and highlight it when highlight.js is loaded.
  document.querySelectorAll('pre > code[class*="language-"]').forEach((code) => {
    code.parentElement.dataset.lang = code.className.match(/language-(\S+)/)[1];
    if (window.hljs) window.hljs.highlightElement(code);
  });

  // Arrival: the opening and the first sections settle in, already visible.
  [main.querySelector('.t-hero'), ...sections.slice(0, 3)].filter(Boolean).forEach((node, i) => {
    node.classList.add('t-arrive');
    node.style.setProperty('--i', i);
  });

  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
})();

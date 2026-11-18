const $ = id => document.getElementById(id);
let images = [], selected = new Set();

// Runs inside the page: collects image candidates
async function collect(autoScroll) {
  if (autoScroll) {
    let last = -1;
    for (let i = 0; i < 25; i++) {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 500));
      if (document.images.length === last && i > 1) break;
      last = document.images.length;
    }
    window.scrollTo(0, 0);
  }
  const out = [];
  const add = (u, size = 0) => { try { if (u && !u.startsWith('data:')) out.push({ url: new URL(u, location.href).href, size }); } catch {} };
  const fromSrcset = ss => (ss || '').split(',').forEach(s => {
    const [u, d] = s.trim().split(/\s+/);
    if (u) add(u, d && d.endsWith('w') ? parseInt(d) : 0);
  });
  document.querySelectorAll('img').forEach(img => { add(img.currentSrc || img.src, img.naturalWidth); fromSrcset(img.srcset); });
  document.querySelectorAll('source[srcset]').forEach(s => fromSrcset(s.srcset));
  document.querySelectorAll('*').forEach(el => {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') [...bg.matchAll(/url\(["']?(.*?)["']?\)/g)].forEach(m => add(m[1]));
  });
  document.querySelectorAll('a[href]').forEach(a => { if (/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(a.href)) add(a.href); });
  return { title: document.title, list: out };
}

// Same picture in different sizes -> one entry (keep the biggest version)
const keyOf = u => {
  const x = new URL(u);
  const path = x.pathname.replace(/\._[^/]*?_(?=\.[a-z]+$)/i, '');   // Amazon-style size suffix
  return path.length > 8 ? x.origin + path : u;
};
const sizeHint = (u, size) => {
  if (size) return size;
  const q = new URL(u).searchParams;
  return +(q.get('w') || q.get('width') || q.get('size') || 0);
};
function dedupe(list) {
  const m = new Map();
  list.forEach(({ url, size }) => {
    const k = keyOf(url), s = sizeHint(url, size), prev = m.get(k);
    if (!prev || s > prev.s) m.set(k, { url, s });
  });
  return [...m.values()].map(v => ({ url: v.url, w: 0, h: 0, type: guessType(v.url) }));
}
function guessType(u) {
  const x = new URL(u);
  const m = x.pathname.match(/\.(jpe?g|png|webp|gif|svg|avif)$/i);
  const t = m ? m[1] : (x.searchParams.get('fm') || x.searchParams.get('format') || '');
  return t.toLowerCase().replace('jpeg', 'jpg');
}
// Measure the real size of every image (so the size filter is reliable)
const measure = i => new Promise(res => {
  const im = new Image();
  im.onload = () => { i.w = im.naturalWidth; i.h = im.naturalHeight; res(); };
  im.onerror = () => { i.broken = true; res(); };
  setTimeout(res, 8000);
  im.src = i.url;
});

const clean = s => (s || 'images').trim().replace(/[\/\\:*?"<>|]/g, '_').slice(0, 60) || 'images';

function visible() {
  const min = +$('min').value, type = $('type').value;
  return images.filter(i => !i.broken && i.w && Math.min(i.w, i.h) >= min && (!type || i.type === type));
}
function render() {
  const g = $('grid'), list = visible();
  g.innerHTML = list.length ? '' : '<div class="empty">No images match the filters.</div>';
  list.forEach(i => {
    const el = document.createElement('div');
    el.className = 'it' + (selected.has(i.url) ? ' sel' : '');
    el.style.backgroundImage = `url("${i.url}")`;
    el.title = `${i.w}×${i.h} ${i.type || ''}`;
    el.innerHTML = `<small>${i.w}×${i.h}</small>`;
    el.onclick = () => { selected.has(i.url) ? selected.delete(i.url) : selected.add(i.url); render(); };
    g.appendChild(el);
  });
  [...selected].forEach(u => { if (!list.some(i => i.url === u)) selected.delete(u); });
  $('count').textContent = `${selected.size} selected · ${list.length} found`;
  $('dl').disabled = !selected.size;
}

$('scan').onclick = async () => {
  $('st').textContent = 'Scanning…';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collect, args: [$('scroll').checked] });
    images = dedupe(result.list); selected.clear();
    if (!$('folder').value) $('folder').value = clean(result.title);
    $('st').textContent = `Measuring ${images.length} images…`;
    await Promise.all(images.map(measure));
    $('st').textContent = '';
    render();
  } catch (e) { $('st').textContent = 'This page cannot be scanned (browser pages are blocked).'; }
};
$('all').onclick = () => { visible().forEach(i => selected.add(i.url)); render(); };
$('none').onclick = () => { selected.clear(); render(); };
$('min').onchange = $('type').onchange = render;

$('dl').onclick = async () => {
  const folder = clean($('folder').value);
  let n = 0;
  const used = new Set(), byUrl = Object.fromEntries(images.map(i => [i.url, i]));
  for (const url of selected) {
    let name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image').replace(/[^\w.\-]/g, '_');
    if (!/\.\w{3,4}$/.test(name)) name += '.' + (byUrl[url]?.type || 'jpg');
    let base = name, k = 1;
    while (used.has(name)) name = base.replace(/(\.\w+)$/, `_${k++}$1`);
    used.add(name);
    try { await chrome.downloads.download({ url, filename: `${folder}/${name}`, conflictAction: 'uniquify' }); n++; } catch {}
    $('st').textContent = `Downloading ${n}/${selected.size}…`;
  }
  $('st').textContent = `✓ ${n} images saved to Downloads/${folder}`;
};

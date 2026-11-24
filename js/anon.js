/* anon front end. Keys stay in this browser; the server only relays. */
import { createScene } from '/js/scene.js?v=1';
import * as S from '/js/sol.js?v=1';

const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 760px)').matches || /iphone|ipad|android/i.test(navigator.userAgent);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function toast(m, ms = 3000) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms); }
async function api(path, body) {
  const r = await fetch('/api/' + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const j = await r.json().catch(() => ({})); if (!r.ok || j.ok === false) throw new Error(j.error || ('request failed (' + r.status + ')')); return j;
}

/* ---------- the scene ---------- */
let scene = null;
const sceneReady = createScene($('#scene'), { mobile }).then(s => { scene = s; if (!s) document.body.classList.add('nogl'); onScroll(); return s; }).catch(() => null);

/* ---------- intro: the scan finds nobody, the name decodes, the lights come up on the one in front ---------- */
const intro = $('#intro');
const GLY = 'abcdefghijklmnopqrstuvwxyz0123456789';
function decode(el, fin, ms = 900) {
  const t0 = performance.now();
  const tick = now => { const k = clamp((now - t0) / ms, 0, 1); let o = ''; for (let i = 0; i < fin.length; i++) o += (k * (fin.length + 2) > i + 2) ? fin[i] : GLY[(Math.random() * GLY.length) | 0]; el.textContent = o; if (k < 1) requestAnimationFrame(tick); else el.textContent = fin; };
  requestAnimationFrame(tick);
}
let introDone = false;
function endIntro() {
  if (introDone) return; introDone = true;
  intro.classList.add('lift'); document.body.classList.remove('booting'); document.body.classList.add('go');
  try { sessionStorage.setItem('anon:intro', '1'); } catch (e) { }
  setTimeout(() => intro.remove(), 1000);
}
let seen = false; try { seen = sessionStorage.getItem('anon:intro') === '1' || /[?&]nointro\b/.test(location.search); } catch (e) { }
if (seen || reduce) { intro.remove(); introDone = true; document.body.classList.remove('booting'); document.body.classList.add('go'); }
else {
  intro.classList.add('run');
  setTimeout(() => { intro.classList.add('name'); decode($('#introMark'), 'anon', 800); }, 900);
  sceneReady.then(s => { setTimeout(() => { if (s) { s.go('intro', 'hero', 1); s.intro(); } intro.classList.add('see'); }, 1700); });
  setTimeout(endIntro, 4300);
  intro.addEventListener('click', endIntro); $('#skip').addEventListener('click', e => { e.stopPropagation(); endIntro(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') endIntro(); }, { once: true });
}

/* ---------- scroll engine ---------- */
const secs = $$('main > section[data-shot]');
function layout() { secs.forEach(s => { s._top = s.offsetTop; s._h = s.offsetHeight; }); }
const prog = el => { const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1); };
function onScroll() {
  const y = scrollY, vh = innerHeight, mid = y + vh * 0.5;
  let i = secs.findIndex(s => mid >= s._top && mid < s._top + s._h); if (i < 0) i = mid < (secs[0]._top || 0) ? 0 : secs.length - 1;
  const s = secs[i], f = clamp((mid - s._top) / Math.max(1, s._h), 0, 1), nx = secs[i + 1];
  if (scene && introDone) scene.go(s.dataset.shot, nx ? nx.dataset.shot : s.dataset.shot, clamp((f - 0.7) / 0.3, 0, 1));
  document.documentElement.style.setProperty('--veil', (s.id === 'top' ? 0.05 + 0.4 * clamp(y / vh, 0, 1) : s.id === 'end' ? 0.38 : s.id === 'app' || s.id === 'limits' ? 0.62 : 0.45).toFixed(3));
  $('#nav').classList.toggle('hide', y < vh * 0.6);
  let cur = null, best = -1e9; for (const a of $$('.links a')) { const el = document.getElementById(a.getAttribute('href').slice(1)); if (!el) continue; const t = el.getBoundingClientRect().top; if (t < vh * 0.45 && t > best) { best = t; cur = a; } }
  $$('.links a').forEach(a => a.classList.toggle('on', a === cur));
  // 01: the tape goes unknown as you scroll through it
  const pw = prog($('#watched')); feedGone = clamp((pw - 0.18) / 0.62, 0, 1); paintGone();
  // 02: the statement lights word by word
  const ps = prog($('#scan')); const ws = $$('#scrub .sw'); const lit = Math.round(clamp((ps - 0.08) / 0.75, 0, 1) * ws.length); ws.forEach((w, k) => w.classList.toggle('lit', k < lit));
  // 03: the steps slide sideways
  const ph = prog($('#how')); const tr = $('#track'); const max = Math.max(0, tr.scrollWidth - innerWidth);
  tr.style.transform = `translate3d(${(-max * clamp((ph - 0.08) / 0.84, 0, 1)).toFixed(1)}px,0,0)`; $('#hzBar').style.width = (ph * 100).toFixed(1) + '%';
  $$('#track .card').forEach(c => { const r = c.getBoundingClientRect(); c.classList.toggle('vis', r.left < innerWidth * 0.9 && r.right > innerWidth * 0.1); });
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => { layout(); onScroll(); });
try { new ResizeObserver(() => { layout(); onScroll(); }).observe(document.body); } catch (e) { }
layout();

/* reveal + word rise */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
$$('.rv').forEach(el => io.observe(el));
$$('h2:not(.endmark)').forEach(h => { let i = 0; h.innerHTML = h.textContent.split(/(\s+)/).map(t => /^\s+$/.test(t) ? t : `<span class="w" style="--i:${i++}">${esc(t)}</span>`).join(''); io.observe(h); });
$('#scrub').innerHTML = $('#scrub').textContent.split(/(\s+)/).map(t => /^\s+$/.test(t) ? t : `<span class="sw${/unknown/.test(t) ? ' key' : ''}">${esc(t)}</span>`).join('');
// the mark keeps getting scanned
if (!reduce) { let sy = -10; setInterval(() => { sy = sy > 130 ? -40 : sy + 1.6; const v = sy + '%'; $$('.mark span').forEach(s => s.style.setProperty('--scan', v)); const em = $('.endmark'); if (em) em.style.setProperty('--scan', v); }, 30); }

/* ---------- 01: the live tape, from PumpPortal's public stream ---------- */
const rowsEl = $('#rows'); let feedGone = 0; const names = new Map(); let ws = null, subs = [];
function paintGone() { const rs = $$('.rowf', rowsEl); const n = Math.round(feedGone * rs.length); rs.forEach((r, k) => r.classList.toggle('gone', k < n || feedGone > 0.97)); }
function addRow(t) {
  const c = names.get(t.mint) || {}; const sym = c.symbol ? '$' + c.symbol : short(t.mint);
  const el = document.createElement('div'); el.className = 'rowf';
  el.innerHTML = `<span class="tk">${c.image ? `<img src="${esc(c.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : esc((c.symbol || '?')[0])}</span>
    <span class="who2"><span class="real">${esc(short(t.traderPublicKey))}</span><span class="unk">unknown</span></span>
    <span class="act ${t.txType === 'sell' ? 'sell' : 'buy'}">${t.txType === 'sell' ? 'sold' : 'bought'}</span>
    <span class="amt">${(+t.solAmount || 0).toFixed(3)} SOL<span class="sym">${esc(sym)}</span></span>`;
  rowsEl.prepend(el); while (rowsEl.children.length > 9) rowsEl.lastChild.remove(); paintGone();
}
function ipfs(u) { return u && u.startsWith('ipfs://') ? 'https://ipfs.io/ipfs/' + u.slice(7) : u; }
function openFeed() {
  try { ws = new WebSocket('wss://pumpportal.fun/api/data'); } catch (e) { $('#feedState').textContent = 'offline'; return; }
  ws.onopen = () => { $('#feedState').textContent = 'every trade, as it lands'; ws.send(JSON.stringify({ method: 'subscribeNewToken' })); };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.txType === 'create' && m.mint) {
      names.set(m.mint, { symbol: m.symbol, name: m.name });
      subs.push(m.mint); if (subs.length > 40) subs = subs.slice(-40);
      ws.send(JSON.stringify({ method: 'subscribeTokenTrade', keys: [m.mint] }));
      if (m.uri) fetch(ipfs(m.uri)).then(r => r.json()).then(j => { const c = names.get(m.mint); if (c && j && j.image) c.image = ipfs(j.image); }).catch(() => { });
      if (m.traderPublicKey && m.solAmount) addRow({ ...m, txType: 'buy' });
    } else if ((m.txType === 'buy' || m.txType === 'sell') && m.traderPublicKey) addRow(m);
  };
  ws.onclose = () => { $('#feedState').textContent = 'reconnecting…'; setTimeout(openFeed, 4000); };
  ws.onerror = () => { $('#feedState').textContent = 'offline'; };
}
const feedIO = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !ws) openFeed(); }, { rootMargin: '600px' }); feedIO.observe($('#watched'));

/* ---------- wallet (Wallet Standard) ---------- */
const WS = { list: [], w: null, acct: null };
function addWallet(w) { try { if (!w || !w.name || !w.features || !w.features['standard:connect']) return; if (!(w.chains || []).some(c => String(c).startsWith('solana:'))) return; if (!w.features['solana:signAndSendTransaction'] && !w.features['solana:signTransaction']) return; if (WS.list.some(x => x.name === w.name)) return; WS.list.push(w); if (!$('#wModal').hidden) pick(); } catch (e) { } }
addEventListener('wallet-standard:register-wallet', e => { try { e.detail({ register: addWallet }); } catch (x) { } });
try { dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: { register: addWallet } })); } catch (e) { }
function pick() {
  $('#wPick').innerHTML = WS.list.length ? WS.list.map((w, i) => `<button type="button" data-i="${i}"><img src="${esc(w.icon)}" alt="">${esc(w.name)}</button>`).join('') : '<p class="hint">No Solana wallet found in this browser. Install Phantom, Solflare or Backpack.</p>';
  $$('#wPick button').forEach(b => b.onclick = async () => { const w = WS.list[+b.dataset.i]; try { const r = await w.features['standard:connect'].connect(); const a = (r && r.accounts && r.accounts[0]) || w.accounts[0]; if (!a) throw new Error('no account'); WS.w = w; WS.acct = a; $('#wModal').hidden = true; mainUI(); } catch (e) { toast(e.message || 'connect failed'); } });
}
function openPick() { pick(); $('#wModal').hidden = false; }
$('#wClose').onclick = () => $('#wModal').hidden = true;
$('#walletBtn').onclick = () => WS.acct ? scrollToApp() : openPick();
function scrollToApp() { document.getElementById('app').scrollIntoView({ behavior: 'smooth' }); }
async function mainUI() {
  const a = WS.acct; if (!a) return;
  $('#walletBtn').classList.add('on'); $('#walletLabel').textContent = short(a.address); $('#vsAddr').textContent = short(a.address);
  $('#mainBox').innerHTML = `<div class="wrow on"><span class="r"></span><span class="a">${esc(short(a.address))}<small>${esc(WS.w.name)} · your main wallet</small></span><span class="bal" id="mainBal">…</span></div><p class="hint">It only pays route deposit addresses. It never trades.</p>`;
  try { $('#mainBal').textContent = (await S.balance(a.address)).toFixed(3); } catch (e) { $('#mainBal').textContent = '—'; }
}
$('#connect2').onclick = openPick;
async function mainSend(wire) {
  const f = WS.w.features;
  if (f['solana:signAndSendTransaction']) { const [r] = await f['solana:signAndSendTransaction'].signAndSendTransaction({ transaction: wire, account: WS.acct, chain: 'solana:mainnet' }); return S.b58e(r.signature); }
  const [r] = await f['solana:signTransaction'].signTransaction({ transaction: wire, account: WS.acct, chain: 'solana:mainnet' }); const signed = r.signedTransaction; await S.send(signed);
  const n = signed[0]; return S.b58e(signed.subarray(1, 65));
}

/* ---------- anon wallets ---------- */
let wallets = S.loadWallets(); let curW = (() => { try { return localStorage.getItem('anon:cur'); } catch (e) { return null; } })();
const current = () => wallets.find(w => w.address === curW) || wallets[0] || null;
async function renderW() {
  const c = current(); if (c) curW = c.address;
  $('#wList').innerHTML = wallets.length ? wallets.map(w => `<div class="wrow${w.address === curW ? ' on' : ''}" data-a="${esc(w.address)}"><span class="r"></span><span class="a">${esc(short(w.address))}<small>${esc(w.label)}</small></span><span class="bal" data-b="${esc(w.address)}">…</span></div>`).join('') : '<div class="empty">No anon wallet yet. Make one: it is born in this browser.</div>';
  $$('#wList .wrow').forEach(r => r.onclick = () => { curW = r.dataset.a; try { localStorage.setItem('anon:cur', curW); } catch (e) { } renderW(); });
  for (const w of wallets) S.balance(w.address).then(b => { const el = $(`[data-b="${w.address}"]`); if (el) el.textContent = b.toFixed(3); }).catch(() => { const el = $(`[data-b="${w.address}"]`); if (el) el.textContent = '—'; });
}
$('#newW').onclick = () => { const w = S.newWallet(); wallets.push(w); S.saveWallets(wallets); curW = w.address; try { localStorage.setItem('anon:cur', curW); } catch (e) { } renderW(); toast('A new anon wallet, born in this browser. Back it up.'); };
$('#backupW').onclick = () => { if (!wallets.length) return toast('Nothing to back up yet'); const blob = new Blob([JSON.stringify(wallets.map(w => ({ address: w.address, secret: w.secret, label: w.label })), null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'anon-wallets.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
$('#importW').onclick = () => {
  const box = document.createElement('div'); box.className = 'inrow'; box.innerHTML = '<input placeholder="Paste a secret key (base58 or [..] array)" spellcheck="false">';
  $('#importW').parentElement.after(box); const inp = $('input', box); inp.focus();
  inp.onkeydown = e => { if (e.key !== 'Enter') return; try { const w = S.importWallet(inp.value); if (!wallets.some(x => x.address === w.address)) wallets.push(w); S.saveWallets(wallets); curW = w.address; renderW(); box.remove(); toast('Imported'); } catch (x) { toast(x.message); } };
};
renderW();

/* ---------- routes (NEAR Intents 1Click) ---------- */
let dir = 'in', quote = null;
$$('#dir button').forEach(b => b.onclick = () => { dir = b.dataset.d; $$('#dir button').forEach(x => x.classList.toggle('on', x === b)); $('#rLbl').textContent = dir === 'in' ? 'From your main wallet' : 'From the anon wallet, back to your main'; quote = null; $('#rQuote').innerHTML = ''; $('#rGo').textContent = 'Get a route'; });
function rStatus(m, cls = '') { const s = $('#rStatus'); s.className = 'status ' + cls; s.innerHTML = m; }
$('#rGo').onclick = async () => {
  const c = current(); if (!WS.acct) return openPick(); if (!c) return toast('Make an anon wallet first');
  const sol = parseFloat($('#rAmt').value); if (!(sol >= 0.005)) return toast('The smallest route is 0.005 SOL');
  const from = dir === 'in' ? WS.acct.address : c.address, to = dir === 'in' ? c.address : WS.acct.address;
  if (!quote) {
    $('#rGo').disabled = true; rStatus('Asking NEAR Intents for a route…');
    try {
      const r = await api('route', { lamports: Math.round(sol * 1e9), recipient: to, refundTo: from });
      quote = r.quote; const out = Number(quote.amountOut || 0) / 1e9;
      $('#rQuote').innerHTML = `<div class="ln"><span>You send</span><span>${sol} SOL</span></div><div class="ln"><span>Lands in ${dir === 'in' ? 'the anon wallet' : 'your main wallet'}</span><span>${out ? out.toFixed(4) : '—'} SOL</span></div><div class="ln"><span>Takes about</span><span>${quote.timeEstimate ? quote.timeEstimate + ' s' : 'a minute'}</span></div><div class="ln"><span>Deposit address</span><span>${esc(short(quote.depositAddress))}</span></div>`;
      $('#rGo').textContent = dir === 'in' ? 'Pay from main wallet' : 'Pay from anon wallet'; rStatus('The route pays from a solver\'s wallet, so the two ends are not linked on chain.');
    } catch (e) { rStatus(esc(e.message), 'err'); quote = null; }
    $('#rGo').disabled = false; return;
  }
  $('#rGo').disabled = true;
  try {
    const bh = await S.latest(); const msg = S.transferMessage(from, quote.depositAddress, Math.round(sol * 1e9), bh);
    let sig;
    if (dir === 'in') { rStatus('Confirm in your wallet…'); sig = await mainSend(S.wireUnsigned(msg)); }
    else { const signed = S.signWire(S.wireUnsigned(msg), c); sig = await S.send(signed.wire); }
    rStatus(`Deposit sent · <a href="https://solscan.io/tx/${esc(sig)}" target="_blank" rel="noopener">view</a>. Waiting for the route…`);
    api('route', { op: 'submit', txHash: sig, depositAddress: quote.depositAddress }).catch(() => { });
    const dep = quote.depositAddress; quote = null; $('#rGo').textContent = 'Get a route';
    for (let k = 0; k < 90; k++) {
      await sleep(4000); let st = null; try { st = await api('route?deposit=' + dep); } catch (e) { }
      const s = st && (st.status || (st.swapDetails && st.swapDetails.status));
      if (s === 'SUCCESS') { rStatus('Done. The SOL landed unlinked.', 'ok'); renderW(); mainUI(); break; }
      if (s === 'REFUNDED' || s === 'FAILED') { rStatus('The route ' + s.toLowerCase() + '. Any SOL goes back to where it came from.', 'err'); break; }
      if (s) rStatus(`Route: ${esc(s.toLowerCase().replace(/_/g, ' '))}…`);
    }
  } catch (e) { rStatus(esc(e.message || 'failed'), 'err'); }
  $('#rGo').disabled = false;
};

/* ---------- trade from the anon wallet (PumpPortal builds it, the anon wallet signs it here) ---------- */
let side = 'buy', coin = null;
$$('#side button').forEach(b => b.onclick = () => { side = b.dataset.s; $$('#side button').forEach(x => x.classList.toggle('on', x === b)); $('#tUnit').textContent = side === 'buy' ? 'SOL' : '%'; $('#tAmt').placeholder = side === 'buy' ? '0.05' : '100'; $('#tGo').textContent = side === 'buy' ? 'Buy unknown' : 'Sell unknown'; });
async function loadCoin(m) {
  if (!S.isAddr(m)) { $('#coinBox').innerHTML = ''; coin = null; return; }
  $('#coinBox').innerHTML = '<span class="hint">Looking it up…</span>';
  try { const r = await api('coin?mint=' + m); coin = r.coin; $('#coinBox').innerHTML = `${coin.icon ? `<img src="${esc(coin.icon)}" alt="" referrerpolicy="no-referrer">` : ''}<span><b>${esc(coin.name)} <small>$${esc(coin.symbol)}</small></b><small>${coin.mcap ? '$' + Math.round(coin.mcap).toLocaleString('en-US') + ' mcap' : ''}</small></span>`; }
  catch (e) { coin = { mint: m }; $('#coinBox').innerHTML = `<span class="hint">${esc(short(m))}: no info yet (brand new coins show up a little later). You can still trade it.</span>`; }
}
$('#mint').addEventListener('input', e => loadCoin(e.target.value.trim()));
api('trending').then(r => { $('#trend').innerHTML = r.coins.slice(0, 10).map(c => `<button class="chip" type="button" data-m="${esc(c.mint)}">${c.icon ? `<img src="${esc(c.icon)}" alt="" referrerpolicy="no-referrer">` : ''}$${esc(c.symbol)}</button>`).join(''); $$('#trend .chip').forEach(b => b.onclick = () => { $('#mint').value = b.dataset.m; loadCoin(b.dataset.m); }); }).catch(() => { });
function tStatus(m, cls = '') { const s = $('#tStatus'); s.className = 'status ' + cls; s.innerHTML = m; }
$('#tGo').onclick = async () => {
  const c = current(); if (!c) return toast('Make an anon wallet first, then route SOL into it');
  const m = $('#mint').value.trim(); if (!S.isAddr(m)) return toast('Paste a coin address');
  const v = parseFloat($('#tAmt').value || (side === 'buy' ? '0' : '100')); if (!(v > 0)) return toast('Enter an amount');
  $('#tGo').disabled = true; tStatus('Building the trade…');
  try {
    const r = await api('trade', { publicKey: c.address, action: side, mint: m, amount: side === 'buy' ? v : Math.min(100, v) + '%', slippage: 15, priorityFee: 0.0005 });
    const signed = S.signWire(S.fromB64(r.tx), c); tStatus('Signed by the anon wallet. Sending…');
    const sig = await S.send(signed.wire);
    tStatus(`Sent · <a href="https://solscan.io/tx/${esc(sig)}" target="_blank" rel="noopener">view</a>. Confirming…`);
    await S.confirm(sig); tStatus(`${side === 'buy' ? 'Bought' : 'Sold'} unknown · <a href="https://solscan.io/tx/${esc(sig)}" target="_blank" rel="noopener">view on Solscan</a>`, 'ok'); renderW(); if (scene) scene.flash();
  } catch (e) { tStatus(esc(e.message || 'failed'), 'err'); }
  $('#tGo').disabled = false;
};

/* ---------- config: the contract address appears only once it's set ---------- */
api('config').then(c => { if (c.ca) { const b = $('#caBox'); b.hidden = false; b.innerHTML = `<span>CA</span><span>${esc(c.ca)}</span><button class="mini" type="button" id="caCopy">copy</button>`; $('#caCopy').onclick = () => navigator.clipboard.writeText(c.ca).then(() => toast('Copied')); } }).catch(() => { });
onScroll();

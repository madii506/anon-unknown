// anon API: no keys, no custody, no database. The browser holds every key; this only relays what the browser can't reach
// itself under its strict CSP: Solana RPC (allowlisted methods), NEAR Intents 1Click quotes/status, PumpPortal's
// unsigned trade builder, and Jupiter's token info.
const RPCS = [process.env.RPC_URL, 'https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'].filter(Boolean);
const ALLOWED = new Set(['getLatestBlockhash', 'getBalance', 'sendTransaction', 'getSignatureStatuses', 'getTokenAccountsByOwner', 'getAccountInfo', 'simulateTransaction', 'getMinimumBalanceForRentExemption', 'getMultipleAccounts']);
const ONECLICK = 'https://1click.chaindefuser.com/v0';
const SOL_ASSET = 'nep141:sol.omft.near';
const isAddr = s => typeof s === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

async function rpc(method, params) {
  let last = null;
  for (const u of RPCS) {
    try {
      const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      if ([401, 403, 429].includes(r.status) || r.status >= 500) { last = new Error('rpc ' + r.status); continue; }
      const j = await r.json();
      if (j.error && /rate|limit|forbidden|token/i.test(j.error.message || '')) { last = new Error(j.error.message); continue; }
      return j;
    } catch (e) { last = e; }
  }
  throw last || new Error('Solana did not answer');
}
function body(req) {
  return new Promise(res => { if (req.body && typeof req.body === 'object') return res(req.body); let s = ''; req.on('data', c => s += c); req.on('end', () => { try { res(JSON.parse(s || '{}')); } catch { res({}); } }); });
}
function out(res, code, obj, cache) {
  res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', cache || 'no-store'); res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = (u.searchParams.get('__p') || '').replace(/\/+$/, '');
  try {
    if (p === 'config') return out(res, 200, { ok: true, rpc: process.env.RPC_URL ? 'private' : 'public', ca: process.env.ANON_CA || null, x: process.env.ANON_X || null });

    if (p === 'rpc') {
      const b = await body(req);
      if (!ALLOWED.has(b.method)) return out(res, 400, { ok: false, error: 'method not allowed' });
      const j = await rpc(b.method, Array.isArray(b.params) ? b.params : []);
      return out(res, 200, j);
    }

    // NEAR Intents 1Click, keyless: SOL in at one address, SOL out to another, paid by a solver
    if (p === 'route') {
      if (req.method === 'GET') {
        const dep = u.searchParams.get('deposit');
        if (!isAddr(dep)) return out(res, 400, { ok: false, error: 'bad deposit address' });
        const r = await fetch(`${ONECLICK}/status?depositAddress=${encodeURIComponent(dep)}`); const j = await r.json().catch(() => ({}));
        return out(res, r.ok ? 200 : 502, { ok: r.ok, ...j });
      }
      const b = await body(req);
      if (b.op === 'submit') {
        const r = await fetch(`${ONECLICK}/deposit/submit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ txHash: String(b.txHash || ''), depositAddress: String(b.depositAddress || '') }) });
        const j = await r.json().catch(() => ({})); return out(res, r.ok ? 200 : 502, { ok: r.ok, ...j });
      }
      const lamports = String(Math.floor(Number(b.lamports) || 0));
      if (!(Number(lamports) >= 5e6)) return out(res, 400, { ok: false, error: 'the smallest route is 0.005 SOL' });
      if (!isAddr(b.recipient) || !isAddr(b.refundTo)) return out(res, 400, { ok: false, error: 'bad wallet address' });
      const q = {
        dry: !!b.dry, swapType: 'EXACT_INPUT', slippageTolerance: 100,
        originAsset: SOL_ASSET, depositType: 'ORIGIN_CHAIN', destinationAsset: SOL_ASSET, amount: lamports,
        refundTo: b.refundTo, refundType: 'ORIGIN_CHAIN', recipient: b.recipient, recipientType: 'DESTINATION_CHAIN',
        deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(), referral: 'anon', quoteWaitingTimeMs: 3000,
      };
      const r = await fetch(`${ONECLICK}/quote`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(q) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return out(res, 502, { ok: false, error: j.message || j.error || ('route quote failed (' + r.status + ')') });
      return out(res, 200, { ok: true, quote: j.quote || j, raw: j });
    }

    // PumpPortal builds the unsigned trade for the anon wallet; the browser signs it and sends it through /rpc
    if (p === 'trade') {
      const b = await body(req);
      if (!isAddr(b.publicKey) || !isAddr(b.mint)) return out(res, 400, { ok: false, error: 'bad address' });
      const action = b.action === 'sell' ? 'sell' : 'buy';
      const t = { publicKey: b.publicKey, action, mint: b.mint, amount: b.amount, denominatedInSol: action === 'buy' ? 'true' : 'false', slippage: Math.min(50, Math.max(1, Number(b.slippage) || 15)), priorityFee: Math.min(0.01, Math.max(0.00001, Number(b.priorityFee) || 0.0005)), pool: 'auto' };
      const r = await fetch('https://pumpportal.fun/api/trade-local', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(t) });
      if (r.status !== 200) { const txt = await r.text().catch(() => ''); return out(res, 400, { ok: false, error: r.status === 400 ? 'PumpPortal could not build this trade. Fund the anon wallet first, or check the amount.' : ('trade builder said ' + r.status), detail: txt.slice(0, 200) }); }
      const buf = Buffer.from(await r.arrayBuffer());
      return out(res, 200, { ok: true, tx: buf.toString('base64') });
    }

    if (p === 'coin') {
      const m = u.searchParams.get('mint'); if (!isAddr(m)) return out(res, 400, { ok: false, error: 'bad mint' });
      const r = await fetch('https://lite-api.jup.ag/tokens/v2/search?query=' + m); const a = await r.json().catch(() => []);
      const c = (Array.isArray(a) ? a : []).find(x => x.id === m);
      if (!c) return out(res, 404, { ok: false, error: 'coin not found' });
      return out(res, 200, { ok: true, coin: { mint: c.id, name: c.name, symbol: c.symbol, icon: c.icon, usdPrice: c.usdPrice, mcap: c.mcap, decimals: c.decimals, launchpad: c.launchpad || null, holders: c.holderCount || null } }, 'public, s-maxage=20');
    }

    if (p === 'trending') {
      const r = await fetch('https://lite-api.jup.ag/tokens/v2/toptrending/1h?limit=60'); const a = await r.json().catch(() => []);
      const list = (Array.isArray(a) ? a : []).filter(c => /pump/i.test(c.launchpad || '') || /pump$/.test(c.id)).slice(0, 24)
        .map(c => ({ mint: c.id, name: c.name, symbol: c.symbol, icon: c.icon, mcap: c.mcap, usdPrice: c.usdPrice }));
      return out(res, 200, { ok: true, coins: list }, 'public, s-maxage=60, stale-while-revalidate=120');
    }

    return out(res, 404, { ok: false, error: 'not found' });
  } catch (e) { return out(res, 502, { ok: false, error: String(e && e.message || e).slice(0, 200) }); }
};

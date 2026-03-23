// supabase/functions/fetch-tokens/index.ts
// Berdasarkan docs resmi: https://docs.bags.fm/api-reference
// - /token-launch/feed → tab NEW (token baru launch)
// - /solana/bags/pools → tab BONDING (dammV2PoolKey=null) & MIGRATED (?onlyMigrated=true)
// TANPA Helius on-chain → tidak kena WORKER_LIMIT 546

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ─── Bags.fm: Token Launch Feed ───────────────────────────────────────────────
// Endpoint: GET /token-launch/feed
// Response field: status = "PRE_LAUNCH" | (launched)
async function fetchBagsFeed(apiKey: string): Promise<any[]> {
  const res = await fetch('https://public-api-v2.bags.fm/api/v1/token-launch/feed', {
    headers: { 'x-api-key': apiKey },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Bags.fm feed ${res.status}`);
  const text = await res.text();
  if (text.startsWith('<')) throw new Error('Bags.fm returned HTML — API key invalid');
  const data = JSON.parse(text);
  if (!data?.success || !Array.isArray(data?.response)) throw new Error('Bags.fm bad response');
  return data.response;
}

// ─── Bags.fm: Get Pools ───────────────────────────────────────────────────────
// Endpoint: GET /solana/bags/pools
// Response: [{ tokenMint, dbcConfigKey, dbcPoolKey, dammV2PoolKey }]
// dammV2PoolKey = null  → masih bonding curve (DBC)
// dammV2PoolKey = ada   → sudah migrated ke Meteora DAMM v2
async function fetchBagsPools(apiKey: string, onlyMigrated = false): Promise<any[]> {
  const url = `https://public-api-v2.bags.fm/api/v1/solana/bags/pools${onlyMigrated ? '?onlyMigrated=true' : ''}`;
  const res = await fetch(url, {
    headers: { 'x-api-key': apiKey },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Bags.fm pools ${res.status}`);
  const data = await res.json();
  if (!data?.success || !Array.isArray(data?.response)) throw new Error('Bags.fm pools bad format');
  return data.response;
}

// ─── DexScreener Enrich ───────────────────────────────────────────────────────
async function enrichWithDexScreener(mints: string[]): Promise<Map<string, any>> {
  const result = new Map<string, any>();
  if (!mints.length) return result;
  for (let i = 0; i < mints.length; i += 30) {
    const batch = mints.slice(i, i + 30);
    try {
      const res = await fetch(
        `https://api.dexscreener.com/tokens/v1/solana/${batch.join(',')}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const pair of data) {
          const addr = pair?.baseToken?.address;
          if (addr) {
            const existing = result.get(addr);
            const newLiq = pair?.liquidity?.usd ?? 0;
            const oldLiq = existing?.liquidity?.usd ?? 0;
            if (!existing || newLiq > oldLiq) result.set(addr, pair);
          }
        }
      }
    } catch { /* skip */ }
  }
  return result;
}

// ─── Handle Bags ──────────────────────────────────────────────────────────────
async function handleBags(bagsTab: string, timeframe: string) {
  const BAGS_KEY = Deno.env.get('BAGS_API_KEY');
  if (!BAGS_KEY) return json({ success: false, error: 'BAGS_API_KEY not configured', tokens: [] });

  // ── NEW: token baru dari feed ──
  if (bagsTab === 'new') {
    let feed: any[];
    try { feed = await fetchBagsFeed(BAGS_KEY); }
    catch (e: any) { return json({ success: false, error: e.message, tokens: [] }); }

    const launched = feed.filter(t => t.status !== 'PRE_LAUNCH');
    if (!launched.length) return json({ success: true, tokens: [], source: 'bags_new_empty' });

    const dexMap = await enrichWithDexScreener(launched.map(t => t.tokenMint).filter(Boolean));

    const tokens = launched.map(t => {
      const dex = dexMap.get(t.tokenMint);
      return {
        tokenAddress: t.tokenMint,
        icon: t.image || dex?.info?.imageUrl || null,
        name: t.name || dex?.baseToken?.name || 'Unknown',
        symbol: t.symbol || dex?.baseToken?.symbol || null,
        priceUsd: dex?.priceUsd || null,
        priceChange: { m5: dex?.priceChange?.m5 ?? null, h1: dex?.priceChange?.h1 ?? null, h6: dex?.priceChange?.h6 ?? null, h24: dex?.priceChange?.h24 ?? null },
        marketCap: dex?.marketCap || dex?.fdv || null,
        fdv: dex?.fdv || null,
        volume24h: dex?.volume?.h24 || null,
        liquidity: dex?.liquidity?.usd || null,
        pairCreatedAt: dex?.pairCreatedAt || null,
        url: dex?.url || `https://bags.fm/token/${t.tokenMint}`,
        twitter: t.twitter || null,
        website: t.website || null,
        description: t.description || null,
        dbcPoolKey: t.dbcPoolKey || null,
      };
    });

    tokens.sort((a: any, b: any) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));
    return json({ success: true, tokens: tokens.slice(0, 50), source: 'bags_new', total: launched.length });
  }

  // ── BONDING: pools dengan dammV2PoolKey = null (masih di bonding curve) ──
  if (bagsTab === 'bonding') {
    let pools: any[];
    try { pools = await fetchBagsPools(BAGS_KEY, false); }
    catch (e: any) { return json({ success: false, error: e.message, tokens: [] }); }

    // Filter: hanya yang belum migrated (dammV2PoolKey null/undefined)
    const bonding = pools.filter(p => !p.dammV2PoolKey);
    if (!bonding.length) return json({ success: true, tokens: [], source: 'bonding_empty' });

    const top = bonding.slice(0, 60);
    const dexMap = await enrichWithDexScreener(top.map(p => p.tokenMint).filter(Boolean));

    const tokens = top.map(p => {
      const dex = dexMap.get(p.tokenMint);
      return {
        tokenAddress: p.tokenMint,
        icon: dex?.info?.imageUrl || null,
        name: dex?.baseToken?.name || p.tokenMint.slice(0, 8) + '...',
        symbol: dex?.baseToken?.symbol || null,
        priceUsd: dex?.priceUsd || null,
        priceChange: { m5: dex?.priceChange?.m5 ?? null, h1: dex?.priceChange?.h1 ?? null, h6: dex?.priceChange?.h6 ?? null, h24: dex?.priceChange?.h24 ?? null },
        marketCap: dex?.marketCap || dex?.fdv || null,
        liquidity: dex?.liquidity?.usd || null,
        volume24h: dex?.volume?.h24 || null,
        pairCreatedAt: dex?.pairCreatedAt || null,
        bondingProgress: null, // butuh Helius untuk data ini
        isMigrated: false,
        dbcPoolKey: p.dbcPoolKey || null,
        url: dex?.url || `https://bags.fm/token/${p.tokenMint}`,
      };
    });

    tokens.sort((a: any, b: any) => (b.liquidity || 0) - (a.liquidity || 0));
    return json({ success: true, tokens: tokens.slice(0, 50), source: 'bags_bonding', total: bonding.length });
  }

  // ── MIGRATED: pools dengan dammV2PoolKey ada (sudah di Meteora DAMM v2) ──
  if (bagsTab === 'migrated') {
    let pools: any[];
    try { pools = await fetchBagsPools(BAGS_KEY, true); }
    catch (e: any) { return json({ success: false, error: e.message, tokens: [] }); }

    if (!pools.length) return json({ success: true, tokens: [], source: 'migrated_empty' });

    const top = pools.slice(0, 60);
    const dexMap = await enrichWithDexScreener(top.map(p => p.tokenMint).filter(Boolean));

    const tokens = top.map(p => {
      const dex = dexMap.get(p.tokenMint);
      return {
        tokenAddress: p.tokenMint,
        icon: dex?.info?.imageUrl || null,
        name: dex?.baseToken?.name || p.tokenMint.slice(0, 8) + '...',
        symbol: dex?.baseToken?.symbol || null,
        priceUsd: dex?.priceUsd || null,
        priceChange: { m5: dex?.priceChange?.m5 ?? null, h1: dex?.priceChange?.h1 ?? null, h6: dex?.priceChange?.h6 ?? null, h24: dex?.priceChange?.h24 ?? null },
        marketCap: dex?.marketCap || dex?.fdv || null,
        fdv: dex?.fdv || null,
        volume24h: dex?.volume?.h24 || null,
        liquidity: dex?.liquidity?.usd || null,
        pairCreatedAt: dex?.pairCreatedAt || null,
        migrated: true,
        dammV2PoolKey: p.dammV2PoolKey,
        url: dex?.url || `https://bags.fm/token/${p.tokenMint}`,
      };
    }).filter((t: any) => t.priceUsd || t.marketCap || t.liquidity);

    tokens.sort((a: any, b: any) => (b.volume24h || 0) - (a.volume24h || 0));
    return json({ success: true, tokens: tokens.slice(0, 50), source: 'bags_migrated', total: pools.length });
  }

  // ── TRENDING: feed + sort by priceChange ──
  if (bagsTab === 'trending') {
    let feed: any[];
    try { feed = await fetchBagsFeed(BAGS_KEY); }
    catch (e: any) { return json({ success: false, error: e.message, tokens: [] }); }

    const launched = feed.filter(t => t.status !== 'PRE_LAUNCH');
    if (!launched.length) return json({ success: true, tokens: [], source: 'trending_empty' });

    const dexMap = await enrichWithDexScreener(launched.map(t => t.tokenMint).filter(Boolean));

    const tokens = launched.map(t => {
      const dex = dexMap.get(t.tokenMint);
      return {
        tokenAddress: t.tokenMint,
        icon: t.image || dex?.info?.imageUrl || null,
        name: t.name || dex?.baseToken?.name || 'Unknown',
        symbol: t.symbol || dex?.baseToken?.symbol || null,
        priceUsd: dex?.priceUsd || null,
        priceChange: { m5: dex?.priceChange?.m5 ?? null, h1: dex?.priceChange?.h1 ?? null, h6: dex?.priceChange?.h6 ?? null, h24: dex?.priceChange?.h24 ?? null },
        marketCap: dex?.marketCap || dex?.fdv || null,
        fdv: dex?.fdv || null,
        volume24h: dex?.volume?.h24 || null,
        liquidity: dex?.liquidity?.usd || null,
        pairCreatedAt: dex?.pairCreatedAt || null,
        url: dex?.url || `https://bags.fm/token/${t.tokenMint}`,
        twitter: t.twitter || null,
        website: t.website || null,
      };
    });

    const keyMap: Record<string, string> = { '5m': 'm5', '1h': 'h1', '6h': 'h6', '24h': 'h24' };
    const ck = keyMap[timeframe] ?? 'h1';
    tokens.sort((a: any, b: any) => (b.priceChange?.[ck] ?? -Infinity) - (a.priceChange?.[ck] ?? -Infinity));

    return json({
      success: true,
      tokens: tokens.filter((t: any) => t.priceUsd).slice(0, 50),
      source: 'bags_trending',
      sortedBy: ck,
    });
  }

  return json({ success: false, error: `Invalid bagsTab: ${bagsTab}`, tokens: [] }, 400);
}

// ─── Handle All Tokens ────────────────────────────────────────────────────────
async function handleAll() {
  try {
    const res = await fetch('https://api.dexscreener.com/token-boosts/top/v1', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return json({ success: false, error: `DexScreener ${res.status}`, tokens: [] });
    const raw = await res.json();
    const boostArray: any[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
    const solana = boostArray.filter((t: any) => t.chainId === 'solana').slice(0, 60);
    if (!solana.length) return json({ success: true, tokens: [], source: 'dex_all_empty' });

    const dexMap = await enrichWithDexScreener(solana.map((t: any) => t.tokenAddress).filter(Boolean));
    const tokens = solana.map((t: any) => {
      const dex = dexMap.get(t.tokenAddress);
      return {
        tokenAddress: t.tokenAddress,
        icon: dex?.info?.imageUrl || t.icon || null,
        name: dex?.baseToken?.name || 'Unknown',
        symbol: dex?.baseToken?.symbol || null,
        priceUsd: dex?.priceUsd || null,
        priceChange: { m5: dex?.priceChange?.m5 ?? null, h1: dex?.priceChange?.h1 ?? null, h6: dex?.priceChange?.h6 ?? null, h24: dex?.priceChange?.h24 ?? null },
        marketCap: dex?.marketCap || dex?.fdv || null,
        fdv: dex?.fdv || null,
        volume24h: dex?.volume?.h24 || null,
        liquidity: dex?.liquidity?.usd || null,
        pairCreatedAt: dex?.pairCreatedAt || null,
        boostAmount: t.totalAmount || t.amount || 0,
        url: t.url || dex?.url || `https://dexscreener.com/solana/${t.tokenAddress}`,
      };
    }).filter((t: any) => t.priceUsd || t.marketCap);

    tokens.sort((a: any, b: any) => (b.boostAmount ?? 0) - (a.boostAmount ?? 0));
    return json({ success: true, tokens: tokens.slice(0, 50), source: 'dex_all' });
  } catch (e: any) {
    return json({ success: false, error: e.message, tokens: [] });
  }
}

// ─── Handle Pump.fun ─────────────────────────────────────────────────────────
// Sumber data: Moralis solana-gateway
// Tab bonding: filter ketat — bc 20–99 DAN graduatedAt harus null
async function handlePump(pumpTab: string) {
  const MORALIS_KEY = Deno.env.get('MORALIS_API_KEY') || Deno.env.get('VITE_MORALIS_API_KEY');
  if (!MORALIS_KEY) return json({ success: false, error: 'MORALIS_API_KEY not configured', tokens: [] });

  const endpoint = pumpTab === 'graduated' ? 'graduated' : pumpTab === 'bonding' ? 'bonding' : 'new';
  const url = `https://solana-gateway.moralis.io/token/mainnet/exchange/pumpfun/${endpoint}?limit=100`;

  try {
    const res = await fetch(url, {
      headers: { 'X-Api-Key': MORALIS_KEY, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`Moralis ${res.status}: ${await res.text().catch(() => '')}`);

    const data = await res.json();
    let raw: any[] = data?.result ?? [];

    if (pumpTab === 'bonding') {
      raw = raw.filter(t => {
        const bc = Number(t.bondingCurveProgress ?? 0);
        // Syarat 1: range bonding aktif 20–99
        if (bc < 20 || bc >= 99) return false;
        // Syarat 2: belum graduated — graduatedAt harus null/undefined
        if (t.graduatedAt != null) return false;
        // Syarat 3: tidak punya flag graduated
        if (t.graduated === true) return false;
        return true;
      });
      raw.sort((a, b) => Number(b.bondingCurveProgress) - Number(a.bondingCurveProgress));
    }

    if (pumpTab === 'new') {
      raw = raw.filter(t => {
        const bc = Number(t.bondingCurveProgress ?? 0);
        return !!t.logo && bc < 20;
      });
    }

    const tokens = raw.map((t: any) => ({
      tokenAddress: t.tokenAddress,
      name:         t.name   || 'Unknown',
      symbol:       t.symbol || '???',
      icon:         t.logo   || null,
      priceUsd:     t.priceUsd ? String(t.priceUsd) : null,
      priceChange:  null,
      marketCap:    t.fullyDilutedValuation ? Number(t.fullyDilutedValuation) : null,
      fdv:          t.fullyDilutedValuation ? Number(t.fullyDilutedValuation) : null,
      liquidity:    t.liquidity ? Number(t.liquidity) : null,
      bondingCurve: t.bondingCurveProgress != null ? Number(t.bondingCurveProgress) : null,
      graduated:    pumpTab === 'graduated',
      createdAt:    null,
      graduatedAt:  t.graduatedAt || null,
      volume24h:    null,
      txns24h:      null,
      holders:      null,
      url:          `https://pump.fun/coin/${t.tokenAddress}`,
    }));

    return json({ success: true, tokens, source: `pumpfun_moralis_${pumpTab}`, total: tokens.length });
  } catch (e: any) {
    return json({ success: false, error: e.message, tokens: [] });
  }
}
// ─── Handle Bonk.fun (LetsBonk.fun) via DexScreener ─────────────────────────
// bonk.fun = Raydium LaunchLab dengan platform config FfYek5vEz23cMkWsdJwG2oa6EphsvXSHrGpdALN4g6W1
// Identifikasi token: mint address endsWith("bonk") ATAU dexId raydium/raydium-launchlab
// new      → dexId "raydium-launchlab", sort pairCreatedAt desc (token bonding curve terbaru)
// bonding  → dexId "raydium-launchlab", launchpadProgress 20-99, sort desc
// migrated → dexId "raydium", sort volume desc (sudah graduated ke Raydium AMM)
async function handleBonk(bonkTab: string): Promise<Response> {
  const queries = ['letsbonk', 'letsbonk.fun', 'bonk.fun token'];
  const seen    = new Set<string>();
  const all: any[] = [];

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const pair of (data?.pairs ?? [])) {
        if (pair.chainId !== 'solana') continue;
        const addr = pair.baseToken?.address;
        if (!addr || seen.has(addr)) continue;
        // Identifikasi bonk.fun token: mint endsWith "bonk"
        if (!addr.toLowerCase().endsWith('bonk')) continue;
        seen.add(addr);

        const dexId = pair.dexId ?? '';
        const liq   = pair.liquidity?.usd ?? 0;

        // Estimasi bondingCurve% dari liquidity
        // bonk.fun bonding curve selesai ≈ $45K liquidity
        const BONK_LIQ_TARGET = 45000;
        const bc = dexId !== 'raydium'
          ? Math.min((liq / BONK_LIQ_TARGET) * 100, 99)
          : null;

        all.push({
          tokenAddress:  addr,
          name:          pair.baseToken?.name   || 'Unknown',
          symbol:        pair.baseToken?.symbol || '???',
          icon:          pair.info?.imageUrl    || null,
          priceUsd:      pair.priceUsd          || null,
          priceChange: {
            m5:  pair.priceChange?.m5  ?? null,
            h1:  pair.priceChange?.h1  ?? null,
            h6:  pair.priceChange?.h6  ?? null,
            h24: pair.priceChange?.h24 ?? null,
          },
          marketCap:     pair.marketCap || pair.fdv || null,
          fdv:           pair.fdv       || null,
          liquidity:     liq            || null,
          volume24h:     pair.volume?.h24 || null,
          pairCreatedAt: pair.pairCreatedAt || null,
          bondingCurve:  bc,
          graduated:     dexId === 'raydium',
          dexId,
          url: `https://letsbonk.fun/token/${addr}`,
          txns24h: (pair.txns?.h24?.buys ?? 0) + (pair.txns?.h24?.sells ?? 0),
        });
      }
    } catch { continue; }
  }

  if (!all.length) return json({ success: true, tokens: [], source: 'bonk_empty' });

  let tokens: any[];

  if (bonkTab === 'new') {
    // Masih di bonding curve (bukan raydium), token paling baru
    tokens = all
      .filter(t => t.dexId !== 'raydium' && (t.bondingCurve ?? 0) < 20)
      .sort((a, b) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0));
  } else if (bonkTab === 'bonding') {
    // Masih di bonding curve, progress 20-99, sort descending
    tokens = all
      .filter(t => t.dexId !== 'raydium' && (t.bondingCurve ?? 0) >= 20 && (t.bondingCurve ?? 0) < 99)
      .sort((a, b) => (b.bondingCurve ?? 0) - (a.bondingCurve ?? 0));
  } else {
    // migrated → dexId raydium, sort by volume
    tokens = all
      .filter(t => t.dexId === 'raydium')
      .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
  }

  return json({ success: true, tokens: tokens.slice(0, 50), source: `bonk_${bonkTab}`, total: tokens.length });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const body = await req.json();
    const type: string = body.type ?? 'bags';
    const timeframe: string = body.timeframe ?? '1h';
    if (type === 'bags') return await handleBags(body.bagsTab ?? 'new', timeframe);
    if (type === 'pump') return await handlePump(body.pumpTab ?? 'new');
    if (type === 'bonk') return await handleBonk(body.bonkTab ?? 'new');
    if (type === 'all')  return await handleAll();
    if (type === 'new')      return await handleBags('new', timeframe);
    if (type === 'trending') return await handleBags('trending', timeframe);
    return json({ success: false, error: `Invalid type: ${type}` }, 400);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fetch-tokens]', msg);
    return json({ success: false, error: msg }, 500);
  }
});
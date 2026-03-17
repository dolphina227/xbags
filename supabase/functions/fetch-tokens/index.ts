import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, ' +
    'x-supabase-client-platform, x-supabase-client-platform-version, ' +
    'x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function timeframeToMs(tf: string): number {
  switch (tf) {
    case '5m':  return 5 * 60 * 1000;
    case '1h':  return 60 * 60 * 1000;
    case '6h':  return 6 * 60 * 60 * 1000;
    case '24h': return 24 * 60 * 60 * 1000;
    default:    return 60 * 60 * 1000;
  }
}

async function enrichWithDexScreener(mints: string[]): Promise<Map<string, any>> {
  const result = new Map<string, any>();
  if (mints.length === 0) return result;

  for (let i = 0; i < mints.length; i += 30) {
    const batch = mints.slice(i, i + 30);
    const url = `https://api.dexscreener.com/tokens/v1/solana/${batch.join(',')}`;
    try {
      const res = await fetch(url);
      if (!res.ok) { console.error(`DexScreener batch error: ${res.status}`); continue; }
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const pair of data) {
          const addr = pair?.baseToken?.address;
          if (addr && !result.has(addr)) result.set(addr, pair);
        }
      }
    } catch (e) { console.error('DexScreener batch fetch error:', e); }
  }
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const type: string = body.type ?? 'new';
    const timeframe: string = body.timeframe ?? '1h';

    // ── Shared: fetch Bags.fm feed ──
    async function fetchBagsFeed(): Promise<any[]> {
      const BAGS_API_KEY = Deno.env.get('BAGS_API_KEY');
      if (!BAGS_API_KEY) throw new Error('BAGS_API_KEY not configured');

      const res = await fetch('https://public-api-v2.bags.fm/api/v1/token-launch/feed', {
        headers: { 'x-api-key': BAGS_API_KEY },
      });
      if (!res.ok) throw new Error(`Bags.fm error: ${res.status}`);
      const text = await res.text();
      if (text.startsWith('<')) throw new Error('Bags.fm returned HTML');
      const data = JSON.parse(text);
      if (data?.success === true && Array.isArray(data?.response)) return data.response;
      throw new Error('Bags.fm unexpected format');
    }

    function mapToken(t: any, dex: any) {
      return {
        tokenAddress: t.tokenMint,
        icon: t.image || dex?.info?.imageUrl || null,
        name: t.name || dex?.baseToken?.name || 'Unknown',
        symbol: t.symbol || dex?.baseToken?.symbol || null,
        priceUsd: dex?.priceUsd || null,
        priceChange: {
          m5: dex?.priceChange?.m5 ?? null,
          h1: dex?.priceChange?.h1 ?? null,
          h6: dex?.priceChange?.h6 ?? null,
          h24: dex?.priceChange?.h24 ?? null,
        },
        marketCap: dex?.marketCap || dex?.fdv || null,
        fdv: dex?.fdv || null,
        volume24h: dex?.volume?.h24 || null,
        liquidity: dex?.liquidity?.usd || null,
        pairCreatedAt: dex?.pairCreatedAt || null,
        dexId: dex?.dexId || null,
        url: dex?.url || `https://bags.fm/token/${t.tokenMint}`,
      };
    }

    // ── NEW ──
    if (type === 'new') {
      let rawFeed: any[];
      try { rawFeed = await fetchBagsFeed(); } catch (e: any) {
        return json({ success: false, error: e.message, tokens: [] });
      }

      const launched = rawFeed.filter((t: any) => t.status !== 'PRE_LAUNCH');
      if (launched.length === 0) return json({ success: true, tokens: [], source: 'bags_new_empty' });

      const mints = launched.map((t: any) => t.tokenMint).filter(Boolean);
      const dexMap = await enrichWithDexScreener(mints);

      const tokens = launched.map((t: any) => mapToken(t, dexMap.get(t.tokenMint)));

      tokens.sort((a: any, b: any) => {
        if (!a.pairCreatedAt && !b.pairCreatedAt) return 0;
        if (!a.pairCreatedAt) return 1;
        if (!b.pairCreatedAt) return -1;
        return b.pairCreatedAt - a.pairCreatedAt;
      });

      const cutoff = Date.now() - timeframeToMs(timeframe);
      const filtered = tokens.filter((t: any) => !t.pairCreatedAt || t.pairCreatedAt >= cutoff);

      return json({ success: true, tokens: filtered.slice(0, 50), source: 'bags_new' });
    }

    // ── TRENDING ──
    if (type === 'trending') {
      let rawFeed: any[];
      try { rawFeed = await fetchBagsFeed(); } catch (e: any) {
        return json({ success: false, error: e.message, tokens: [] });
      }

      const launched = rawFeed.filter((t: any) => t.status !== 'PRE_LAUNCH');
      if (launched.length === 0) return json({ success: true, tokens: [], source: 'bags_trending_empty' });

      const mints = launched.map((t: any) => t.tokenMint).filter(Boolean);
      const dexMap = await enrichWithDexScreener(mints);

      const tokens = launched.map((t: any) => mapToken(t, dexMap.get(t.tokenMint)));

      const changeKeyMap: Record<string, string> = { '5m': 'm5', '1h': 'h1', '6h': 'h6', '24h': 'h24' };
      const changeKey = changeKeyMap[timeframe] ?? 'h1';

      tokens.sort((a: any, b: any) => {
        const aVal = a.priceChange?.[changeKey] ?? -Infinity;
        const bVal = b.priceChange?.[changeKey] ?? -Infinity;
        return bVal - aVal;
      });

      return json({ success: true, tokens: tokens.slice(0, 50), source: 'bags_trending' });
    }

    // ── ALL ──
    if (type === 'all') {
      let boostArray: any[] = [];
      try {
        const res = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
        if (!res.ok) return json({ success: false, error: `DexScreener error: ${res.status}`, tokens: [] });
        const raw = await res.json();
        boostArray = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
      } catch (e: any) {
        return json({ success: false, error: 'DexScreener fetch failed', tokens: [] });
      }

      const solanaBoosts = boostArray.filter((t: any) => t.chainId === 'solana').slice(0, 60);
      if (solanaBoosts.length === 0) return json({ success: true, tokens: [], source: 'dex_all_empty' });

      const addresses = solanaBoosts.map((t: any) => t.tokenAddress).filter(Boolean);
      const dexMap = await enrichWithDexScreener(addresses);

      const tokens = solanaBoosts
        .map((t: any) => {
          const dex = dexMap.get(t.tokenAddress);
          return {
            tokenAddress: t.tokenAddress,
            icon: dex?.info?.imageUrl || t.icon || null,
            name: dex?.baseToken?.name || t.description || t.tokenAddress?.slice(0, 8) || 'Unknown',
            symbol: dex?.baseToken?.symbol || t.header || null,
            priceUsd: dex?.priceUsd || null,
            priceChange: {
              m5: dex?.priceChange?.m5 ?? null,
              h1: dex?.priceChange?.h1 ?? null,
              h6: dex?.priceChange?.h6 ?? null,
              h24: dex?.priceChange?.h24 ?? null,
            },
            marketCap: dex?.marketCap || dex?.fdv || null,
            fdv: dex?.fdv || null,
            volume24h: dex?.volume?.h24 || null,
            liquidity: dex?.liquidity?.usd || null,
            pairCreatedAt: dex?.pairCreatedAt || null,
            boostAmount: t.totalAmount || t.amount || 0,
            url: t.url || dex?.url || `https://dexscreener.com/solana/${t.tokenAddress}`,
          };
        })
        .filter((t: any) => t.priceUsd !== null || t.marketCap !== null);

      tokens.sort((a: any, b: any) => (b.boostAmount ?? 0) - (a.boostAmount ?? 0));

      return json({ success: true, tokens: tokens.slice(0, 50), source: 'dex_all' });
    }

    return json({ success: false, error: `Invalid type: ${type}. Use: new | trending | all` }, 400);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('fetch-tokens error:', msg);
    return json({ success: false, error: msg }, 500);
  }
});

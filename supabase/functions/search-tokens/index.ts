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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return json({ success: true, tokens: [] });
    }

    const q = query.trim();
    const isAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q);

    // Strategy 1: If it looks like a Solana address, look up directly via DexScreener
    if (isAddress) {
      try {
        const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${q}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            // Take the first pair (highest liquidity)
            const pair = data[0];
            return json({
              success: true,
              tokens: [{
                tokenAddress: pair.baseToken?.address || q,
                icon: pair.info?.imageUrl || null,
                name: pair.baseToken?.name || 'Unknown',
                symbol: pair.baseToken?.symbol || null,
                priceUsd: pair.priceUsd || null,
                priceChange: {
                  m5: pair.priceChange?.m5 ?? null,
                  h1: pair.priceChange?.h1 ?? null,
                  h6: pair.priceChange?.h6 ?? null,
                  h24: pair.priceChange?.h24 ?? null,
                },
                marketCap: pair.marketCap || pair.fdv || null,
                fdv: pair.fdv || null,
                volume24h: pair.volume?.h24 || null,
                liquidity: pair.liquidity?.usd || null,
                pairCreatedAt: pair.pairCreatedAt || null,
                url: pair.url || null,
              }],
            });
          }
        }
      } catch (e) {
        console.error('DexScreener address lookup error:', e);
      }

      // Fallback: try Helius DAS API for token metadata
      const HELIUS_KEY = Deno.env.get('VITE_HELIUS_API_KEY');
      if (HELIUS_KEY) {
        try {
          const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 'search',
              method: 'getAsset',
              params: { id: q },
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const asset = data?.result;
            if (asset) {
              return json({
                success: true,
                tokens: [{
                  tokenAddress: q,
                  icon: asset.content?.links?.image || asset.content?.files?.[0]?.uri || null,
                  name: asset.content?.metadata?.name || 'Unknown Token',
                  symbol: asset.content?.metadata?.symbol || null,
                  priceUsd: null,
                  priceChange: { m5: null, h1: null, h6: null, h24: null },
                  marketCap: null,
                  fdv: null,
                  volume24h: null,
                  liquidity: null,
                  pairCreatedAt: null,
                  url: null,
                }],
              });
            }
          }
        } catch (e) {
          console.error('Helius getAsset error:', e);
        }
      }

      return json({ success: true, tokens: [] });
    }

    // Strategy 2: Search by name/symbol via DexScreener search
    const results: any[] = [];

    // DexScreener search API
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        const pairs = data?.pairs || [];
        // Filter Solana pairs only, deduplicate by base token address
        const seen = new Set<string>();
        for (const pair of pairs) {
          if (pair.chainId !== 'solana') continue;
          const addr = pair.baseToken?.address;
          if (!addr || seen.has(addr)) continue;
          seen.add(addr);
          results.push({
            tokenAddress: addr,
            icon: pair.info?.imageUrl || null,
            name: pair.baseToken?.name || 'Unknown',
            symbol: pair.baseToken?.symbol || null,
            priceUsd: pair.priceUsd || null,
            priceChange: {
              m5: pair.priceChange?.m5 ?? null,
              h1: pair.priceChange?.h1 ?? null,
              h6: pair.priceChange?.h6 ?? null,
              h24: pair.priceChange?.h24 ?? null,
            },
            marketCap: pair.marketCap || pair.fdv || null,
            fdv: pair.fdv || null,
            volume24h: pair.volume?.h24 || null,
            liquidity: pair.liquidity?.usd || null,
            pairCreatedAt: pair.pairCreatedAt || null,
            url: pair.url || null,
          });
          if (results.length >= 10) break;
        }
      }
    } catch (e) {
      console.error('DexScreener search error:', e);
    }

    // Also search Bags.fm feed for matching tokens
    const BAGS_API_KEY = Deno.env.get('BAGS_API_KEY');
    if (BAGS_API_KEY && results.length < 10) {
      try {
        const res = await fetch(
          'https://public-api-v2.bags.fm/api/v1/token-launch/feed',
          { headers: { 'x-api-key': BAGS_API_KEY } }
        );
        if (res.ok) {
          const text = await res.text();
          if (!text.startsWith('<')) {
            const data = JSON.parse(text);
            const feed = (data?.success && Array.isArray(data?.response)) ? data.response : [];
            const ql = q.toLowerCase().replace(/^\$/, '');
            const seenAddrs = new Set(results.map((r: any) => r.tokenAddress));
            for (const t of feed) {
              if (seenAddrs.has(t.tokenMint)) continue;
              const nameMatch = t.name?.toLowerCase().includes(ql);
              const symbolMatch = t.symbol?.toLowerCase().includes(ql);
              if (nameMatch || symbolMatch) {
                results.push({
                  tokenAddress: t.tokenMint,
                  icon: t.image || null,
                  name: t.name || 'Unknown',
                  symbol: t.symbol || null,
                  priceUsd: null,
                  priceChange: { m5: null, h1: null, h6: null, h24: null },
                  marketCap: null,
                  fdv: null,
                  volume24h: null,
                  liquidity: null,
                  pairCreatedAt: null,
                  url: `https://bags.fm/token/${t.tokenMint}`,
                });
                if (results.length >= 10) break;
              }
            }
          }
        }
      } catch (e) {
        console.error('Bags.fm search error:', e);
      }
    }

    return json({ success: true, tokens: results });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('search-tokens error:', msg);
    return json({ success: false, error: msg, tokens: [] }, 500);
  }
});

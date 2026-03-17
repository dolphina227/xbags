import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';

async function safeFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  const text = await res.text();

  console.log(`[bags-trade] ${options?.method || 'GET'} ${url}`);
  console.log(`[bags-trade] status: ${res.status}`);
  console.log(`[bags-trade] response: ${text}`);

  if (text.startsWith('<!') || text.startsWith('<html')) {
    throw new Error(`HTML response (status ${res.status}) — wrong endpoint`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`non-JSON (status ${res.status}): ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    throw new Error(`API error (status ${res.status}): ${JSON.stringify(parsed)}`);
  }

  return parsed;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BAGS_API_KEY = Deno.env.get('BAGS_API_KEY');
    if (!BAGS_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'BAGS_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, ...params } = await req.json();
    console.log(`[bags-trade] action: ${action}`);

    // ════════════════════════════════════════════════════
    // QUOTE — GET /trade/quote
    // ════════════════════════════════════════════════════
    if (action === 'quote') {
      const queryParams = new URLSearchParams({
        inputMint:    params.inputMint,
        outputMint:   params.outputMint,
        amount:       String(params.amount),
        slippageMode: params.slippageMode || 'auto',
      });

      if (params.slippageMode === 'manual' && params.slippageBps !== undefined) {
        queryParams.set('slippageBps', String(params.slippageBps));
      }

      const data = await safeFetch(
        `${BAGS_API_BASE}/trade/quote?${queryParams}`,
        { method: 'GET', headers: { 'x-api-key': BAGS_API_KEY } }
      );

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ════════════════════════════════════════════════════
    // SWAP — POST /trade/swap
    // ════════════════════════════════════════════════════
    if (action === 'swap') {
      const q = params.quoteResponse;

      if (!q || !params.userPublicKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing quoteResponse or userPublicKey' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const swapBody = {
        quoteResponse: {
          requestId:             q.requestId,
          contextSlot:           q.contextSlot,
          inAmount:              q.inAmount,
          inputMint:             q.inputMint,
          outAmount:             q.outAmount,
          outputMint:            q.outputMint,
          minOutAmount:          q.minOutAmount,
          otherAmountThreshold:  q.otherAmountThreshold,
          priceImpactPct:        q.priceImpactPct,
          slippageBps:           q.slippageBps,
          routePlan:             q.routePlan,
          platformFee:           q.platformFee    ?? null,
          outTransferFee:        q.outTransferFee ?? null,
          simulatedComputeUnits: q.simulatedComputeUnits ?? null,
        },
        userPublicKey: params.userPublicKey,
      };

      console.log(`[bags-trade] swap body: ${JSON.stringify(swapBody)}`);

      const data = await safeFetch(
        `${BAGS_API_BASE}/trade/swap`,
        {
          method: 'POST',
          headers: {
            'x-api-key':    BAGS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(swapBody),
        }
      );

      const swapTx = data?.response?.swapTransaction;

      if (!swapTx) {
        return new Response(JSON.stringify({
          success: false,
          error:   'swapTransaction not found in response',
          debug:   data,
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success:                   true,
        swapTransaction:           swapTx,
        computeUnitLimit:          data.response.computeUnitLimit,
        lastValidBlockHeight:      data.response.lastValidBlockHeight,
        prioritizationFeeLamports: data.response.prioritizationFeeLamports,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action. Use "quote" or "swap"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[bags-trade] Error:', msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

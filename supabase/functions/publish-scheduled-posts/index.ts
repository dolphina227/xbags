import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find all scheduled posts that are due and not yet published
    const now = new Date().toISOString();

    const { data: posts, error: fetchError } = await supabase
      .from("posts")
      .select("id, scheduled_at")
      .eq("is_published", false)
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", now);

    if (fetchError) {
      throw fetchError;
    }

    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No scheduled posts to publish", published: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const postIds = posts.map((p: any) => p.id);

    const { error: updateError } = await supabase
      .from("posts")
      .update({ is_published: true })
      .in("id", postIds);

    if (updateError) {
      throw updateError;
    }

    console.log(`✅ Published ${postIds.length} scheduled posts`);

    return new Response(
      JSON.stringify({ message: `Published ${postIds.length} posts`, published: postIds.length, ids: postIds }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error publishing scheduled posts:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { script_id } = await req.json();
    if (!script_id) {
      return new Response(
        JSON.stringify({ error: "Missing script_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get script + scenes
    const { data: script, error: scriptError } = await supabase
      .from("story_scripts")
      .select("*")
      .eq("id", script_id)
      .single();

    if (scriptError || !script) {
      return new Response(
        JSON.stringify({ error: "Script not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: scenes, error: scenesError } = await supabase
      .from("story_scenes")
      .select("*")
      .eq("script_id", script_id)
      .order("scene_number");

    if (scenesError || !scenes?.length) {
      return new Response(
        JSON.stringify({ error: "No scenes found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update script status
    await supabase
      .from("story_scripts")
      .update({ status: "rendering" })
      .eq("id", script_id);

    const functionsBaseUrl = supabaseUrl.replace(/\/$/, "") + "/functions/v1";

    // Render scenes — process 2 at a time (look-ahead buffer)
    const results: Array<{ scene_id: string; scene_number: number; audio_url?: string; image_url?: string; error?: string }> = [];

    for (let i = 0; i < scenes.length; i += 2) {
      const batch = scenes.slice(i, i + 2);
      const batchPromises = batch.map(async (scene) => {
        const sceneResult: typeof results[0] = {
          scene_id: scene.id,
          scene_number: scene.scene_number,
        };

        // Skip if already rendered
        if (scene.audio_url && scene.image_url) {
          sceneResult.audio_url = scene.audio_url;
          sceneResult.image_url = scene.image_url;
          return sceneResult;
        }

        // Determine stitching context
        const prevScene = scenes.find((s) => s.scene_number === scene.scene_number - 1);
        const nextScene = scenes.find((s) => s.scene_number === scene.scene_number + 1);

        // Generate TTS and Image in parallel
        const [ttsResult, imageResult] = await Promise.allSettled([
          // TTS
          !scene.audio_url
            ? fetch(`${functionsBaseUrl}/elevenlabs-tts`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  text: scene.narration_text,
                  voice_id: script.voice_id || "JBFqnCBsd6RMkjVDRZzb",
                  scene_id: scene.id,
                  script_id: script_id,
                  previous_text: prevScene?.narration_text || undefined,
                  next_text: nextScene?.narration_text || undefined,
                }),
              }).then((r) => r.json())
            : Promise.resolve({ success: true, audio_url: scene.audio_url }),

          // Image
          !scene.image_url
            ? fetch(`${functionsBaseUrl}/generate-scene-image`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  visual_prompt: scene.visual_prompt,
                  scene_id: scene.id,
                  script_id: script_id,
                }),
              }).then((r) => r.json())
            : Promise.resolve({ success: true, image_url: scene.image_url }),
        ]);

        if (ttsResult.status === "fulfilled" && ttsResult.value.audio_url) {
          sceneResult.audio_url = ttsResult.value.audio_url;
        } else if (ttsResult.status === "rejected") {
          console.error(`TTS failed for scene ${scene.scene_number}:`, ttsResult.reason);
          sceneResult.error = "TTS failed";
        }

        if (imageResult.status === "fulfilled" && imageResult.value.image_url) {
          sceneResult.image_url = imageResult.value.image_url;
        } else if (imageResult.status === "rejected") {
          console.error(`Image failed for scene ${scene.scene_number}:`, imageResult.reason);
          sceneResult.error = (sceneResult.error ? sceneResult.error + ", " : "") + "Image failed";
        }

        return sceneResult;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Check if all scenes rendered successfully
    const allSuccess = results.every((r) => r.audio_url && r.image_url);
    const finalStatus = allSuccess ? "rendered" : "partial";

    await supabase
      .from("story_scripts")
      .update({ status: finalStatus })
      .eq("id", script_id);

    return new Response(
      JSON.stringify({
        success: true,
        status: finalStatus,
        scenes: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("render-story error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

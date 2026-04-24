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
      .select("*, character_image_url, character_bible")
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

    // Build a quick lookup: character name -> visual_description
    const bible: Array<{ name: string; visual_description: string; role?: string }> =
      Array.isArray(script.character_bible) ? script.character_bible : [];
    const bibleByName = new Map(bible.map((c) => [c.name?.toLowerCase(), c]));

    // Compose a "character sheet" string we always inject into the prompt
    const fullCharacterSheet = bible.length
      ? "CHARACTER SHEET (must match exactly in every illustration):\n" +
        bible.map((c) => `- ${c.name}: ${c.visual_description}`).join("\n")
      : "";

    // Render scenes SEQUENTIALLY for visual continuity. TTS for each scene runs
    // in parallel with that scene's image, but the next scene waits so we can
    // pass the previous generated image as a visual reference.
    const results: Array<{ scene_id: string; scene_number: number; audio_url?: string; image_url?: string; error?: string }> = [];
    let previousImageUrl: string | undefined = undefined;

    for (const scene of scenes) {
      const sceneResult: typeof results[0] = {
        scene_id: scene.id,
        scene_number: scene.scene_number,
      };

      // Skip if already rendered
      if (scene.audio_url && scene.image_url) {
        sceneResult.audio_url = scene.audio_url;
        sceneResult.image_url = scene.image_url;
        previousImageUrl = scene.image_url;
        results.push(sceneResult);
        continue;
      }

      const prevScene = scenes.find((s) => s.scene_number === scene.scene_number - 1);
      const nextScene = scenes.find((s) => s.scene_number === scene.scene_number + 1);

      // Build per-scene character sheet — only include characters the LLM marked
      // as present, falling back to the full sheet if none provided.
      const present: string[] = Array.isArray((scene as any).characters_present)
        ? (scene as any).characters_present
        : [];
      const sceneSheet = present.length
        ? "CHARACTERS IN THIS SCENE (match these descriptions exactly):\n" +
          present
            .map((n) => bibleByName.get(n?.toLowerCase()))
            .filter(Boolean)
            .map((c: any) => `- ${c.name}: ${c.visual_description}`)
            .join("\n")
        : fullCharacterSheet;

      const enrichedPrompt = sceneSheet
        ? `${sceneSheet}\n\nSCENE: ${scene.visual_prompt}`
        : scene.visual_prompt;

      const [ttsResult, imageResult] = await Promise.allSettled([
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

        !scene.image_url
          ? fetch(`${functionsBaseUrl}/generate-scene-image`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                visual_prompt: enrichedPrompt,
                scene_id: scene.id,
                script_id: script_id,
                character_image_url: script.character_image_url || undefined,
                previous_image_url: previousImageUrl,
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
        previousImageUrl = imageResult.value.image_url;
      } else if (imageResult.status === "rejected") {
        console.error(`Image failed for scene ${scene.scene_number}:`, imageResult.reason);
        sceneResult.error = (sceneResult.error ? sceneResult.error + ", " : "") + "Image failed";
      }

      results.push(sceneResult);
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

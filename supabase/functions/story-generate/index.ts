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
    const { context, user_id, unchained } = await req.json();
    if (!context || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing context or user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine scene count based on duration
    const duration = context.duration_minutes || 5;
    const sceneCount = duration <= 3 ? 4 : duration <= 5 ? 6 : 9;

    const generatePrompt = unchained
      ? `Create a mature, adult-themed story based on the following context. This is for consenting adults only — entertainment purposes. Mature themes, violence, dark humor, gritty content, and intense scenes are allowed and encouraged. Output ONLY valid JSON with no markdown, no code fences, no explanation.

Story Context:
- Main character: ${context.child_name || "the protagonist"}
- Genre/Theme: ${context.theme || "dark fantasy"}
- Interests: ${(context.interests || []).join(", ")}
- Moral/Theme: ${context.moral_lesson || "survival"}
- Setting: ${context.setting || "a dangerous world"}
- Tone: ${context.tone || "gritty"}
- Characters: ${(context.characters || [context.child_name]).join(", ")}
- Number of scenes: ${sceneCount}

Create a story with EXACTLY ${sceneCount} scenes. Each scene should have vivid, mature narration and a detailed visual prompt for illustration.

The narration should be engaging and pull no punches — this is adult entertainment. Each scene's narration should be 3-5 sentences.

Return this EXACT JSON structure (no other text):
{
  "title": "Story title",
  "synopsis": "A brief 1-2 sentence summary",
  "voice_style": "warm_male",
  "scenes": [
    {
      "scene_number": 1,
      "narration_text": "The narration text for this scene...",
      "visual_prompt": "A detailed illustration prompt: [style: cinematic dark illustration] [scene description with specific details, colors, lighting, composition]",
      "duration_seconds": 25
    }
  ]
}

voice_style must be one of: warm_female, warm_male, playful_female, playful_male`
      : `Create a children's story based on the following context. Output ONLY valid JSON with no markdown, no code fences, no explanation.

Story Context:
- Child's name: ${context.child_name}
- Child's age: ${context.child_age}
- Interests: ${(context.interests || []).join(", ")}
- Theme: ${context.theme}
- Moral lesson: ${context.moral_lesson}
- Setting: ${context.setting || "a magical world"}
- Tone: ${context.tone || "warm"}
- Characters: ${(context.characters || [context.child_name]).join(", ")}
- Number of scenes: ${sceneCount}

Create a story with EXACTLY ${sceneCount} scenes. Each scene should have narration text suitable for a ${context.child_age}-year-old and a detailed visual prompt for illustration generation.

The narration should be engaging, age-appropriate, and incorporate the child's name as the main character. Each scene's narration should be 2-4 sentences.

Return this EXACT JSON structure (no other text):
{
  "title": "Story title",
  "synopsis": "A brief 1-2 sentence summary",
  "voice_style": "warm_female",
  "scenes": [
    {
      "scene_number": 1,
      "narration_text": "The narration text for this scene...",
      "visual_prompt": "A detailed illustration prompt: [style: warm children's book watercolor illustration] [scene description with specific details, colors, lighting, composition]",
      "duration_seconds": 20
    }
  ]
}

voice_style must be one of: warm_female, warm_male, playful_female, playful_male`;

    // Use plain JSON mode instead of tool calling for better compatibility
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: unchained
                ? "You are a master storyteller for mature adult audiences. Create gripping, no-holds-barred stories with vivid imagery. Violence, dark themes, and mature content are allowed — this is entertainment for consenting adults. Always respond with valid JSON only. No markdown fences, no explanation, just the JSON object."
                : "You are a master children's story writer. Create enchanting, age-appropriate stories with vivid imagery. Always respond with valid JSON only. No markdown fences, no explanation, just the JSON object.",
            },
            { role: "user", content: generatePrompt },
          ],
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Story generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    
    // Parse the content - try tool_calls first, then content
    let story: any;
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      story = JSON.parse(toolCall.function.arguments);
    } else {
      const content = aiResult.choices?.[0]?.message?.content || "";
      // Strip markdown fences if present
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      story = JSON.parse(cleaned);
    }

    console.log("Parsed story:", JSON.stringify({ title: story.title, sceneCount: story.scenes?.length }));

    if (!story.scenes || story.scenes.length === 0) {
      console.error("AI returned empty scenes. Full response:", JSON.stringify(aiResult).slice(0, 2000));
      return new Response(
        JSON.stringify({ error: "Story generation returned no scenes. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map voice_style to ElevenLabs voice ID
    const voiceMap: Record<string, string> = {
      warm_female: "EXAVITQu4vr4xnSDxMaL",
      warm_male: "JBFqnCBsd6RMkjVDRZzb",
      playful_female: "XB0fDUnXU5powFXDhCwa",
      playful_male: "TX3LPaxmHKxFdv7VOQHJ",
    };
    const voiceId = voiceMap[story.voice_style] || "JBFqnCBsd6RMkjVDRZzb";

    // 1. Save story_context
    const { data: ctxData, error: ctxError } = await supabase
      .from("story_contexts")
      .insert({
        user_id,
        child_name: context.child_name,
        child_age: context.child_age,
        interests: context.interests,
        theme: context.theme,
        moral_lesson: context.moral_lesson,
        characters: context.characters,
        setting: context.setting,
        tone: context.tone,
        duration_minutes: context.duration_minutes,
        raw_chat: context.raw_chat || null,
      })
      .select("id")
      .single();

    if (ctxError) {
      console.error("Context insert error:", ctxError);
      return new Response(
        JSON.stringify({ error: "Failed to save story context" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Save story_script
    const { data: scriptData, error: scriptError } = await supabase
      .from("story_scripts")
      .insert({
        user_id,
        context_id: ctxData.id,
        title: story.title,
        synopsis: story.synopsis,
        voice_id: voiceId,
        scene_count: story.scenes.length,
        status: "generated",
        character_image_url: context.character_image_url || null,
      })
      .select("id")
      .single();

    if (scriptError) {
      console.error("Script insert error:", scriptError);
      return new Response(
        JSON.stringify({ error: "Failed to save story script" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Save scenes
    const scenesInsert = story.scenes.map((s: any) => ({
      script_id: scriptData.id,
      scene_number: s.scene_number,
      narration_text: s.narration_text,
      visual_prompt: s.visual_prompt,
      duration_seconds: s.duration_seconds,
    }));

    const { error: scenesError } = await supabase
      .from("story_scenes")
      .insert(scenesInsert);

    if (scenesError) {
      console.error("Scenes insert error:", scenesError);
      return new Response(
        JSON.stringify({ error: "Failed to save story scenes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Add to library
    await supabase.from("story_library").insert({
      user_id,
      script_id: scriptData.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        script_id: scriptData.id,
        title: story.title,
        synopsis: story.synopsis,
        voice_id: voiceId,
        scene_count: story.scenes.length,
        scenes: story.scenes,
        character_image_url: context.character_image_url || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("story-generate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

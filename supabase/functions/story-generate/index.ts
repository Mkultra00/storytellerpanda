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
    const { context, user_id } = await req.json();
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

    const generatePrompt = `Create a children's story based on the following context. Output ONLY valid JSON with no other text.

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

Create a story with exactly ${sceneCount} scenes. Each scene should have narration text suitable for a ${context.child_age}-year-old and a detailed visual prompt for illustration generation.

The narration should be engaging, age-appropriate, and incorporate the child's name as the main character. Each scene's narration should be 2-4 sentences.

Return this JSON structure:
{
  "title": "Story title",
  "synopsis": "A brief 1-2 sentence summary",
  "voice_style": "warm_female|warm_male|playful_female|playful_male",
  "scenes": [
    {
      "scene_number": 1,
      "narration_text": "The narration text for this scene...",
      "visual_prompt": "A detailed illustration prompt: [style: warm children's book watercolor illustration] [scene description with specific details, colors, lighting, composition]",
      "duration_seconds": 20
    }
  ]
}`;

    // Call Gemini via tool calling for structured output
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-pro-preview",
          messages: [
            {
              role: "system",
              content:
                "You are a master children's story writer. Create enchanting, age-appropriate stories with vivid imagery. Always respond with valid JSON only.",
            },
            { role: "user", content: generatePrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_story",
                description: "Create a complete children's story with scenes",
                parameters: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "The story title" },
                    synopsis: { type: "string", description: "Brief 1-2 sentence summary" },
                    voice_style: {
                      type: "string",
                      enum: ["warm_female", "warm_male", "playful_female", "playful_male"],
                    },
                    scenes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          scene_number: { type: "number" },
                          narration_text: { type: "string" },
                          visual_prompt: { type: "string" },
                          duration_seconds: { type: "number" },
                        },
                        required: ["scene_number", "narration_text", "visual_prompt", "duration_seconds"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["title", "synopsis", "voice_style", "scenes"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "create_story" } },
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
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in response:", JSON.stringify(aiResult));
      return new Response(
        JSON.stringify({ error: "Failed to generate structured story" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const story = JSON.parse(toolCall.function.arguments);

    // Map voice_style to ElevenLabs voice ID
    const voiceMap: Record<string, string> = {
      warm_female: "EXAVITQu4vr4xnSDxMaL",   // Sarah
      warm_male: "JBFqnCBsd6RMkjVDRZzb",       // George
      playful_female: "XB0fDUnXU5powFXDhCwa",   // Charlotte
      playful_male: "TX3LPaxmHKxFdv7VOQHJ",    // Liam
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

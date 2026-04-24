import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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
    const { visual_prompt, scene_id, script_id, character_image_url, previous_image_url } = await req.json();

    if (!visual_prompt) {
      return new Response(
        JSON.stringify({ error: "Missing visual_prompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Generating image for scene ${scene_id}, prompt: ${visual_prompt.slice(0, 80)}..., character ref: ${!!character_image_url}, previous ref: ${!!previous_image_url}`);

    // Build instruction text. Reference images are explained explicitly so the
    // model knows what each one is for (character likeness vs. style continuity).
    const refNotes: string[] = [];
    if (character_image_url) {
      refNotes.push(
        "REFERENCE IMAGE 1 is a photo of the real-life main character. Match their face, hair, skin tone, and features, but render them in the illustration style."
      );
    }
    if (previous_image_url) {
      refNotes.push(
        `REFERENCE IMAGE ${character_image_url ? 2 : 1} is the previous scene's illustration. Keep ALL recurring characters visually identical to how they appear there — same species, body shape, hair/fur color, outfit, colors, and art style. Only change pose, expression, and setting as the new scene requires.`
      );
    }

    const textPrompt = `Generate a beautiful children's book illustration: ${visual_prompt}.

Style: warm watercolor illustration with soft edges, vibrant but gentle colors, suitable for a children's storybook. Whimsical and enchanting. Do not include any text in the image.

${refNotes.join("\n\n")}

CRITICAL: Characters described in the prompt or shown in reference images must look CONSISTENT across every scene of this story — same design, colors, and proportions every time.`.trim();

    const messageContent: any[] = [{ type: "text", text: textPrompt }];
    if (character_image_url) {
      messageContent.push({ type: "image_url", image_url: { url: character_image_url } });
    }
    if (previous_image_url) {
      messageContent.push({ type: "image_url", image_url: { url: previous_image_url } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: messageContent,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    let imageData: string | undefined;

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI gateway image error [${response.status}]:`, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please retry." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Likely content policy violation — try a sanitized fallback prompt
      console.warn("Original prompt failed, attempting policy-safe fallback...");
    } else {
      const result = await response.json();
      imageData = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!imageData) {
        console.warn("No image in response, attempting policy-safe fallback. Response:", JSON.stringify(result).slice(0, 200));
      }
    }

    // If we didn't get an image, retry with a sanitized "suggestive but compliant" prompt
    if (!imageData) {
      const fallbackPrompt = `Create an atmospheric, symbolic illustration that hints at the following scene without showing anything explicit or graphic. Use dramatic lighting, shadows, silhouettes, and metaphorical imagery to convey the mood and tension. Scene context: ${visual_prompt}. Style: moody cinematic illustration with heavy use of shadows, silhouettes, fog, and symbolic elements. No gore, no nudity, no explicit violence — only suggestion and atmosphere. Dark color palette with dramatic lighting.`;

      console.log("Fallback prompt:", fallbackPrompt.slice(0, 100));

      const fallbackResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image-preview",
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: fallbackPrompt }],
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (fallbackResponse.ok) {
        const fallbackResult = await fallbackResponse.json();
        imageData = fallbackResult.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      }

      if (!imageData) {
        console.error("Fallback image generation also failed");
        return new Response(
          JSON.stringify({ error: "Image generation failed even with fallback" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Successfully generated fallback image");
    }

    // Upload to Supabase Storage if we have script/scene IDs
    if (script_id && scene_id) {
      const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
      if (base64Match) {
        const ext = base64Match[1] === "jpeg" ? "jpg" : base64Match[1];
        const rawBase64 = base64Match[2];
        const imageBytes = base64Decode(rawBase64);

        const filePath = `${script_id}/${scene_id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("story-assets")
          .upload(filePath, imageBytes, {
            contentType: `image/${base64Match[1]}`,
            upsert: true,
          });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from("story-assets")
            .getPublicUrl(filePath);

          const { error: updateError } = await supabase
            .from("story_scenes")
            .update({ image_url: urlData.publicUrl })
            .eq("id", scene_id);

          if (updateError) {
            console.error("Scene update error:", updateError);
          }

          console.log(`Image uploaded: ${urlData.publicUrl}`);

          return new Response(
            JSON.stringify({
              success: true,
              image_url: urlData.publicUrl,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Fallback: return the data URI directly
    return new Response(
      JSON.stringify({ success: true, image_url: imageData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-scene-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
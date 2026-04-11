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
    const { visual_prompt, scene_id, script_id } = await req.json();

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

    console.log(`Generating image for scene ${scene_id}, prompt: ${visual_prompt.slice(0, 80)}...`);

    // Use Lovable AI Gateway with Nano Banana 2 for fast + quality image gen
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
            content: `Generate a beautiful children's book illustration: ${visual_prompt}. Style: warm watercolor illustration with soft edges, vibrant but gentle colors, suitable for a children's storybook. The image should be whimsical and enchanting. Do not include any text in the image.`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

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
      return new Response(
        JSON.stringify({ error: "Image generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const imageData = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData) {
      console.error("No image in response:", JSON.stringify(result).slice(0, 200));
      return new Response(
        JSON.stringify({ error: "No image generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload to Supabase Storage if we have script/scene IDs
    if (script_id && scene_id) {
      // Extract base64 data from data URI
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

          // Update scene with image URL
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

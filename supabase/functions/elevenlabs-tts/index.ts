import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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
    const { text, voice_id, scene_id, script_id, previous_text, next_text } = await req.json();

    if (!text || !voice_id) {
      return new Response(
        JSON.stringify({ error: "Missing text or voice_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build request body with optional stitching context
    const ttsBody: Record<string, unknown> = {
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.6,
        similarity_boost: 0.75,
        style: 0.4,
        use_speaker_boost: true,
        speed: 0.95,
      },
    };
    if (previous_text) ttsBody.previous_text = previous_text;
    if (next_text) ttsBody.next_text = next_text;

    console.log(`Generating TTS for scene ${scene_id}, text length: ${text.length}`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ttsBody),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`ElevenLabs error [${response.status}]:`, errText);
      return new Response(
        JSON.stringify({ error: `TTS generation failed: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`Audio generated: ${audioBuffer.byteLength} bytes`);

    // Upload to Supabase Storage
    if (script_id && scene_id) {
      const filePath = `${script_id}/${scene_id}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from("story-assets")
        .upload(filePath, audioBuffer, {
          contentType: "audio/mpeg",
          upsert: true,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
      } else {
        const { data: urlData } = supabase.storage
          .from("story-assets")
          .getPublicUrl(filePath);

        // Update scene with audio URL
        const { error: updateError } = await supabase
          .from("story_scenes")
          .update({ audio_url: urlData.publicUrl })
          .eq("id", scene_id);

        if (updateError) {
          console.error("Scene update error:", updateError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            audio_url: urlData.publicUrl,
            size_bytes: audioBuffer.byteLength,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fallback: return audio as base64
    const audioBase64 = base64Encode(audioBuffer);
    return new Response(
      JSON.stringify({ success: true, audio_base64: audioBase64 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("elevenlabs-tts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

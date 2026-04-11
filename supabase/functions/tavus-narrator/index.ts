import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { story_title, story_synopsis, child_name } = await req.json();

    const TAVUS_API_KEY = Deno.env.get("TAVUS_API_KEY");
    if (!TAVUS_API_KEY) throw new Error("TAVUS_API_KEY is not configured");

    // Step 1: Create a persona for this story narration
    const personaResp = await fetch("https://tavusapi.com/v2/personas", {
      method: "POST",
      headers: {
        "x-api-key": TAVUS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        persona_name: `Xiaobi Narrator - ${story_title}`,
        system_prompt: `You are Xiaobi, a warm and friendly storytelling panda narrator. You just finished creating a magical story called "${story_title}" for a child named ${child_name || "a special child"}. The story is about: ${story_synopsis || "a magical adventure"}.

You are excited to present this story! Be warm, enthusiastic, and speak as if talking to a young child's parent. Keep responses short (1-2 sentences). If they ask about the story, share fun details. You can encourage them to press "Play" to hear the full narrated story with illustrations.`,
        context: `Story title: ${story_title}. Synopsis: ${story_synopsis}. Created for: ${child_name || "a child"}.`,
        default_replica_id: "r79e1c033f", // Tavus stock replica
        layers: {
          llm: {
            model: "tavus-llama",
          },
        },
      }),
    });

    if (!personaResp.ok) {
      const errText = await personaResp.text();
      console.error("Tavus persona creation failed:", personaResp.status, errText);
      throw new Error("Failed to create narrator persona");
    }

    const persona = await personaResp.json();
    const personaId = persona.persona_id;

    // Step 2: Create a conversation with this persona
    const convResp = await fetch("https://tavusapi.com/v2/conversations", {
      method: "POST",
      headers: {
        "x-api-key": TAVUS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        persona_id: personaId,
        conversation_name: `Story: ${story_title}`,
        custom_greeting: `Hi there! 🌟 I'm Xiaobi, and I just finished crafting "${story_title}" — a magical adventure for ${child_name || "your little one"}! Would you like to hear about it?`,
      }),
    });

    if (!convResp.ok) {
      const errText = await convResp.text();
      console.error("Tavus conversation creation failed:", convResp.status, errText);
      throw new Error("Failed to start narrator conversation");
    }

    const conversation = await convResp.json();

    return new Response(
      JSON.stringify({
        conversation_id: conversation.conversation_id,
        conversation_url: conversation.conversation_url,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("tavus-narrator error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

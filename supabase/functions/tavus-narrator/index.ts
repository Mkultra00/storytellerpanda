import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FEMALE_VOICE_IDS = new Set([
  "EXAVITQu4vr4xnSDxMaL", // Sarah
  "XB0fDUnXU5powFXDhCwa", // Charlotte
]);

const FEMALE_REPLICA_IDS = [
  "r90bbd427f71", // Anna
  "r7bc3db0d581", // Sabrina
  "re0eae1fbe11", // Lucy
];

const MALE_REPLICA_IDS = [
  "rf25acd9e3f5", // Patrick
  "r1a4e22fa0d9", // Benjamin
  "re2185788693", // Nathan
  "r874cc5f8a3b", // Lucas
];

async function createPersona({
  apiKey,
  storyTitle,
  storySynopsis,
  childName,
  replicaId,
}: {
  apiKey: string;
  storyTitle: string;
  storySynopsis?: string;
  childName?: string;
  replicaId: string;
}) {
  const response = await fetch("https://tavusapi.com/v2/personas", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      persona_name: `Xiaobi Narrator - ${storyTitle}`.slice(0, 120),
      system_prompt: `You are Xiaobi, a warm and friendly storytelling panda narrator. You just finished creating a magical story called "${storyTitle}" for a child named ${childName || "a special child"}. The story is about: ${storySynopsis || "a magical adventure"}.

You are excited to present this story. Be warm, enthusiastic, and speak as if talking to a young child's parent. Keep responses short (1-2 sentences). If they ask about the story, share fun details. You can encourage them to press Play to hear the full narrated story with illustrations.`,
      context: `Story title: ${storyTitle}. Synopsis: ${storySynopsis || "n/a"}. Created for: ${childName || "a child"}.`,
      default_replica_id: replicaId,
      layers: {
        llm: {
          model: "tavus-gemini-2.5-flash",
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { ok: false as const, status: response.status, errorText };
  }

  const persona = await response.json();
  return { ok: true as const, personaId: persona.persona_id as string };
}

async function createConversation({
  apiKey,
  personaId,
  storyTitle,
  childName,
}: {
  apiKey: string;
  personaId: string;
  storyTitle: string;
  childName?: string;
}) {
  const response = await fetch("https://tavusapi.com/v2/conversations", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      persona_id: personaId,
      conversation_name: `Story: ${storyTitle}`.slice(0, 120),
      custom_greeting: `Hi there! 🌟 I'm Xiaobi, and I just finished crafting "${storyTitle}" — a magical adventure for ${childName || "your little one"}! Would you like to hear about it?`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { ok: false as const, status: response.status, errorText };
  }

  const conversation = await response.json();
  return {
    ok: true as const,
    conversationId: conversation.conversation_id as string,
    conversationUrl: conversation.conversation_url as string,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const storyTitle = typeof body?.story_title === "string" ? body.story_title.trim() : "";
    const storySynopsis = typeof body?.story_synopsis === "string" ? body.story_synopsis.trim() : undefined;
    const childName = typeof body?.child_name === "string" ? body.child_name.trim() : undefined;
    const voiceId = typeof body?.voice_id === "string" ? body.voice_id.trim() : undefined;

    if (!storyTitle) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing story_title", fallback: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const TAVUS_API_KEY = Deno.env.get("TAVUS_API_KEY");
    if (!TAVUS_API_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: "Tavus narrator is not configured", fallback: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prefersFemale = !voiceId || FEMALE_VOICE_IDS.has(voiceId);
    const replicaCandidates = prefersFemale
      ? [...FEMALE_REPLICA_IDS, ...MALE_REPLICA_IDS]
      : [...MALE_REPLICA_IDS, ...FEMALE_REPLICA_IDS];

    let lastError = "Unknown Tavus error";

    for (const replicaId of replicaCandidates) {
      const personaResult = await createPersona({
        apiKey: TAVUS_API_KEY,
        storyTitle,
        storySynopsis,
        childName,
        replicaId,
      });

      if (!personaResult.ok) {
        lastError = personaResult.errorText;
        console.error("Tavus persona creation failed:", personaResult.status, replicaId, personaResult.errorText);
        continue;
      }

      const conversationResult = await createConversation({
        apiKey: TAVUS_API_KEY,
        personaId: personaResult.personaId,
        storyTitle,
        childName,
      });

      if (!conversationResult.ok) {
        lastError = conversationResult.errorText;
        console.error("Tavus conversation creation failed:", conversationResult.status, replicaId, conversationResult.errorText);
        continue;
      }

      return new Response(
        JSON.stringify({
          ok: true,
          conversation_id: conversationResult.conversationId,
          conversation_url: conversationResult.conversationUrl,
          replica_id: replicaId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Tavus narrator is temporarily unavailable",
        fallback: true,
        diagnostics: {
          voice_id: voiceId || null,
          attempted_replicas: replicaCandidates,
          last_error: lastError,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("tavus-narrator error:", e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: e instanceof Error ? e.message : "Unknown error",
        fallback: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
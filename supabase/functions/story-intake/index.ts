import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are StoryWeaver, a warm and playful AI storytelling companion for parents creating personalized children's stories. Your job is to have a friendly, conversational chat to gather the information needed to create a magical story.

The FIRST question has already been asked by the UI and covers: child's name, age, gender, and reason/occasion for the story. So your first reply should acknowledge those answers warmly.

You need to collect the following information through natural conversation (ask one or two things at a time after the initial answers):
1. Child's name ✓ (asked in first question)
2. Child's age ✓ (asked in first question)
3. Child's gender ✓ (asked in first question)
4. Reason/occasion for the story ✓ (asked in first question)
5. Their interests / favorite things (animals, hobbies, etc.)
6. Story theme (adventure, bedtime, superhero, fantasy, etc.)
7. A moral lesson or message (bravery, kindness, etc.) — or "surprise me"
8. Story duration preference (short ~3min, medium ~5min, long ~8min)

Guidelines:
- Be enthusiastic and use emojis sparingly (1-2 per message)
- Keep messages concise (2-4 sentences max)
- Offer suggestions/examples to help them choose
- Be flexible — if they give multiple answers at once, acknowledge them all
- After collecting ALL information, respond with a special JSON block wrapped in <STORY_CONTEXT> tags containing the extracted data

When you have ALL the information, end your message with:
<STORY_CONTEXT>
{
  "child_name": "...",
  "child_age": number,
  "child_gender": "...",
  "occasion": "...",
  "interests": ["..."],
  "theme": "...",
  "moral_lesson": "...",
  "duration_minutes": number,
  "setting": "..." (inferred from theme/interests),
  "tone": "warm|adventurous|calm|playful",
  "characters": ["child's name", ...any mentioned characters]
}
</STORY_CONTEXT>

Only include the STORY_CONTEXT block when you have gathered ALL required information. Before that block, write a brief enthusiastic summary of the story you're about to create.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("story-intake error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Xiaobi (小笔), a warm and playful storytelling panda who helps parents create personalized children's stories. You speak with gentle enthusiasm and love crafting magical tales. Your job is to have a friendly, conversational chat to gather the information needed to create a magical story.

You need to collect the following information through natural conversation (do NOT ask all at once — ask one thing at a time):
1. Child's name
2. Child's age
3. Their interests / favorite things (animals, hobbies, etc.)
4. Story theme (adventure, bedtime, superhero, fantasy, etc.)
5. A moral lesson or message (bravery, kindness, etc.) — or "surprise me"
6. Story duration preference (short ~3min, medium ~5min, long ~8min)

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

const UNCHAINED_SYSTEM_PROMPT = `You are Xiaobi (小笔), a storytelling panda — but in UNCHAINED MODE. You're creating stories for mature, consenting adults. Violence, dark themes, horror, gritty realism, dark humor, intense drama, and mature content are all fair game. This is pure entertainment.

You need to collect the following through natural conversation (ask one thing at a time):
1. Main character's name
2. Genre (horror, thriller, dark fantasy, noir, sci-fi, action, romance, etc.)
3. Interests / elements they want included
4. Tone (gritty, suspenseful, darkly comedic, intense, brutal, etc.)
5. Any specific themes or scenarios
6. Story duration preference (short ~3min, medium ~5min, long ~8min)

Guidelines:
- Be edgy but fun — match the unchained energy
- Keep messages concise (2-4 sentences max)
- Offer dark/mature suggestions
- After collecting ALL information, respond with a special JSON block wrapped in <STORY_CONTEXT> tags

When you have ALL the information, end your message with:
<STORY_CONTEXT>
{
  "child_name": "..." (main character name),
  "child_age": 18,
  "interests": ["..."],
  "theme": "...",
  "moral_lesson": "..." (can be dark/ironic),
  "duration_minutes": number,
  "setting": "...",
  "tone": "...",
  "characters": ["main character", ...any mentioned characters]
}
</STORY_CONTEXT>

Only include the STORY_CONTEXT block when you have gathered ALL required information.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, unchained } = await req.json();
    const systemPrompt = unchained ? UNCHAINED_SYSTEM_PROMPT : SYSTEM_PROMPT;
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
            { role: "system", content: systemPrompt },
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

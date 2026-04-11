

# StoryWeaver AI — Build Plan

## Updated Tech Stack

Based on your preferences, here's the revised stack:

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Lovable (React/Vite/Tailwind) | As designed |
| **Backend/DB** | Supabase (Postgres, Auth, Edge Functions, Storage) | As designed |
| **LLM (Intake + Story Gen)** | Google Gemini 3 Pro (`google/gemini-3.1-pro-preview`) via Lovable AI Gateway | Replaces Claude. LOVABLE_API_KEY already available |
| **Voice Synthesis** | ElevenLabs (Turbo v2.5, streaming) | You have 3 ElevenLabs connections in your workspace — we'll link one |
| **Video Avatar** | Tavus CVI API (WebRTC) | Deferred to Phase 5 per doc; Lottie fallback in MVP |
| **Image Generation** | OpenAI DALL-E 3 (via Lovable AI Gateway image gen or direct OpenAI API) | Replaces Flux/Replicate. Will need OPENAI_API_KEY secret |
| **Storage/CDN** | Supabase Storage | Generated audio + images cached for replay |

## API Keys Needed

- **LOVABLE_API_KEY** — already configured (for Gemini via gateway)
- **ElevenLabs** — connector available, needs linking to project
- **OPENAI_API_KEY** — needed for DALL-E 3 image generation; you'll need to provide this
- **TAVUS_API_KEY** — needed later for video avatar (Phase 5)

## Build Phases

### Phase 1: Foundation (Weeks 1–2)
- Enable Lovable Cloud + Supabase
- Link ElevenLabs connector
- Set up Supabase schema: `profiles`, `story_contexts`, `story_scripts`, `story_scenes`, `story_library`
- Auth (Supabase Auth with email + Google)
- Design system: warm navy (#1B2D4F), soft gold (#F4C753), cloud white (#FAFBFC), coral (#FF8A80), Nunito + Inter, 16px rounded corners
- Welcome/Home screen UI
- Story Intake chat UI with conversational flow

### Phase 2: Story Generation Pipeline (Weeks 3–4)
- Edge function: `story-intake` — Gemini-powered conversational agent that collects Story Context Object
- Edge function: `story-generate` — Gemini generates Story Script Document (scenes, narration text, visual directions, persona/voice selection)
- Story Preview/Confirmation screen
- Generation Loading screen with progress animations

### Phase 3: Rendering Pipeline (Weeks 5–6)
- Edge function: `elevenlabs-tts` — streaming narration per scene using ElevenLabs
- Edge function: `generate-scene-image` — DALL-E 3 scene illustrations with style-consistent prompts
- Parallel scene pre-generation (look-ahead buffer of 2 scenes)
- Cache audio + images to Supabase Storage

### Phase 4: Playback & Library (Weeks 7–8)
- Narration Screen: full-screen canvas with image crossfade transitions, audio playback, synced controls
- Playback Coordinator (React state machine): play/pause, rewind, skip, volume, speed, captions
- Lottie animated avatar placeholder (PiP overlay) as Tavus fallback
- Story Library screen with replay, grid view, filters
- Mobile-responsive layouts
- Content safety filters on generation

### Phase 5: Tavus + Polish (Weeks 9–10)
- Tavus CVI integration (WebRTC iframe, lip-sync with ElevenLabs audio)
- Accessibility audit (ARIA, keyboard nav, reduced motion, captions)
- Performance optimization
- Beta prep

## Technical Details

**Gemini via Lovable AI Gateway**: All LLM calls go through edge functions calling `https://ai.gateway.lovable.dev/v1/chat/completions` with model `google/gemini-3.1-pro-preview`. Streaming for intake chat, non-streaming for story script generation (structured output via tool calling).

**ElevenLabs**: Linked via connector. Edge function calls `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream` with the connector's API key. Returns binary audio streamed to client.

**DALL-E 3**: Edge function calls OpenAI Images API directly (`https://api.openai.com/v1/images/generations`) with the OPENAI_API_KEY secret. Returns image URLs, downloaded and cached to Supabase Storage.

**Tavus**: Deferred to Phase 5. MVP uses a Lottie-animated character overlay with audio-reactive mouth animation.

## Immediate Next Steps

1. Link your ElevenLabs connector to this project
2. You provide an OpenAI API key for DALL-E 3
3. Enable Lovable Cloud (Supabase)
4. Begin Phase 1: schema + design system + home screen + intake UI


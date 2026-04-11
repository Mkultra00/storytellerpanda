
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  child_name TEXT,
  child_age INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Story Contexts
CREATE TABLE public.story_contexts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  child_name TEXT,
  child_age INTEGER,
  interests TEXT[],
  theme TEXT,
  moral_lesson TEXT,
  characters TEXT[],
  setting TEXT,
  tone TEXT DEFAULT 'warm',
  duration_minutes INTEGER DEFAULT 5,
  raw_chat JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.story_contexts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own contexts" ON public.story_contexts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contexts" ON public.story_contexts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Story Scripts
CREATE TABLE public.story_scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  context_id UUID REFERENCES public.story_contexts(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  synopsis TEXT,
  scene_count INTEGER NOT NULL DEFAULT 1,
  voice_id TEXT DEFAULT 'JBFqnCBsd6RMkjVDRZzb',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','generating','ready','error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.story_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own scripts" ON public.story_scripts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scripts" ON public.story_scripts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scripts" ON public.story_scripts FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_scripts_updated_at BEFORE UPDATE ON public.story_scripts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Story Scenes
CREATE TABLE public.story_scenes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  script_id UUID REFERENCES public.story_scripts(id) ON DELETE CASCADE NOT NULL,
  scene_number INTEGER NOT NULL,
  narration_text TEXT NOT NULL,
  visual_prompt TEXT,
  image_url TEXT,
  audio_url TEXT,
  duration_seconds NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.story_scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own scenes" ON public.story_scenes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.story_scripts s WHERE s.id = script_id AND s.user_id = auth.uid())
);
CREATE POLICY "Users can insert own scenes" ON public.story_scenes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.story_scripts s WHERE s.id = script_id AND s.user_id = auth.uid())
);
CREATE POLICY "Users can update own scenes" ON public.story_scenes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.story_scripts s WHERE s.id = script_id AND s.user_id = auth.uid())
);

-- Story Library
CREATE TABLE public.story_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  script_id UUID REFERENCES public.story_scripts(id) ON DELETE CASCADE NOT NULL,
  is_favorite BOOLEAN DEFAULT false,
  play_count INTEGER DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, script_id)
);
ALTER TABLE public.story_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own library" ON public.story_library FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own library" ON public.story_library FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own library" ON public.story_library FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own library" ON public.story_library FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for story assets
INSERT INTO storage.buckets (id, name, public) VALUES ('story-assets', 'story-assets', true);
CREATE POLICY "Story assets are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'story-assets');
CREATE POLICY "Authenticated users can upload story assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'story-assets' AND auth.role() = 'authenticated');

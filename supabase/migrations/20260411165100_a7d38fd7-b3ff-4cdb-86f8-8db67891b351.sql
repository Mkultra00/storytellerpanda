-- Allow all inserts/selects/updates on story tables while auth is disabled
CREATE POLICY "Allow all inserts (dev)" ON public.story_contexts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all selects (dev)" ON public.story_contexts FOR SELECT USING (true);

CREATE POLICY "Allow all inserts (dev)" ON public.story_scripts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all selects (dev)" ON public.story_scripts FOR SELECT USING (true);
CREATE POLICY "Allow all updates (dev)" ON public.story_scripts FOR UPDATE USING (true);

CREATE POLICY "Allow all inserts (dev)" ON public.story_scenes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all selects (dev)" ON public.story_scenes FOR SELECT USING (true);
CREATE POLICY "Allow all updates (dev)" ON public.story_scenes FOR UPDATE USING (true);

CREATE POLICY "Allow all inserts (dev)" ON public.story_library FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all selects (dev)" ON public.story_library FOR SELECT USING (true);
CREATE POLICY "Allow all updates (dev)" ON public.story_library FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes (dev)" ON public.story_library FOR DELETE USING (true);
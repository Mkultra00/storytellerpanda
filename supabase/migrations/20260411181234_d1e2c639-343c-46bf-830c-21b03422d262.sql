
CREATE POLICY "Anyone can upload to story-assets"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'story-assets');

CREATE POLICY "Anyone can read story-assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'story-assets');

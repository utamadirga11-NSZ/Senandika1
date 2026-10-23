CREATE TABLE public.creations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  type TEXT NOT NULL CHECK (type IN ('gambar','video','tulisan','audio')),
  title TEXT NOT NULL DEFAULT 'Karya baru',
  description TEXT NOT NULL DEFAULT '',
  content_text TEXT,
  file_path TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creations TO authenticated;
GRANT ALL ON public.creations TO service_role;
ALTER TABLE public.creations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public creations readable" ON public.creations FOR SELECT TO authenticated USING (is_public OR user_id = auth.uid());
CREATE POLICY "own creations insert" ON public.creations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own creations update" ON public.creations FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own creations delete" ON public.creations FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.creation_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creation_id UUID NOT NULL REFERENCES public.creations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (creation_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.creation_likes TO authenticated;
GRANT ALL ON public.creation_likes TO service_role;
ALTER TABLE public.creation_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes readable on visible creations" ON public.creation_likes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.creations c WHERE c.id = creation_id AND (c.is_public OR c.user_id = auth.uid())));
CREATE POLICY "own likes insert" ON public.creation_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.creations c WHERE c.id = creation_id AND c.is_public));
CREATE POLICY "own likes delete" ON public.creation_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.creation_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creation_id UUID NOT NULL REFERENCES public.creations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.creation_comments TO authenticated;
GRANT ALL ON public.creation_comments TO service_role;
ALTER TABLE public.creation_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments readable on visible creations" ON public.creation_comments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.creations c WHERE c.id = creation_id AND (c.is_public OR c.user_id = auth.uid())));
CREATE POLICY "own comments insert" ON public.creation_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.creations c WHERE c.id = creation_id AND c.is_public));
CREATE POLICY "own comments delete" ON public.creation_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "creations files readable" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'creations');
CREATE POLICY "creations files insert own folder" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'creations' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "creations files delete own folder" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'creations' AND (storage.foldername(name))[1] = auth.uid()::text);
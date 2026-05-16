-- Cria bucket publico "vitrine-photos" pra armazenar fotos de perfil das
-- paginas /p/[slug]. Bucket public=true permite leitura via CDN sem RLS
-- (URL no formato /storage/v1/object/public/vitrine-photos/<path>).
-- Escrita: feita SOMENTE pelo backend via service_role (rota
-- /api/painel/vitrine/photo). Browser nao escreve direto no bucket.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vitrine-photos',
  'vitrine-photos',
  true,
  2 * 1024 * 1024, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

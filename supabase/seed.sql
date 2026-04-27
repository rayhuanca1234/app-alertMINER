-- Canal principal de comunicación comunitaria
INSERT INTO channels (id, name, description) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'General', 'Canal principal de comunicación comunitaria para mineros de Puerto Maldonado'),
  ('00000000-0000-0000-0000-000000000002', 'Alertas', 'Canal automático de alertas de seguridad'),
  ('00000000-0000-0000-0000-000000000003', 'Coordinación', 'Canal de coordinación y logística');

-- Crear bucket de storage para media del chat (ejecutar en SQL Editor)
-- Nota: Los buckets de Storage se crean desde el panel de Supabase > Storage > New Bucket
-- Nombre: chat-media, Public: true

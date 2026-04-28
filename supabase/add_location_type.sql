-- =============================================
-- MIGRACIÓN: Añadir tipo LOCATION a messages
-- Pega este SQL en el Editor SQL de Supabase y dale Run
-- =============================================

-- Quitar el CHECK constraint viejo
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;

-- Crear el nuevo CHECK constraint que incluye LOCATION
ALTER TABLE messages 
  ADD CONSTRAINT messages_type_check 
  CHECK (type IN ('TEXT','IMAGE','VIDEO','AUDIO','LOCATION'));

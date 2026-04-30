-- Add new columns for multiple media and file metadata
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS media_urls jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS file_metadata jsonb DEFAULT '{}'::jsonb;

-- Drop check constraint if it exists to allow new types
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'messages_type_check' 
    AND conrelid = 'messages'::regclass
  ) THEN
    ALTER TABLE messages DROP CONSTRAINT messages_type_check;
  END IF;
END $$;

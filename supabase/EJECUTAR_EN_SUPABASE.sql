-- =============================================
-- MINERALERT - SCRIPT COMPLETO DE BASE DE DATOS
-- Copia TODO este contenido y pégalo en el
-- SQL Editor de Supabase, luego dale a "Run"
-- =============================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLAS
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) PRIMARY KEY,
  name text NOT NULL DEFAULT 'Minero',
  phone text,
  avatar_url text,
  is_verified boolean DEFAULT false,
  sound_enabled boolean DEFAULT true,
  share_location boolean DEFAULT true,
  push_subscription jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  location geography(POINT, 4326),
  latitude float8 NOT NULL,
  longitude float8 NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '2 hours'
);

CREATE TABLE IF NOT EXISTS channels (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  channel_id uuid REFERENCES channels(id),
  type text CHECK (type IN ('TEXT','IMAGE','VIDEO','AUDIO')) DEFAULT 'TEXT',
  content text,
  media_url text,
  created_at timestamptz DEFAULT now()
);

-- 3. INDICES
CREATE INDEX IF NOT EXISTS idx_alerts_location ON alerts USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at DESC);

-- 4. ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_select_own') THEN
    CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_update_own') THEN
    CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_insert_own') THEN
    CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Alerts policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'alerts_select_all') THEN
    CREATE POLICY "alerts_select_all" ON alerts FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'alerts_insert_own') THEN
    CREATE POLICY "alerts_insert_own" ON alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'alerts_update_own') THEN
    CREATE POLICY "alerts_update_own" ON alerts FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Channels policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'channels_select_all') THEN
    CREATE POLICY "channels_select_all" ON channels FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'channels_insert_auth') THEN
    CREATE POLICY "channels_insert_auth" ON channels FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- Messages policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'messages_select_all') THEN
    CREATE POLICY "messages_select_all" ON messages FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'messages_insert_auth') THEN
    CREATE POLICY "messages_insert_auth" ON messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- 5. FUNCION PostGIS
CREATE OR REPLACE FUNCTION get_nearby_alerts(
  user_lat float8, user_lon float8, radius_km float8 DEFAULT 5
) RETURNS TABLE(
  id uuid, user_id uuid, latitude float8, longitude float8,
  description text, is_active bool, created_at timestamptz,
  distance_km float8
) AS $$
  SELECT a.id, a.user_id, a.latitude, a.longitude, a.description,
    a.is_active, a.created_at,
    ST_Distance(a.location::geography,
      ST_SetSRID(ST_MakePoint(user_lon, user_lat),4326)::geography) / 1000 AS distance_km
  FROM alerts a
  WHERE a.is_active = true
    AND a.expires_at > now()
    AND ST_DWithin(a.location::geography,
      ST_SetSRID(ST_MakePoint(user_lon, user_lat),4326)::geography,
      radius_km * 1000)
  ORDER BY distance_km ASC;
$$ LANGUAGE sql SECURITY DEFINER;

-- 6. DATOS INICIALES (Canales)
INSERT INTO channels (id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'General', 'Canal principal de comunicación comunitaria'),
  ('00000000-0000-0000-0000-000000000002', 'Alertas', 'Canal automático de alertas de seguridad'),
  ('00000000-0000-0000-0000-000000000003', 'Coordinación', 'Canal de coordinación y logística')
ON CONFLICT (id) DO NOTHING;

-- 7. HABILITAR REALTIME en las tablas
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;

-- ¡LISTO! Ahora ve a Storage en Supabase y crea un bucket llamado "chat-media" con acceso público.

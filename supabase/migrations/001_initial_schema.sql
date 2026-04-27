-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tablas

-- 1. profiles
CREATE TABLE profiles (
  id uuid REFERENCES auth.users(id) PRIMARY KEY,
  name text NOT NULL,
  phone text,
  avatar_url text,
  is_verified boolean DEFAULT false,
  sound_enabled boolean DEFAULT true,
  share_location boolean DEFAULT true,
  push_subscription jsonb,
  created_at timestamptz DEFAULT now()
);

-- 2. alerts
CREATE TABLE alerts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  location geography(POINT, 4326) NOT NULL,
  latitude float8 NOT NULL,
  longitude float8 NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '2 hours'
);
CREATE INDEX idx_alerts_location ON alerts USING GIST(location);
CREATE INDEX idx_alerts_active ON alerts(is_active, created_at DESC);

-- 3. channels
CREATE TABLE channels (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- 4. messages
CREATE TABLE messages (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  channel_id uuid REFERENCES channels(id),
  type text CHECK (type IN ('TEXT','IMAGE','VIDEO','AUDIO')) DEFAULT 'TEXT',
  content text,
  media_url text,
  created_at timestamptz DEFAULT now()
);

-- RLS Policies

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- profiles: usuarios solo ven/editan su propio perfil
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- alerts: todos los users autenticados pueden leer, solo el dueño puede crear/desactivar
CREATE POLICY "Authenticated users can read alerts" ON alerts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert own alerts" ON alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON alerts FOR UPDATE USING (auth.uid() = user_id);

-- channels: todos los autenticados pueden leer
CREATE POLICY "Authenticated users can read channels" ON channels FOR SELECT USING (auth.role() = 'authenticated');

-- messages: todos los autenticados pueden leer y crear
CREATE POLICY "Authenticated users can read messages" ON messages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert messages" ON messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Función PostGIS para buscar alertas cercanas
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

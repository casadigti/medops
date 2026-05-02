-- =============================================================================
-- SETUP INICIAL DE PERFILES - MEDOPS
-- Ejecutar en el SQL Editor de Supabase
-- =============================================================================

-- PASO 1: Crear la tabla profiles si no existe (con todos los campos necesarios)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'Lector',
  is_active BOOLEAN DEFAULT true,
  must_change_password BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- PASO 2: Insertar/actualizar tu perfil de administrador
-- (Esto toma el ID de tu usuario autenticado y lo inserta en profiles)
INSERT INTO profiles (id, full_name, email, role, is_active, must_change_password)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'full_name', email) as full_name,
  email,
  'Superadmin' as role,
  true as is_active,
  false as must_change_password
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  role = 'Superadmin',
  is_active = true,
  must_change_password = false,
  updated_at = now();

-- PASO 3: Crear un trigger para auto-crear perfiles en futuros registros
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, is_active, must_change_password)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    'Lector',      -- Rol por defecto para nuevos usuarios
    false,         -- Inactivo hasta ser activado por admin
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger existente si hay uno, luego recrearlo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PASO 4: Verificar que el perfil fue creado correctamente
SELECT id, full_name, email, role, is_active FROM profiles;

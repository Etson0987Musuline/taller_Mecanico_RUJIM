-- Archivo histórico: la columna se añadió durante la preparación de acceso por
-- contraseña, posteriormente descartado por el propietario a favor de Google.
-- No es necesaria para el flujo actual. No se vinculó ni creó ninguna cuenta.
BEGIN;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS supabase_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT;
COMMENT ON COLUMN public.usuarios.supabase_uid IS 'Identidad de Supabase Auth autorizada para correo y contraseña. Vincular únicamente desde administración.';
COMMIT;

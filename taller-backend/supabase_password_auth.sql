-- Asociación explícita desde el servidor: el correo por sí solo no concede un rol.
-- Mantiene los accesos anteriores hasta vincular cada cuenta autorizada.
BEGIN;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS supabase_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT;
COMMENT ON COLUMN public.usuarios.supabase_uid IS 'Identidad de Supabase Auth autorizada para correo y contraseña. Vincular únicamente desde administración.';
COMMIT;

-- =============================================================================
-- HABILITAR PERMISOS TOTALES EN SUPABASE PARA LA API
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase
-- =============================================================================

-- 1. Conceder permisos de uso y acceso al esquema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- 2. Habilitar políticas permisivas (SELECT, INSERT, UPDATE, DELETE) para todas las tablas
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%') LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "allow_all_anon" ON public.' || quote_ident(r.tablename) || ';';
    EXECUTE 'CREATE POLICY "allow_all_anon" ON public.' || quote_ident(r.tablename) || ' FOR ALL TO public USING (true) WITH CHECK (true);';
  END LOOP;
END $$;

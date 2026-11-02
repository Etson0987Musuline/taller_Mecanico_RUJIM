-- Respaldo previo dentro del mismo proyecto, en un esquema privado no expuesto por la API.
-- Si ya existe el esquema, se detiene para no sobrescribir una copia anterior.
BEGIN ISOLATION LEVEL REPEATABLE READ;
CREATE SCHEMA rujim_backup_preprograma_20261102;
REVOKE ALL ON SCHEMA rujim_backup_preprograma_20261102 FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['usuarios','clientes','vehiculos','servicios','repuestos','ordenes_trabajo','orden_servicios','orden_repuestos','seguimiento','facturas','pagos','ventas','detalle_ventas','vehiculo_catalogos'] LOOP
    EXECUTE format('CREATE TABLE rujim_backup_preprograma_20261102.%I AS TABLE public.%I',t,t);
    EXECUTE format('ALTER TABLE rujim_backup_preprograma_20261102.%I ENABLE ROW LEVEL SECURITY',t);
  END LOOP;
END $$;
CREATE TABLE rujim_backup_preprograma_20261102.columnas AS
 SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default,ordinal_position FROM information_schema.columns WHERE table_schema='public';
CREATE TABLE rujim_backup_preprograma_20261102.restricciones AS
 SELECT c.relname tabla,con.conname,pg_get_constraintdef(con.oid) definicion FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public';
CREATE TABLE rujim_backup_preprograma_20261102.vistas AS
 SELECT viewname,definition FROM pg_views WHERE schemaname='public';
CREATE TABLE rujim_backup_preprograma_20261102.permisos AS
 SELECT * FROM information_schema.role_table_grants WHERE table_schema='public';
ALTER TABLE rujim_backup_preprograma_20261102.columnas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rujim_backup_preprograma_20261102.restricciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE rujim_backup_preprograma_20261102.vistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rujim_backup_preprograma_20261102.permisos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA rujim_backup_preprograma_20261102 FROM PUBLIC,anon,authenticated;
COMMIT;
SELECT 'Respaldo privado creado' estado, (SELECT count(*) FROM rujim_backup_preprograma_20261102.usuarios) usuarios,
 (SELECT count(*) FROM rujim_backup_preprograma_20261102.clientes) clientes,
 (SELECT count(*) FROM rujim_backup_preprograma_20261102.vehiculos) vehiculos,
 (SELECT count(*) FROM rujim_backup_preprograma_20261102.ordenes_trabajo) ordenes;

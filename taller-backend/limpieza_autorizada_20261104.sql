-- Autorizado por el propietario: borrar los datos del taller y conservar solo
-- el administrador id=1. Respaldo y limpieza atómicos; no se toca auth.users
-- ni tablas de otras aplicaciones (drivers/routes/vehicles).
BEGIN;
SET LOCAL lock_timeout = '10s';
CREATE SCHEMA rujim_backup_antes_limpieza_20261104;
REVOKE ALL ON SCHEMA rujim_backup_antes_limpieza_20261104 FROM PUBLIC,anon,authenticated;
CREATE TABLE rujim_backup_antes_limpieza_20261104.manifiesto(tabla TEXT PRIMARY KEY,filas BIGINT NOT NULL,creado_at TIMESTAMPTZ NOT NULL DEFAULT now());
DO $$
DECLARE t TEXT;
BEGIN
  -- Lista cerrada: ninguna tabla ajena se incluye por descubrimiento automático.
  FOREACH t IN ARRAY ARRAY['usuarios','clientes','vehiculos','servicios','repuestos','ordenes_trabajo','orden_servicios','orden_repuestos','seguimiento','facturas','pagos','ventas','detalle_ventas','vehiculo_catalogos','cotizaciones','intentos_login','sesiones','auditoria','reglas_fidelidad','tipos_mantenimiento','reportes_servicio','recompensas','mantenimientos','preferencias_comunicacion','recordatorios','alertas_leidas'] LOOP
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',t);
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=1 AND rol='admin' AND activo=true) THEN
    RAISE EXCEPTION 'No se encontró el administrador activo esperado. No se borra ningún dato.';
  END IF;
  FOREACH t IN ARRAY ARRAY['usuarios','clientes','vehiculos','servicios','repuestos','ordenes_trabajo','orden_servicios','orden_repuestos','seguimiento','facturas','pagos','ventas','detalle_ventas','vehiculo_catalogos','cotizaciones','intentos_login','sesiones','auditoria','reglas_fidelidad','tipos_mantenimiento','reportes_servicio','recompensas','mantenimientos','preferencias_comunicacion','recordatorios','alertas_leidas'] LOOP
    EXECUTE format('CREATE TABLE rujim_backup_antes_limpieza_20261104.%I AS TABLE public.%I',t,t);
    EXECUTE format('ALTER TABLE rujim_backup_antes_limpieza_20261104.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('INSERT INTO rujim_backup_antes_limpieza_20261104.manifiesto(tabla,filas) SELECT %L,count(*) FROM public.%I',t,t);
  END LOOP;
END $$;
CREATE TABLE rujim_backup_antes_limpieza_20261104.columnas AS SELECT * FROM information_schema.columns WHERE table_schema='public';
CREATE TABLE rujim_backup_antes_limpieza_20261104.restricciones AS SELECT c.relname tabla,con.conname,pg_get_constraintdef(con.oid) definicion FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public';
CREATE TABLE rujim_backup_antes_limpieza_20261104.secuencias AS SELECT * FROM pg_sequences WHERE schemaname='public';
ALTER TABLE rujim_backup_antes_limpieza_20261104.manifiesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE rujim_backup_antes_limpieza_20261104.columnas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rujim_backup_antes_limpieza_20261104.restricciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE rujim_backup_antes_limpieza_20261104.secuencias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA rujim_backup_antes_limpieza_20261104 FROM PUBLIC,anon,authenticated;
-- Romper las referencias circulares antes de borrar, sin desactivar protecciones.
DELETE FROM public.recordatorios;
DELETE FROM public.mantenimientos;
UPDATE public.facturas SET recompensa_id=NULL WHERE recompensa_id IS NOT NULL;
DELETE FROM public.recompensas;
DELETE FROM public.reportes_servicio;
DELETE FROM public.cotizaciones;
DELETE FROM public.pagos;
DELETE FROM public.facturas;
DELETE FROM public.seguimiento;
DELETE FROM public.orden_servicios;
DELETE FROM public.orden_repuestos;
DELETE FROM public.ordenes_trabajo;
DELETE FROM public.detalle_ventas;
DELETE FROM public.ventas;
DELETE FROM public.sesiones;
DELETE FROM public.intentos_login;
DELETE FROM public.alertas_leidas;
DELETE FROM public.preferencias_comunicacion;
DELETE FROM public.auditoria;
UPDATE public.usuarios SET cliente_id=NULL WHERE cliente_id IS NOT NULL;
DELETE FROM public.usuarios WHERE id<>1;
DELETE FROM public.vehiculos;
DELETE FROM public.clientes;
DELETE FROM public.servicios;
DELETE FROM public.repuestos;
DELETE FROM public.vehiculo_catalogos;
DELETE FROM public.reglas_fidelidad;
DELETE FROM public.tipos_mantenimiento;
INSERT INTO public.auditoria(usuario_id,accion,entidad,entidad_id,detalle)
VALUES(1,'limpieza_autorizada','sistema','20261104',jsonb_build_object('respaldo','rujim_backup_antes_limpieza_20261104','conservar_usuario',1));
COMMIT;
SELECT 'Limpieza completada con respaldo privado' estado,
 (SELECT count(*) FROM public.usuarios) usuarios,
 (SELECT count(*) FROM public.clientes) clientes,
 (SELECT count(*) FROM public.vehiculos) vehiculos,
 (SELECT count(*) FROM public.ordenes_trabajo) ordenes,
 (SELECT count(*) FROM rujim_backup_antes_limpieza_20261104.manifiesto) tablas_respaldadas;

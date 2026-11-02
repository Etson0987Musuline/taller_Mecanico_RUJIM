-- Ejecutar en SQL Editor después de supabase_migration.sql (y cotizaciones si se usa).
-- Respaldar antes. No elimina registros ni contabiliza automáticamente servicios históricos.
BEGIN;
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('admin','mecanico','cliente'));
ALTER TABLE public.usuarios ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS google_uid UUID UNIQUE;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS google_habilitado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS cliente_id INT UNIQUE REFERENCES public.clientes(id) ON DELETE RESTRICT;
-- Si existen correos duplicados con distinta capitalización se detiene, sin borrar datos.
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_normalizado ON public.usuarios(lower(trim(email)));
UPDATE public.usuarios SET email=lower(trim(email)) WHERE email<>lower(trim(email));
CREATE TABLE IF NOT EXISTS public.intentos_login (clave TEXT PRIMARY KEY, intentos INT NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.sesiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id INT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sesiones_usuario ON public.sesiones(usuario_id);
CREATE TABLE IF NOT EXISTS public.auditoria (
  id BIGSERIAL PRIMARY KEY, usuario_id INT REFERENCES public.usuarios(id) ON DELETE SET NULL,
  accion TEXT NOT NULL, entidad TEXT NOT NULL, entidad_id TEXT, detalle JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.reglas_fidelidad (
  id SERIAL PRIMARY KEY, servicios INT NOT NULL UNIQUE CHECK(servicios > 0 AND servicios <= 100000),
  porcentaje NUMERIC(5,2) NOT NULL CHECK(porcentaje > 0 AND porcentaje <= 100),
  vigencia_dias INT NOT NULL CHECK(vigencia_dias BETWEEN 1 AND 3650), activo BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO public.reglas_fidelidad(servicios,porcentaje,vigencia_dias) VALUES(5,10,90),(10,15,90),(15,20,90) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.tipos_mantenimiento (
  id SERIAL PRIMARY KEY, nombre TEXT NOT NULL UNIQUE, meses INT CHECK(meses BETWEEN 1 AND 120), km INT CHECK(km BETWEEN 1 AND 1000000),
  aviso_dias INT NOT NULL DEFAULT 14 CHECK(aviso_dias BETWEEN 0 AND 365), aviso_km INT NOT NULL DEFAULT 500 CHECK(aviso_km BETWEEN 0 AND 100000),
  activo BOOLEAN NOT NULL DEFAULT true, CHECK(meses IS NOT NULL OR km IS NOT NULL)
);
-- Valores iniciales orientativos: ajustar a cada fabricante y condición de uso.
INSERT INTO public.tipos_mantenimiento(nombre,meses,km) VALUES
 ('Cambio de aceite',6,5000),('Cambio de filtros',6,10000),('Sistema de frenos',12,10000),('Neumáticos',6,10000),('Suspensión',12,20000),('Batería',12,NULL),('Sistema de refrigeración',12,20000),('Transmisión',24,40000),('Correas',24,40000),('Sistema eléctrico',12,20000) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.reportes_servicio (
  id SERIAL PRIMARY KEY, orden_id INT NOT NULL UNIQUE REFERENCES public.ordenes_trabajo(id) ON DELETE RESTRICT,
  cliente_id INT NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  vehiculo_id INT NOT NULL REFERENCES public.vehiculos(id) ON DELETE RESTRICT,
  mecanico_id INT NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  tipo_servicio TEXT NOT NULL, fecha_servicio DATE NOT NULL, km INT NOT NULL CHECK(km >= 0),
  observaciones TEXT NOT NULL, fallas TEXT NOT NULL DEFAULT '', recomendaciones TEXT NOT NULL DEFAULT '',
  mantenimientos JSONB NOT NULL DEFAULT '[]', trabajos JSONB NOT NULL DEFAULT '{}',
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','aprobado','rechazado')),
  motivo_revision TEXT, aprobado_por INT REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  aprobado_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.recompensas (
  id SERIAL PRIMARY KEY, cliente_id INT NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  regla_id INT NOT NULL REFERENCES public.reglas_fidelidad(id) ON DELETE RESTRICT,
  servicios_requeridos INT NOT NULL, porcentaje NUMERIC(5,2) NOT NULL,
  generada_orden_id INT NOT NULL REFERENCES public.ordenes_trabajo(id) ON DELETE RESTRICT,
  autorizado_por INT NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), vence_at TIMESTAMPTZ NOT NULL,
  usada_at TIMESTAMPTZ, usada_por INT REFERENCES public.usuarios(id), factura_id INT UNIQUE REFERENCES public.facturas(id) ON DELETE RESTRICT,
  UNIQUE(cliente_id, regla_id)
);
CREATE TABLE IF NOT EXISTS public.mantenimientos (
  id SERIAL PRIMARY KEY, vehiculo_id INT NOT NULL REFERENCES public.vehiculos(id) ON DELETE RESTRICT,
  tipo_id INT NOT NULL REFERENCES public.tipos_mantenimiento(id) ON DELETE RESTRICT,
  mecanico_id INT REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ultima_fecha DATE NOT NULL, ultimo_km INT NOT NULL CHECK(ultimo_km >= 0),
  meses INT CHECK(meses BETWEEN 1 AND 120), intervalo_km INT CHECK(intervalo_km BETWEEN 1 AND 1000000),
  proxima_fecha DATE, proximo_km INT, recomendaciones TEXT NOT NULL DEFAULT '',
  fuente_reporte_id INT REFERENCES public.reportes_servicio(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(vehiculo_id,tipo_id), CHECK(meses IS NOT NULL OR intervalo_km IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS public.preferencias_comunicacion (
  cliente_id INT PRIMARY KEY REFERENCES public.clientes(id) ON DELETE CASCADE,
  email BOOLEAN NOT NULL DEFAULT false, whatsapp BOOLEAN NOT NULL DEFAULT false, interna BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.recordatorios (
  id BIGSERIAL PRIMARY KEY, cliente_id INT NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  vehiculo_id INT REFERENCES public.vehiculos(id) ON DELETE RESTRICT,
  mantenimiento_id INT REFERENCES public.mantenimientos(id) ON DELETE RESTRICT,
  clave TEXT NOT NULL UNIQUE, canal TEXT NOT NULL CHECK(canal IN ('interna','email','whatsapp')),
  mensaje TEXT NOT NULL, programado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','procesando','enviado','error','revisar','completado','cancelado')),
  intentos INT NOT NULL DEFAULT 0, proveedor_id TEXT, error TEXT, enviado_at TIMESTAMPTZ, leido_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recordatorios_cola ON public.recordatorios(estado, programado_at);
CREATE INDEX IF NOT EXISTS reportes_cliente ON public.reportes_servicio(cliente_id,estado);
CREATE TABLE IF NOT EXISTS public.alertas_leidas (
  usuario_id INT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE, clave TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(usuario_id,clave)
);
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS descuento NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS subtotal_original NUMERIC(10,2);
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS recompensa_id INT UNIQUE REFERENCES public.recompensas(id);

CREATE OR REPLACE FUNCTION public.vincular_google(p_uid UUID,p_email TEXT,p_nombre TEXT) RETURNS JSONB
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE u public.usuarios%ROWTYPE; cid INT; cantidad INT;
BEGIN
  p_email := lower(trim(p_email));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_email,0));
  SELECT * INTO u FROM public.usuarios WHERE lower(trim(email))=p_email FOR UPDATE;
  IF FOUND THEN
    IF NOT u.activo OR (u.rol <> 'cliente' AND NOT u.google_habilitado) THEN RAISE EXCEPTION 'Esta cuenta requiere autorización administrativa para usar Google.'; END IF;
    IF u.google_uid IS NOT NULL AND u.google_uid <> p_uid THEN RAISE EXCEPTION 'La cuenta ya está vinculada a otra identidad.'; END IF;
    UPDATE public.usuarios SET google_uid=p_uid WHERE id=u.id RETURNING * INTO u;
  ELSE
    SELECT count(*),min(id) INTO cantidad,cid FROM public.clientes WHERE lower(trim(email))=p_email;
    IF cantidad > 1 THEN RAISE EXCEPTION 'Hay fichas con el mismo correo. Solicita al administrador que las revise.'; END IF;
    IF cantidad=0 THEN INSERT INTO public.clientes(nombre,apellido,email) VALUES(left(p_nombre,100),'',p_email) RETURNING id INTO cid; END IF;
    INSERT INTO public.usuarios(nombre,email,rol,cliente_id,google_uid,google_habilitado) VALUES(left(p_nombre,100),p_email,'cliente',cid,p_uid,true) RETURNING * INTO u;
  END IF;
  INSERT INTO public.auditoria(usuario_id,accion,entidad,entidad_id) VALUES(u.id,'login_google','usuarios',u.id::TEXT);
  RETURN jsonb_build_object('id',u.id,'nombre',u.nombre,'email',u.email,'rol',u.rol,'cliente_id',u.cliente_id);
END $$;

CREATE OR REPLACE FUNCTION public.limitar_login(p_clave TEXT) RETURNS INT LANGUAGE sql SET search_path=public AS $$
  INSERT INTO public.intentos_login(clave) VALUES(p_clave) ON CONFLICT(clave) DO UPDATE SET intentos=intentos_login.intentos+1 RETURNING intentos;
$$;

CREATE OR REPLACE FUNCTION public.reportar_servicio(p_orden INT,p_usuario INT,p_datos JSONB) RETURNS INT
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE o public.ordenes_trabajo%ROWTYPE; v public.vehiculos%ROWTYPE; r public.reportes_servicio%ROWTYPE; uid INT; rol_actual TEXT; v_km INT; fecha DATE;
BEGIN
  SELECT rol INTO rol_actual FROM public.usuarios WHERE id=p_usuario AND activo=true;
  SELECT * INTO o FROM public.ordenes_trabajo WHERE id=p_orden FOR UPDATE;
  IF NOT FOUND OR (rol_actual <> 'admin' AND (rol_actual <> 'mecanico' OR o.mecanico_id IS DISTINCT FROM p_usuario)) OR rol_actual IS NULL THEN RAISE EXCEPTION 'Orden no asignada o acceso denegado.'; END IF;
  IF o.estado IN ('cancelado','entregado') THEN RAISE EXCEPTION 'La orden no admite un nuevo reporte.'; END IF;
  SELECT * INTO v FROM public.vehiculos WHERE id=o.vehiculo_id;
  v_km := (p_datos->>'km')::INT; fecha := (p_datos->>'fecha_servicio')::DATE;
  IF v_km < v.km_ingreso OR v_km < coalesce(o.km_actual,0) THEN RAISE EXCEPTION 'El kilometraje no puede ser menor al registrado.'; END IF;
  IF fecha > (now() AT TIME ZONE 'America/Lima')::DATE THEN RAISE EXCEPTION 'La fecha del servicio no puede ser futura.'; END IF;
  SELECT * INTO r FROM public.reportes_servicio WHERE orden_id=p_orden FOR UPDATE;
  IF FOUND AND r.estado <> 'rechazado' THEN RAISE EXCEPTION 'El servicio ya fue enviado o aprobado.'; END IF;
  UPDATE public.ordenes_trabajo SET estado='listo',km_actual=v_km,updated_at=now() WHERE id=o.id;
  INSERT INTO public.reportes_servicio(orden_id,cliente_id,vehiculo_id,mecanico_id,tipo_servicio,fecha_servicio,km,observaciones,fallas,recomendaciones,mantenimientos,trabajos)
    VALUES(o.id,v.cliente_id,v.id,coalesce(o.mecanico_id,p_usuario),p_datos->>'tipo_servicio',fecha,v_km,p_datos->>'observaciones',p_datos->>'fallas',p_datos->>'recomendaciones',p_datos->'mantenimientos',jsonb_build_object('mano_obra',o.mano_obra,'servicios',(SELECT coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('nombre',sv.nombre)),'[]') FROM public.orden_servicios s JOIN public.servicios sv ON sv.id=s.servicio_id WHERE s.orden_id=o.id),'repuestos',(SELECT coalesce(jsonb_agg(to_jsonb(rp)||jsonb_build_object('repuesto_nombre',coalesce(rp.repuesto_nombre,pz.nombre))),'[]') FROM public.orden_repuestos rp LEFT JOIN public.repuestos pz ON pz.id=rp.repuesto_id WHERE rp.orden_id=o.id)))
    ON CONFLICT(orden_id) DO UPDATE SET tipo_servicio=excluded.tipo_servicio,fecha_servicio=excluded.fecha_servicio,km=excluded.km,observaciones=excluded.observaciones,fallas=excluded.fallas,recomendaciones=excluded.recomendaciones,mantenimientos=excluded.mantenimientos,trabajos=excluded.trabajos,estado='pendiente',motivo_revision=NULL,created_at=now()
    RETURNING id INTO uid;
  INSERT INTO public.seguimiento(orden_id,usuario_id,estado,comentario) VALUES(o.id,p_usuario,'listo','Trabajo reportado. Pendiente de aprobación administrativa.');
  INSERT INTO public.auditoria(usuario_id,accion,entidad,entidad_id) VALUES(p_usuario,'reportar_servicio','reportes_servicio',uid::TEXT);
  RETURN uid;
END $$;

CREATE OR REPLACE FUNCTION public.proteger_trabajo_reportado() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE oid INT; est TEXT;
BEGIN
  IF TG_TABLE_NAME='ordenes_trabajo' THEN oid:=OLD.id;
  ELSIF TG_OP='DELETE' THEN oid:=OLD.orden_id;
  ELSE oid:=NEW.orden_id; END IF;
  PERFORM 1 FROM public.ordenes_trabajo WHERE id=oid FOR UPDATE;
  SELECT estado INTO est FROM public.reportes_servicio WHERE orden_id=oid;
  IF est IN ('pendiente','aprobado') THEN
    IF TG_TABLE_NAME='ordenes_trabajo' AND TG_OP='UPDATE' AND est='aprobado' THEN
      IF NEW.estado='entregado' AND (to_jsonb(NEW)-'estado'-'updated_at'-'fecha_entrega')=(to_jsonb(OLD)-'estado'-'updated_at'-'fecha_entrega') THEN RETURN NEW; END IF;
    END IF;
    RAISE EXCEPTION 'El trabajo reportado conserva sus importes y su historial. Devuelve el reporte pendiente antes de corregirlo.';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proteger_orden ON public.ordenes_trabajo;
CREATE TRIGGER proteger_orden BEFORE UPDATE OR DELETE ON public.ordenes_trabajo FOR EACH ROW EXECUTE FUNCTION public.proteger_trabajo_reportado();
DROP TRIGGER IF EXISTS proteger_servicios ON public.orden_servicios;
CREATE TRIGGER proteger_servicios BEFORE INSERT OR UPDATE OR DELETE ON public.orden_servicios FOR EACH ROW EXECUTE FUNCTION public.proteger_trabajo_reportado();
DROP TRIGGER IF EXISTS proteger_repuestos ON public.orden_repuestos;
CREATE TRIGGER proteger_repuestos BEFORE INSERT OR UPDATE OR DELETE ON public.orden_repuestos FOR EACH ROW EXECUTE FUNCTION public.proteger_trabajo_reportado();

CREATE OR REPLACE FUNCTION public.exportar_respaldo() RETURNS JSONB LANGUAGE sql SET search_path=public AS $$
SELECT jsonb_build_object(
 'fecha',now(),'usuarios',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.usuarios t),
 'clientes',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.clientes t),'vehiculos',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.vehiculos t),
 'servicios',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.servicios t),'repuestos',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.repuestos t),
 'ordenes_trabajo',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.ordenes_trabajo t),'orden_servicios',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.orden_servicios t),
 'orden_repuestos',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.orden_repuestos t),'seguimiento',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.seguimiento t),
 'facturas',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.facturas t),'pagos',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.pagos t),
 'ventas',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.ventas t),'detalle_ventas',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.detalle_ventas t),
 'vehiculo_catalogos',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.vehiculo_catalogos t),
 'reportes_servicio',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.reportes_servicio t),'reglas_fidelidad',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.reglas_fidelidad t),
 'recompensas',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.recompensas t),'tipos_mantenimiento',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.tipos_mantenimiento t),
 'mantenimientos',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.mantenimientos t),'preferencias_comunicacion',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.preferencias_comunicacion t),
 'recordatorios',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.recordatorios t),'alertas_leidas',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.alertas_leidas t),
 'auditoria',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.auditoria t)
);
$$;

CREATE OR REPLACE FUNCTION public.revisar_servicio(p_id INT,p_admin INT,p_aprobar BOOLEAN,p_motivo TEXT DEFAULT '') RETURNS JSONB
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r public.reportes_servicio%ROWTYPE; o public.ordenes_trabajo%ROWTYPE; item JSONB; tipo public.tipos_mantenimiento%ROWTYPE; n INT; regla public.reglas_fidelidad%ROWTYPE; premio INT; meses INT; kilometros INT;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=p_admin AND activo=true AND rol='admin') THEN RAISE EXCEPTION 'Solo administrador.'; END IF;
  -- Mismo orden de bloqueo que reportar_servicio: orden, reporte, cliente.
  SELECT ot.* INTO o FROM public.ordenes_trabajo ot JOIN public.reportes_servicio rs ON rs.orden_id=ot.id WHERE rs.id=p_id FOR UPDATE OF ot;
  SELECT * INTO r FROM public.reportes_servicio WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reporte no encontrado.'; END IF;
  IF r.estado='aprobado' AND p_aprobar THEN RETURN jsonb_build_object('id',r.id,'estado','aprobado'); END IF;
  IF r.estado <> 'pendiente' THEN RAISE EXCEPTION 'El reporte ya fue revisado.'; END IF;
  IF o.estado='cancelado' THEN RAISE EXCEPTION 'No se contabilizan servicios cancelados.'; END IF;
  IF NOT p_aprobar THEN
    IF length(trim(p_motivo))=0 THEN RAISE EXCEPTION 'Indica el motivo de devolución.'; END IF;
    UPDATE public.reportes_servicio SET estado='rechazado',motivo_revision=p_motivo WHERE id=r.id;
  ELSE
    PERFORM 1 FROM public.clientes WHERE id=r.cliente_id FOR UPDATE;
    UPDATE public.reportes_servicio SET estado='aprobado',aprobado_por=p_admin,aprobado_at=now() WHERE id=r.id;
    UPDATE public.vehiculos SET km_ingreso=greatest(km_ingreso,r.km) WHERE id=r.vehiculo_id;
    FOR item IN SELECT * FROM jsonb_array_elements(r.mantenimientos) LOOP
      SELECT * INTO tipo FROM public.tipos_mantenimiento WHERE id=(item->>'tipo_id')::INT AND activo=true;
      IF NOT FOUND THEN RAISE EXCEPTION 'Tipo de mantenimiento no válido.'; END IF;
      meses := coalesce((item->>'meses')::INT,tipo.meses); kilometros := coalesce((item->>'intervalo_km')::INT,tipo.km);
      INSERT INTO public.mantenimientos(vehiculo_id,tipo_id,mecanico_id,ultima_fecha,ultimo_km,meses,intervalo_km,proxima_fecha,proximo_km,recomendaciones,fuente_reporte_id)
        VALUES(r.vehiculo_id,tipo.id,r.mecanico_id,r.fecha_servicio,r.km,meses,kilometros,(r.fecha_servicio+make_interval(months=>meses))::DATE,r.km+kilometros,r.recomendaciones,r.id)
        ON CONFLICT(vehiculo_id,tipo_id) DO UPDATE SET mecanico_id=excluded.mecanico_id,ultima_fecha=excluded.ultima_fecha,ultimo_km=excluded.ultimo_km,meses=excluded.meses,intervalo_km=excluded.intervalo_km,proxima_fecha=excluded.proxima_fecha,proximo_km=excluded.proximo_km,recomendaciones=excluded.recomendaciones,fuente_reporte_id=excluded.fuente_reporte_id,updated_at=now()
        WHERE mantenimientos.ultima_fecha <= excluded.ultima_fecha AND mantenimientos.ultimo_km <= excluded.ultimo_km;
    END LOOP;
    SELECT count(*) INTO n FROM public.reportes_servicio WHERE cliente_id=r.cliente_id AND estado='aprobado';
    FOR regla IN SELECT * FROM public.reglas_fidelidad WHERE activo=true AND servicios<=n LOOP
      INSERT INTO public.recompensas(cliente_id,regla_id,servicios_requeridos,porcentaje,generada_orden_id,autorizado_por,vence_at)
        VALUES(r.cliente_id,regla.id,regla.servicios,regla.porcentaje,r.orden_id,p_admin,now()+make_interval(days=>regla.vigencia_dias)) ON CONFLICT DO NOTHING RETURNING id INTO premio;
      IF premio IS NOT NULL THEN
        INSERT INTO public.recordatorios(cliente_id,vehiculo_id,clave,canal,mensaje,estado,enviado_at) VALUES(r.cliente_id,r.vehiculo_id,'premio:'||premio,'interna','Has obtenido un descuento de '||regla.porcentaje||'% en mano de obra y servicios de tu próxima visita elegible.','enviado',now()) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  INSERT INTO public.auditoria(usuario_id,accion,entidad,entidad_id,detalle) VALUES(p_admin,CASE WHEN p_aprobar THEN 'aprobar_servicio' ELSE 'devolver_servicio' END,'reportes_servicio',r.id::TEXT,jsonb_build_object('motivo',p_motivo));
  RETURN jsonb_build_object('id',r.id,'estado',CASE WHEN p_aprobar THEN 'aprobado' ELSE 'rechazado' END,'servicios',n);
END $$;

CREATE OR REPLACE FUNCTION public.facturar_con_fidelidad(p_orden INT,p_admin INT,p_notas TEXT DEFAULT '') RETURNS JSONB
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE o public.ordenes_trabajo%ROWTYPE; cid INT; premio public.recompensas%ROWTYPE; labor NUMERIC; piezas NUMERIC; base NUMERIC; descuento NUMERIC:=0; impuesto NUMERIC; fid INT; numero_fac TEXT;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=p_admin AND activo=true AND rol='admin') THEN RAISE EXCEPTION 'Solo administrador.'; END IF;
  SELECT * INTO o FROM public.ordenes_trabajo WHERE id=p_orden FOR UPDATE;
  IF NOT FOUND OR o.estado='cancelado' THEN RAISE EXCEPTION 'Orden no válida.'; END IF;
  IF EXISTS(SELECT 1 FROM public.facturas WHERE orden_id=o.id) THEN RAISE EXCEPTION 'La orden ya tiene factura.'; END IF;
  SELECT cliente_id INTO cid FROM public.vehiculos WHERE id=o.vehiculo_id;
  PERFORM 1 FROM public.clientes WHERE id=cid FOR UPDATE;
  SELECT o.mano_obra+coalesce(sum(precio),0) INTO labor FROM public.orden_servicios WHERE orden_id=o.id;
  SELECT coalesce(sum(cantidad*precio_unitario),0) INTO piezas FROM public.orden_repuestos WHERE orden_id=o.id;
  IF labor<0 OR piezas<0 THEN RAISE EXCEPTION 'Importes de orden inválidos.'; END IF;
  SELECT * INTO premio FROM public.recompensas WHERE cliente_id=cid AND usada_at IS NULL AND vence_at>now() AND generada_orden_id<>o.id AND created_at<=o.fecha_ingreso AND labor>0 ORDER BY porcentaje DESC,vence_at,id LIMIT 1 FOR UPDATE;
  IF FOUND THEN descuento:=round(labor*premio.porcentaje/100,2); END IF;
  base:=labor+piezas-descuento; impuesto:=round(base*.18,2);
  numero_fac:='F-'||upper(substr(replace(gen_random_uuid()::TEXT,'-',''),1,16));
  INSERT INTO public.facturas(orden_id,numero,subtotal,igv,total,notas,descuento,subtotal_original,recompensa_id)
    VALUES(o.id,numero_fac,base,impuesto,base+impuesto,p_notas,descuento,labor+piezas,premio.id) RETURNING id INTO fid;
  IF premio.id IS NOT NULL THEN
    UPDATE public.recompensas SET usada_at=now(),usada_por=p_admin,factura_id=fid WHERE id=premio.id;
    INSERT INTO public.auditoria(usuario_id,accion,entidad,entidad_id,detalle) VALUES(p_admin,'utilizar_recompensa','recompensas',premio.id::TEXT,jsonb_build_object('factura_id',fid,'descuento',descuento));
  END IF;
  RETURN jsonb_build_object('id',fid,'numero',numero_fac,'subtotal',base,'igv',impuesto,'total',base+impuesto,'descuento',descuento);
END $$;

CREATE OR REPLACE FUNCTION public.tomar_recordatorios(p_limite INT DEFAULT 20) RETURNS SETOF public.recordatorios
LANGUAGE sql SET search_path=public AS $$
  UPDATE public.recordatorios SET estado='procesando',intentos=intentos+1,updated_at=now()
    WHERE id IN(SELECT id FROM public.recordatorios WHERE estado='pendiente' AND canal<>'interna' AND programado_at<=now() ORDER BY programado_at,id FOR UPDATE SKIP LOCKED LIMIT least(greatest(p_limite,1),50)) RETURNING *;
$$;

CREATE OR REPLACE FUNCTION public.modificar_repuesto_orden(p_orden INT,p_usuario INT,p_repuesto INT,p_detalle INT,p_cantidad INT,p_precio NUMERIC) RETURNS VOID
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE o public.ordenes_trabajo%ROWTYPE; d public.orden_repuestos%ROWTYPE; rol_actual TEXT; disponible INT;
BEGIN
  SELECT rol INTO rol_actual FROM public.usuarios WHERE id=p_usuario AND activo=true;
  SELECT * INTO o FROM public.ordenes_trabajo WHERE id=p_orden FOR UPDATE;
  IF NOT FOUND OR rol_actual IS NULL OR (rol_actual<>'admin' AND (rol_actual<>'mecanico' OR o.mecanico_id IS DISTINCT FROM p_usuario)) THEN RAISE EXCEPTION 'Orden no asignada.'; END IF;
  IF EXISTS(SELECT 1 FROM public.reportes_servicio WHERE orden_id=o.id AND estado IN ('pendiente','aprobado')) THEN RAISE EXCEPTION 'El trabajo reportado está protegido.'; END IF;
  IF p_detalle IS NOT NULL THEN
    SELECT * INTO d FROM public.orden_repuestos WHERE id=p_detalle AND orden_id=o.id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'El repuesto no pertenece a esta orden.'; END IF;
    DELETE FROM public.orden_repuestos WHERE id=d.id;
    IF d.repuesto_id IS NOT NULL THEN UPDATE public.repuestos SET stock=stock+d.cantidad,updated_at=now() WHERE id=d.repuesto_id; END IF;
  ELSE
    IF p_cantidad IS NULL OR p_cantidad<1 OR p_cantidad>10000 OR p_precio IS NULL OR p_precio<0 OR p_precio>1000000 THEN RAISE EXCEPTION 'Cantidad o precio no válidos.'; END IF;
    SELECT stock INTO disponible FROM public.repuestos WHERE id=p_repuesto AND activo=true FOR UPDATE;
    IF NOT FOUND OR disponible<p_cantidad THEN RAISE EXCEPTION 'Stock insuficiente o repuesto inactivo.'; END IF;
    INSERT INTO public.orden_repuestos(orden_id,repuesto_id,cantidad,precio_unitario) VALUES(o.id,p_repuesto,p_cantidad,p_precio);
    UPDATE public.repuestos SET stock=stock-p_cantidad,updated_at=now() WHERE id=p_repuesto;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.programar_mantenimiento(p_admin INT,p_vehiculo INT,p_tipo INT,p_fecha DATE,p_km INT,p_meses INT,p_intervalo INT,p_mecanico INT,p_recomendaciones TEXT) RETURNS INT
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE mid INT;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=p_admin AND activo=true AND rol='admin') THEN RAISE EXCEPTION 'Solo administrador.'; END IF;
  INSERT INTO public.mantenimientos(vehiculo_id,tipo_id,mecanico_id,ultima_fecha,ultimo_km,meses,intervalo_km,proxima_fecha,proximo_km,recomendaciones)
    VALUES(p_vehiculo,p_tipo,p_mecanico,p_fecha,p_km,p_meses,p_intervalo,(p_fecha+make_interval(months=>p_meses))::DATE,p_km+p_intervalo,p_recomendaciones)
    ON CONFLICT(vehiculo_id,tipo_id) DO UPDATE SET mecanico_id=excluded.mecanico_id,ultima_fecha=excluded.ultima_fecha,ultimo_km=excluded.ultimo_km,meses=excluded.meses,intervalo_km=excluded.intervalo_km,proxima_fecha=excluded.proxima_fecha,proximo_km=excluded.proximo_km,recomendaciones=excluded.recomendaciones,updated_at=now() RETURNING id INTO mid;
  INSERT INTO public.auditoria(usuario_id,accion,entidad,entidad_id) VALUES(p_admin,'programar_mantenimiento','mantenimientos',mid::TEXT);
  RETURN mid;
END $$;

-- Todo acceso a datos pasa por API; las sesiones de Google no reciben acceso directo.
DO $$ DECLARE t TEXT; f RECORD; BEGIN
  FOREACH t IN ARRAY ARRAY['sesiones','intentos_login','auditoria','reglas_fidelidad','tipos_mantenimiento','reportes_servicio','recompensas','mantenimientos','preferencias_comunicacion','recordatorios','alertas_leidas'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END LOOP;
  FOR f IN SELECT p.oid::regprocedure AS firma FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('vincular_google','limitar_login','reportar_servicio','revisar_servicio','facturar_con_fidelidad','tomar_recordatorios','modificar_repuesto_orden','programar_mantenimiento','proteger_trabajo_reportado','exportar_respaldo') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.firma);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.firma);
  END LOOP;
END $$;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
-- Cerrar también el acceso público heredado a datos personales y operaciones internas.
REVOKE ALL ON public.usuarios,public.clientes,public.vehiculos,public.ordenes_trabajo,public.orden_servicios,public.orden_repuestos,public.seguimiento,public.facturas,public.pagos,public.ventas,public.detalle_ventas,public.repuestos FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.v_consulta_cliente,public.v_ordenes_resumen,public.v_stock_bajo FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
COMMIT;

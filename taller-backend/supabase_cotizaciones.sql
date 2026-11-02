-- Ejecutar después de supabase_migration.sql con el SQL Editor de Supabase.
-- La API debe usar SUPABASE_KEY con rol service_role (o secret key de servidor).
BEGIN;
CREATE TABLE IF NOT EXISTS public.cotizaciones (
  id SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE DEFAULT ('COT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))),
  vehiculo_id INT NOT NULL REFERENCES public.vehiculos(id) ON DELETE RESTRICT,
  descripcion TEXT NOT NULL,
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),
  subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal > 0),
  igv NUMERIC(10,2) NOT NULL CHECK (igv >= 0),
  total NUMERIC(10,2) NOT NULL CHECK (total = subtotal + igv),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobada','rechazada','convertida','anulada')),
  token TEXT NOT NULL UNIQUE,
  creado_por INT REFERENCES public.usuarios(id) ON DELETE SET NULL,
  aprobado_por TEXT,
  respondido_at TIMESTAMPTZ,
  vence_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  orden_id INT UNIQUE REFERENCES public.ordenes_trabajo(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cotizaciones FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.cotizaciones_id_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cotizaciones TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.cotizaciones_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.convertir_cotizacion(p_id INT, p_usuario INT)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  c public.cotizaciones%ROWTYPE;
  item JSONB;
  grupo RECORD;
  stock_actual INT;
  nueva_orden INT;
  codigo_orden TEXT;
  mano NUMERIC(10,2) := 0;
BEGIN
  SELECT * INTO c FROM public.cotizaciones WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada.'; END IF;
  IF c.estado = 'convertida' THEN
    SELECT codigo INTO codigo_orden FROM public.ordenes_trabajo WHERE id = c.orden_id;
    RETURN jsonb_build_object('id', c.orden_id, 'codigo', codigo_orden);
  END IF;
  IF c.estado <> 'aprobada' THEN RAISE EXCEPTION 'El cliente debe aprobar la cotización antes de crear la orden.'; END IF;
  -- Bloquear repuestos en orden estable y sumar conceptos repetidos.
  FOR grupo IN SELECT (x->>'repuesto_id')::INT AS id, sum((x->>'cantidad')::INT) AS cantidad
    FROM jsonb_array_elements(c.items) x WHERE x->>'tipo' = 'repuesto'
    GROUP BY (x->>'repuesto_id')::INT ORDER BY (x->>'repuesto_id')::INT
  LOOP
    SELECT stock INTO stock_actual FROM public.repuestos WHERE id = grupo.id AND activo = true FOR UPDATE;
    IF NOT FOUND OR stock_actual < grupo.cantidad THEN RAISE EXCEPTION 'Stock insuficiente o repuesto inactivo (ID %). No se creó ninguna orden.', grupo.id; END IF;
    UPDATE public.repuestos SET stock = stock - grupo.cantidad, updated_at = now() WHERE id = grupo.id;
  END LOOP;
  SELECT coalesce(sum((x->>'cantidad')::INT * (x->>'precio_unitario')::NUMERIC), 0) INTO mano
    FROM jsonb_array_elements(c.items) x WHERE x->>'tipo' = 'mano_obra';
  codigo_orden := 'OT-C' || c.id;
  INSERT INTO public.ordenes_trabajo(codigo,vehiculo_id,descripcion_problema,mano_obra,observaciones)
    VALUES(codigo_orden,c.vehiculo_id,c.descripcion,mano,'Presupuesto ' || c.codigo || ' aprobado por ' || c.aprobado_por || ' el ' || c.respondido_at::text)
    RETURNING id INTO nueva_orden;
  FOR item IN SELECT * FROM jsonb_array_elements(c.items) LOOP
    IF item->>'tipo' = 'repuesto' THEN
      INSERT INTO public.orden_repuestos(orden_id,repuesto_id,cantidad,precio_unitario,repuesto_nombre)
        VALUES(nueva_orden,(item->>'repuesto_id')::INT,(item->>'cantidad')::INT,(item->>'precio_unitario')::NUMERIC,item->>'descripcion');
    END IF;
  END LOOP;
  INSERT INTO public.seguimiento(orden_id,usuario_id,estado,comentario)
    VALUES(nueva_orden,p_usuario,'recibido','Orden creada desde ' || c.codigo || '. Autorización: ' || c.aprobado_por || '. Mano de obra: ' ||
      (SELECT coalesce(string_agg((x->>'descripcion') || ' x' || (x->>'cantidad'), '; '), '') FROM jsonb_array_elements(c.items) x WHERE x->>'tipo' = 'mano_obra'));
  UPDATE public.cotizaciones SET estado = 'convertida', orden_id = nueva_orden WHERE id = c.id;
  RETURN jsonb_build_object('id', nueva_orden, 'codigo', codigo_orden);
END;
$$;
REVOKE ALL ON FUNCTION public.convertir_cotizacion(INT,INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.convertir_cotizacion(INT,INT) TO service_role;
COMMIT;

-- =============================================================================
-- MIGRACIÓN DE SISTEMA TALLER AUTOMOTRIZ A SUPABASE (POSTGRESQL)
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase
-- =============================================================================

-- 1. TABLA: usuarios
CREATE TABLE IF NOT EXISTS public.usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL DEFAULT 'mecanico' CHECK (rol IN ('admin', 'mecanico')),
  telefono VARCHAR(20) DEFAULT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA: clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id SERIAL PRIMARY KEY,
  tipo_documento VARCHAR(10) NOT NULL DEFAULT 'dni',
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  dni VARCHAR(20) DEFAULT NULL,
  telefono VARCHAR(20) DEFAULT NULL,
  email VARCHAR(150) DEFAULT NULL,
  direccion VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA: vehiculos
CREATE TABLE IF NOT EXISTS public.vehiculos (
  id SERIAL PRIMARY KEY,
  cliente_id INT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  placa VARCHAR(20) UNIQUE NOT NULL,
  marca VARCHAR(60) NOT NULL,
  modelo VARCHAR(60) NOT NULL,
  anio INT DEFAULT NULL,
  color VARCHAR(40) DEFAULT NULL,
  tipo VARCHAR(40) DEFAULT NULL,
  titulo VARCHAR(50) DEFAULT NULL,
  vin VARCHAR(50) DEFAULT NULL,
  km_ingreso INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  anio_modelo INT DEFAULT NULL,
  num_motor VARCHAR(50) DEFAULT NULL,
  num_serie VARCHAR(50) DEFAULT NULL,
  estado_vehiculo VARCHAR(50) DEFAULT NULL,
  propietario VARCHAR(150) DEFAULT NULL,
  n_motor VARCHAR(100) DEFAULT NULL,
  n_serie VARCHAR(100) DEFAULT NULL,
  propietario_registral VARCHAR(150) DEFAULT NULL
);

-- 4. TABLA: vehiculo_catalogos
CREATE TABLE IF NOT EXISTS public.vehiculo_catalogos (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('marca', 'modelo', 'titulo', 'tipo_vehiculo')),
  valor VARCHAR(100) NOT NULL,
  CONSTRAINT uq_catalogo UNIQUE (tipo, valor)
);

-- 5. TABLA: servicios
CREATE TABLE IF NOT EXISTS public.servicios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT DEFAULT NULL,
  categoria VARCHAR(80) DEFAULT NULL,
  precio_base NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 6. TABLA: repuestos
CREATE TABLE IF NOT EXISTS public.repuestos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE DEFAULT NULL,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT DEFAULT NULL,
  categoria VARCHAR(80) DEFAULT NULL,
  stock INT NOT NULL DEFAULT 0,
  stock_minimo INT NOT NULL DEFAULT 5,
  precio_compra NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  precio_venta NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  proveedor VARCHAR(120) DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unidad_medida VARCHAR(30) DEFAULT NULL,
  precio_mayor NUMERIC(10,2) DEFAULT 0.00,
  cantidad_mayor INT DEFAULT 0,
  codigo_barra VARCHAR(100) DEFAULT NULL,
  marca VARCHAR(100) DEFAULT NULL,
  moneda VARCHAR(10) DEFAULT 'PEN',
  marca_oem VARCHAR(100) DEFAULT NULL,
  proveedor_oem VARCHAR(100) DEFAULT NULL,
  codigo_oem VARCHAR(100) DEFAULT NULL,
  codigo_original VARCHAR(100) DEFAULT NULL,
  precio_dist1 NUMERIC(10,2) DEFAULT 0.00,
  precio_dist2 NUMERIC(10,2) DEFAULT 0.00,
  precio_dist3 NUMERIC(10,2) DEFAULT 0.00,
  imagen VARCHAR(255) DEFAULT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 7. TABLA: ordenes_trabajo
CREATE TABLE IF NOT EXISTS public.ordenes_trabajo (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  vehiculo_id INT NOT NULL REFERENCES public.vehiculos(id) ON DELETE RESTRICT,
  mecanico_id INT DEFAULT NULL REFERENCES public.usuarios(id) ON DELETE SET NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'recibido' CHECK (estado IN ('recibido', 'diagnostico', 'en_reparacion', 'espera_repuestos', 'listo', 'entregado', 'cancelado')),
  descripcion_problema TEXT NOT NULL,
  observaciones TEXT DEFAULT NULL,
  km_actual INT DEFAULT NULL,
  fecha_ingreso TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_estimada DATE DEFAULT NULL,
  fecha_entrega TIMESTAMPTZ DEFAULT NULL,
  mano_obra NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABLA: orden_servicios
CREATE TABLE IF NOT EXISTS public.orden_servicios (
  id SERIAL PRIMARY KEY,
  orden_id INT NOT NULL REFERENCES public.ordenes_trabajo(id) ON DELETE CASCADE,
  servicio_id INT NOT NULL REFERENCES public.servicios(id) ON DELETE RESTRICT,
  precio NUMERIC(10,2) NOT NULL,
  observacion TEXT DEFAULT NULL
);

-- 9. TABLA: orden_repuestos
CREATE TABLE IF NOT EXISTS public.orden_repuestos (
  id SERIAL PRIMARY KEY,
  orden_id INT NOT NULL REFERENCES public.ordenes_trabajo(id) ON DELETE CASCADE,
  repuesto_id INT DEFAULT NULL REFERENCES public.repuestos(id) ON DELETE SET NULL,
  cantidad INT NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(10,2) NOT NULL,
  repuesto_nombre VARCHAR(150) DEFAULT NULL
);

-- 10. TABLA: seguimiento
CREATE TABLE IF NOT EXISTS public.seguimiento (
  id SERIAL PRIMARY KEY,
  orden_id INT NOT NULL REFERENCES public.ordenes_trabajo(id) ON DELETE CASCADE,
  usuario_id INT DEFAULT NULL REFERENCES public.usuarios(id) ON DELETE SET NULL,
  estado VARCHAR(30) NOT NULL CHECK (estado IN ('recibido', 'diagnostico', 'en_reparacion', 'espera_repuestos', 'listo', 'entregado', 'cancelado')),
  comentario TEXT DEFAULT NULL,
  foto_url VARCHAR(255) DEFAULT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. TABLA: facturas
CREATE TABLE IF NOT EXISTS public.facturas (
  id SERIAL PRIMARY KEY,
  orden_id INT UNIQUE NOT NULL REFERENCES public.ordenes_trabajo(id) ON DELETE CASCADE,
  numero VARCHAR(30) UNIQUE NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  igv NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  estado_pago VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'parcial', 'pagado')),
  notas TEXT DEFAULT NULL,
  fecha_emision TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. TABLA: pagos
CREATE TABLE IF NOT EXISTS public.pagos (
  id SERIAL PRIMARY KEY,
  factura_id INT NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  monto NUMERIC(10,2) NOT NULL,
  metodo VARCHAR(20) NOT NULL CHECK (metodo IN ('efectivo', 'tarjeta', 'transferencia', 'yape', 'plin')),
  referencia VARCHAR(100) DEFAULT NULL,
  fecha_pago TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. TABLA: ventas
CREATE TABLE IF NOT EXISTS public.ventas (
  id SERIAL PRIMARY KEY,
  numero VARCHAR(30) UNIQUE NOT NULL,
  cliente_nombre VARCHAR(150) NOT NULL DEFAULT 'Cliente general',
  cliente_dni VARCHAR(20) DEFAULT NULL,
  metodo_pago VARCHAR(20) NOT NULL DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia', 'yape', 'plin')),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  igv NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  notas TEXT DEFAULT NULL,
  usuario_id INT DEFAULT NULL REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. TABLA: detalle_ventas
CREATE TABLE IF NOT EXISTS public.detalle_ventas (
  id SERIAL PRIMARY KEY,
  venta_id INT NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  repuesto_id INT DEFAULT NULL REFERENCES public.repuestos(id) ON DELETE SET NULL,
  cantidad INT NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  producto_nombre VARCHAR(150) DEFAULT NULL,
  producto_codigo VARCHAR(50) DEFAULT NULL,
  descuento NUMERIC(10,2) NOT NULL DEFAULT 0.00
);

-- =============================================================================
-- VISTAS
-- =============================================================================

CREATE OR REPLACE VIEW public.v_stock_bajo AS
SELECT 
  id, codigo, nombre, categoria, stock, stock_minimo
FROM public.repuestos
WHERE stock <= stock_minimo
ORDER BY (stock - stock_minimo) ASC;

CREATE OR REPLACE VIEW public.v_ordenes_resumen AS
SELECT 
  ot.id,
  ot.codigo,
  CONCAT(c.nombre, ' ', c.apellido) AS cliente,
  c.telefono,
  v.placa,
  CONCAT(v.marca, ' ', v.modelo) AS vehiculo,
  u.nombre AS mecanico,
  ot.estado,
  ot.fecha_ingreso,
  ot.fecha_estimada,
  COALESCE(f.total, 0) AS total_factura,
  f.estado_pago
FROM public.ordenes_trabajo ot
JOIN public.vehiculos v ON v.id = ot.vehiculo_id
JOIN public.clientes c ON c.id = v.cliente_id
LEFT JOIN public.usuarios u ON u.id = ot.mecanico_id
LEFT JOIN public.facturas f ON f.orden_id = ot.id;

CREATE OR REPLACE VIEW public.v_consulta_cliente AS
SELECT 
  ot.codigo AS orden,
  CONCAT(c.nombre, ' ', c.apellido) AS cliente,
  c.dni,
  v.placa,
  CONCAT(v.marca, ' ', v.modelo) AS vehiculo,
  ot.estado,
  ot.descripcion_problema AS problema,
  ot.fecha_ingreso,
  ot.fecha_estimada,
  s.comentario AS ultimo_comentario,
  s.fecha AS ultima_actualizacion
FROM public.ordenes_trabajo ot
JOIN public.vehiculos v ON v.id = ot.vehiculo_id
JOIN public.clientes c ON c.id = v.cliente_id
LEFT JOIN (
  SELECT seg.orden_id, seg.comentario, seg.fecha
  FROM public.seguimiento seg
  WHERE (seg.orden_id, seg.fecha) IN (
    SELECT orden_id, MAX(fecha) FROM public.seguimiento GROUP BY orden_id
  )
) s ON s.orden_id = ot.id;

-- =============================================================================
-- POLÍTICAS DE PERMISOS (Desactivar RLS para que la API REST funcione sin bloqueos)
-- =============================================================================
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculo_catalogos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.repuestos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_trabajo DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orden_servicios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orden_repuestos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguimiento DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_ventas DISABLE ROW LEVEL SECURITY;

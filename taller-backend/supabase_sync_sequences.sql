-- =============================================================================
-- SINCRONIZAR SECUENCIAS AUTOINCREMENTALES EN SUPABASE (POSTGRESQL)
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase
-- =============================================================================

SELECT setval('usuarios_id_seq', COALESCE((SELECT MAX(id) FROM public.usuarios), 0) + 1, false);
SELECT setval('clientes_id_seq', COALESCE((SELECT MAX(id) FROM public.clientes), 0) + 1, false);
SELECT setval('vehiculos_id_seq', COALESCE((SELECT MAX(id) FROM public.vehiculos), 0) + 1, false);
SELECT setval('vehiculo_catalogos_id_seq', COALESCE((SELECT MAX(id) FROM public.vehiculo_catalogos), 0) + 1, false);
SELECT setval('servicios_id_seq', COALESCE((SELECT MAX(id) FROM public.servicios), 0) + 1, false);
SELECT setval('repuestos_id_seq', COALESCE((SELECT MAX(id) FROM public.repuestos), 0) + 1, false);
SELECT setval('ordenes_trabajo_id_seq', COALESCE((SELECT MAX(id) FROM public.ordenes_trabajo), 0) + 1, false);
SELECT setval('orden_servicios_id_seq', COALESCE((SELECT MAX(id) FROM public.orden_servicios), 0) + 1, false);
SELECT setval('orden_repuestos_id_seq', COALESCE((SELECT MAX(id) FROM public.orden_repuestos), 0) + 1, false);
SELECT setval('seguimiento_id_seq', COALESCE((SELECT MAX(id) FROM public.seguimiento), 0) + 1, false);
SELECT setval('facturas_id_seq', COALESCE((SELECT MAX(id) FROM public.facturas), 0) + 1, false);
SELECT setval('pagos_id_seq', COALESCE((SELECT MAX(id) FROM public.pagos), 0) + 1, false);
SELECT setval('ventas_id_seq', COALESCE((SELECT MAX(id) FROM public.ventas), 0) + 1, false);
SELECT setval('detalle_ventas_id_seq', COALESCE((SELECT MAX(id) FROM public.detalle_ventas), 0) + 1, false);

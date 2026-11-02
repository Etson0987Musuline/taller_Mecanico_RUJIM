# Activación de cotizaciones

1. En el SQL Editor del proyecto Supabase, ejecutar `supabase_cotizaciones.sql`, después de la migración base existente. Incluye tabla privada y función transaccional de conversión.
2. En las variables de entorno **del backend**, configurar `SUPABASE_SERVICE_ROLE_KEY` con la clave secreta/service_role de ese mismo proyecto. Mantener `SUPABASE_URL`. También se admite que `SUPABASE_KEY` ya sea una clave service_role. Nunca poner claves secretas en Angular, archivos públicos o el repositorio.
3. Reiniciar o desplegar el backend y desplegar el frontend. El módulo aparecerá para administradores en `/dashboard/cotizaciones`; los enlaces del cliente usan `/cotizacion/:token`.

La configuración local contiene una clave pública: el módulo local devuelve 503 hasta configurar la clave privada. En producción, la migración ya está instalada y ambos proyectos fueron publicados el 2 de noviembre de 2026; la clave privada está configurada únicamente en el backend de Vercel.

## Flujo

- Seleccionar un vehículo ya registrado, describir el trabajo y agregar conceptos de mano de obra o repuestos del inventario. Precios en soles sin IGV; se añade 18%, igual que las órdenes existentes.
- Crear un presupuesto inmutable con vigencia de siete días. Copiar su enlace privado y enviarlo al cliente por el canal habitual. No se envían mensajes automáticamente.
- El cliente revisa importes y confirma nombre, decisión y consentimiento. Se guardan la fecha y el nombre declarado; no constituye verificación de identidad ni firma digital certificada. Quien posea el enlace puede responder; la página no revela DNI, teléfono, nombre del propietario ni identificadores internos.
- Solo se acepta la primera respuesta de una cotización pendiente y vigente. Para corregir una pendiente, anularla y emitir otra. La anulación invalida la posibilidad de responder al enlace anterior.
- Tras la aprobación, el administrador pulsa «Crear orden autorizada». Una transacción bloquea la cotización y los repuestos, suma las líneas repetidas, verifica stock y crea orden, detalles y seguimiento. Una repetición devuelve la misma orden. Un error revierte toda la operación.
- La mano de obra se transfiere al campo `mano_obra` y los repuestos a `orden_repuestos`; el desglose original permanece en la cotización y las tareas se anotan en seguimiento. La orden se crea recibida y sin mecánico asignado, para continuar por el flujo existente.
- La vigencia limita la respuesta del cliente; una aprobación dentro de plazo puede convertirse después, sujeta a stock disponible. Emitir no reserva existencias.

## Verificación

Backend: `node --test test/cotizaciones.test.js`. Frontend: `npm run build` y `npx ng test --watch=false --ts-config=tsconfig.cotizaciones.spec.json --include=src/app/pages/cotizaciones/cotizaciones.spec.ts`. Se usa una configuración de pruebas aislada porque las pruebas antiguas incluyen imports de clases renombradas y globals sin tipos.

Validación en Supabase de pruebas después de instalar el SQL: crear una cotización con dos líneas del mismo repuesto; aprobarla; convertir dos veces y comprobar una sola orden, importes iguales y un único descuento de stock. Repetir sin stock y comprobar que no se crean órdenes ni descuentos parciales. Comprobar respuestas vencidas/repetidas, anulación y que `anon` no puede leer la tabla ni ejecutar la función.

El script `supabase_enable_permissions.sql` de esta versión excluye y vuelve a proteger cotizaciones. No usar versiones antiguas de ese script después de esta migración: conceden acceso público a todas las tablas y funciones.

# Servicios, clientes y mantenimiento preventivo

## Arquitectura y alcance

Se conservan Angular standalone, Bootstrap, Express y Supabase/PostgreSQL. Las órdenes, clientes, vehículos, repuestos y facturas existentes siguen siendo la fuente de información. Los módulos nuevos se montan en `/api/programa` y en las rutas `/dashboard/programa` (personal) y `/dashboard/mi-cuenta` (cliente).

Antes del cambio había panel administrativo y de mecánico, y una consulta pública, sin un portal autenticado de cliente. Ahora los tres roles tienen secciones conectadas. Las consultas de órdenes por placa, DNI y nombre requieren una sesión y comprueban propiedad/asignación; el catálogo, contacto y los enlaces privados de cotizaciones permanecen públicos.

## Activación (requiere acceso al proyecto Supabase y al alojamiento)

1. Obtener una copia de seguridad del proyecto con las herramientas de Supabase antes de migrar. Conservar SQL, archivos del almacenamiento e información necesaria para restaurar. No ejecutar las migraciones sobre producción sin probar antes en un proyecto de pruebas.
2. En SQL Editor ejecutar `supabase_programa_taller.sql` sobre la base existente de `supabase_migration.sql`. Si también se usa cotizaciones, instalar previamente `supabase_cotizaciones.sql`. La migración es transaccional y se puede ejecutar de nuevo. Un índice impide correos de usuarios repetidos sin distinguir mayúsculas: si ya existen, la migración se detendrá para revisarlos sin borrar personas.
3. Configurar las variables privadas del backend según `.env.example`. Es obligatorio `SUPABASE_SERVICE_ROLE_KEY`: los datos privados dejan de ser accesibles con claves públicas. No publicar esta clave en Angular. Las claves/contraseñas existentes permanecen en el servidor; las de Google nunca se guardan en las tablas de la aplicación.
4. Configurar Google como proveedor en Supabase Auth y sus credenciales OAuth en Google Cloud. Usar el callback que indica Supabase en Google Cloud. En la lista permitida de redirecciones de Supabase añadir la URL pública de `/api/auth/google/callback` y permitir su query `state` (patrón con host exacto y sufijo `**` si el proveedor de configuración lo requiere).
5. En producción establecer `FRONTEND_URL=https://taller-mecanico-rujim-xnbl.vercel.app`, `AUTH_PUBLIC_URL=https://taller-mecanico-rujim-xnbl.vercel.app/api` y `COOKIE_SECURE=true`. En local: frontend `http://localhost:4200`, API pública `http://localhost:3000/api`, `COOKIE_SECURE=false`. No mezclar `localhost` con `127.0.0.1`. `SUPABASE_PUBLIC_KEY` es la clave pública de Auth del mismo proyecto.
6. Desplegar frontend y backend juntos. El frontend ahora usa `/api`, y su `vercel.json` lo envía al backend existente. Esto mantiene las cookies en el mismo sitio y evita depender de cookies de terceros. Al cambiar de dominio, actualizar esa reescritura y las variables anteriores. Se cerrarán las sesiones antiguas con JWT: el personal debe volver a ingresar.
7. Iniciar sesión con el administrador existente usando su contraseña. En **Usuarios**, editar la cuenta del personal y marcar **Autorizar acceso con Google**. El ingreso con Google conserva ese rol, nunca concede administración por sí mismo. Los nuevos clientes se crean únicamente como clientes y se vinculan a la ficha con el mismo correo verificado. Si hay varias fichas de cliente con el mismo correo, un administrador debe revisarlas primero. No se permite promover una cuenta de cliente a personal desde la edición habitual.

La tarea de desarrollo no ha ejecutado esta migración en la base real, configurado proveedores ni publicado cambios. La configuración local disponible usa una clave pública, insuficiente para activar los nuevos módulos.

## Sesiones y autorización

- Cookies de sesión aleatorias, HttpOnly, SameSite=Lax y Secure en producción, con vida de ocho horas. Solo se guarda su hash en la base. No hay tokens de autenticación en localStorage ni contraseñas de Google.
- Google se procesa con PKCE y estado de un solo uso en cookies de diez minutos. El servidor intercambia el código y consulta `auth.getUser` antes de vincular la identidad Google verificada. No se aceptan roles enviados por el navegador.
- Cada operación vuelve a verificar la sesión, cuenta activa y rol en la base. El cierre de sesión elimina el registro del servidor; cambiar accesos o desactivar una cuenta invalida sus sesiones. El acceso por contraseña se limita por correo a diez intentos por ventana de quince minutos.
- Mutaciones de navegador verifican Origin y usan una lista CORS explícita. Las respuestas de API no se guardan en caché.
- El cliente solo usa endpoints propios y datos filtrados por `cliente_id` del servidor. Las rutas internas no aceptan el rol cliente. Los mecánicos solo consultan órdenes/vehículos/clientes asignados y no modifican personal, facturación o fidelidad. Administración registra clientes/vehículos y asigna trabajos. Un vehículo también puede asignarse para mantenimiento preventivo.
- Se revocan los permisos públicos de tablas privadas, vistas y funciones. `supabase_enable_permissions.sql` se actualizó para conservar esta protección; no ejecutar una versión anterior que conceda permisos públicos.

## Servicio, aprobación y fidelización

1. Administrador registra cliente/vehículo y crea/asigna una orden usando los módulos habituales.
2. Mecánico completa trabajos y repuestos en su panel y entra en **Alertas, mantenimiento y reporte de servicios**.
3. Registra tipo de servicio, fecha, kilometraje, observaciones, fallas, recomendaciones y componentes atendidos con sus intervalos. Los trabajos y repuestos de la orden se guardan como una instantánea.
4. El reporte pasa a pendiente. No cuenta para fidelidad. Los importes y detalles de trabajos reportados quedan protegidos también con triggers de PostgreSQL para evitar cambios desde las rutas antiguas o solicitudes concurrentes.
5. Administrador aprueba o devuelve con motivo. Un reporte devuelto puede corregirse y reenviarse. Aprobar es una transacción: registra responsable/fecha, actualiza el kilometraje, las fichas preventivas, el historial y las recompensas. Repetir la aprobación no duplica el conteo.
6. Cada **orden aprobada cuenta como una visita**, independientemente de cuántas líneas de servicio tenga. No se cuentan pendientes, devueltas ni canceladas. Los registros anteriores al programa permanecen en el historial; requieren revisión y reporte antes de sumarse. No se modifican automáticamente servicios históricos ni se asume que estén aprobados.
7. Se incluyen hitos iniciales de 5/10/15 visitas y descuentos de 10/15/20%, con vigencia inicial de 90 días. Administrador puede configurar cantidades, porcentaje, vigencia y estado. Cada cliente recibe una sola recompensa por hito. Las recompensas ya emitidas conservan el porcentaje/vencimiento que se aprobó.
8. Al emitir la factura de una **orden ingresada después de generar la recompensa**, se utiliza automáticamente la mejor recompensa disponible y vigente. Aplica a mano de obra y servicios, sin incluir repuestos; solo una por factura. No aplica al servicio que la generó. La factura, consumo y autorización del descuento se guardan en una transacción y se registra el administrador. No se vuelve a descontar al reintentar. Las facturas existentes se conservan.

El portal consulta el mismo backend y actualiza su información cada 30 segundos sin reemplazar preferencias que se estén editando. Las estadísticas permiten filtrar por fechas, cliente, vehículo y tipo de servicio. El progreso acumulado siempre considera todo el historial aprobado; los conteos del período sí respetan filtros.

## Preventivo

Incluye aceite, filtros, frenos, neumáticos, suspensión, batería, refrigeración, transmisión, correas y sistema eléctrico; administración puede añadir componentes. Los intervalos iniciales son referencias para configurar, no recomendaciones universales. Cada vehículo tiene intervalos propios para adecuarlos al fabricante y al uso.

Se calcula el primer límite alcanzado por meses naturales o kilometraje. Antes del aviso: al día; dentro del margen: próximo; al alcanzar exactamente un límite: pendiente; después: vencido. El margen de aviso es configurable por componente. El kilometraje debe actualizarse con registros del taller; el sistema no dispone de telemetría del vehículo. No se permite reducir el kilometraje registrado. Una aprobación histórica no sobrescribe una ficha de mantenimiento más reciente.

## Recordatorios

- Preferencias por cliente: email y WhatsApp empiezan desactivados hasta que el cliente autorice cada canal. Las preferencias se vuelven a verificar antes de enviar. Los avisos internos preventivos también respetan su opción; las recompensas se registran en el historial de notificaciones.
- La cola tiene claves únicas por componente, ciclo, estado y canal. No se regenera el mismo aviso en cada ejecución. Antes de enviar se comprueba que el mantenimiento siga vigente y que el vehículo siga perteneciendo al destinatario.
- Correo: Resend con `RESEND_API_KEY` y `REMINDER_FROM` de un dominio verificado; utiliza `Idempotency-Key` por recordatorio.
- WhatsApp: integración oficial Cloud API de Meta con `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`, `WHATSAPP_TEMPLATE` y su idioma. La plantilla debe estar aprobada, con dos variables de cuerpo: nombre del cliente y texto del aviso. No se utiliza automatización de WhatsApp Web. Un mensaje aceptado por la API se marca enviado; no se afirma entrega al dispositivo sin webhooks de entrega.
- Administrador puede programar mensajes personalizados, elegir canal, generar preventivos, procesar cola, completar o cancelar, y consultar estados/errores. Los rechazos definitivos pueden reintentarse después de corregir su causa. Un envío interrumpido o de resultado incierto se marca **revisar** y no se reenvía automáticamente: hay que consultar el proveedor para evitar duplicados.
- El cron de Vercel está preparado diariamente a las 13:00 UTC (08:00 en Perú). Configurar `CRON_SECRET` largo y aleatorio en el backend. Vercel debe enviar `Authorization: Bearer <CRON_SECRET>`. La ejecución reclama hasta diez envíos por lote, uno por uno, con límite de tiempo. Para mayor volumen puede invocarse la misma ruta desde un programador con frecuencia mayor, según el plan de alojamiento. La interfaz mantiene visibles los pendientes; configurar el programador externo antes de afirmar que los envíos están automatizados en producción.
- No se enviaron correos ni WhatsApp reales durante el desarrollo.

## Respaldos

`node scripts/backup_seguro.js` obtiene una instantánea lógica consistente de las tablas de negocio del programa y la cifra con AES-256-GCM, comprimida. Requiere `BACKUP_ENCRYPTION_KEY` (32 bytes aleatorios en base64), que se debe conservar por separado; nunca imprime los datos ni la clave. Los archivos quedan en `taller-backend/backups`, excluido de Git. No se respaldan sesiones activas. `BACKUP_INCLUDE_QUOTES=true` añade cotizaciones como una exportación aparte, no en la misma instantánea transaccional.

Este respaldo complementa las copias del proyecto Supabase: no reemplaza un respaldo completo de esquemas, Auth, archivos o almacenamiento. Programar su ejecución y copia a un almacenamiento privado con la herramienta del servidor; definir retención y probar una restauración en un proyecto separado antes de usarlo como plan de recuperación. Nunca subir respaldos ni claves a Git.

## Verificación reproducible

- Backend: desde `taller-backend`, `node --test test/*.test.js`.
- PostgreSQL temporal: desde la raíz, `npm install --no-save --prefix .tmp/sql-check @electric-sql/pglite` y `node --test taller-backend/test/programa-db.test.mjs`. Los datos y roles de prueba se crean en memoria; no se consulta la base real. Incluye migraciones, vinculación Google, protección de roles, aprobación repetida, fechas de fin de mes, recompensas, facturación única, protección de trabajos, cola y compatibilidad de cotizaciones.
- Frontend: `npm run build` y `npx ng test --watch=false --ts-config=tsconfig.programa.spec.json --include=src/app/pages/programa/programa.spec.ts --include=src/app/pages/cotizaciones/cotizaciones.spec.ts`. La configuración aislada evita fallos previos de los tests antiguos que importan clases renombradas.
- En el proyecto de pruebas conectado: probar inicio/cierre de sesión real y cookies después de un reload, Google con cliente nuevo y existente, cuenta administrativa sin autorización, cliente intentando acceder a IDs ajenos, mecánico con orden no asignada, servicio pendiente/devuelto/aprobado, descuento vencido o utilizado, y consentimiento retirado antes del envío. Confirmar que anon y authenticated no acceden directamente a tablas privadas.

Referencias oficiales usadas: [Supabase Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [verificación del usuario](https://supabase.com/docs/reference/javascript/auth-getuser), [Resend](https://resend.com/docs/api-reference/emails/send-email), [plantillas oficiales de WhatsApp](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/).

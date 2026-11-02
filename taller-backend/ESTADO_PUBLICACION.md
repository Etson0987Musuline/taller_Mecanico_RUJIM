# Estado de publicación

Publicación autorizada por el propietario y ejecutada el 2 de noviembre de 2026. Commit funcional publicado: `9b69f03ebbc73ac7ca2fbc2c1f186f44be008809`.

## Destinos verificados

- Repositorio: `Etson0987Musuline/taller_Mecanico_RUJIM`, rama de producción `main`.
- Versión anterior de referencia para recuperación del código: `052a98263e0b948edf4b23169234438a55c70ace`. La restauración del código anterior también requiere revisar la compatibilidad de las sesiones y permisos nuevos; no promoverla sin esa revisión.
- Frontend Vercel: `ysalvatierradipaz-5700s-projects/taller-mecanico-rujim-xnbl`.
- Backend Vercel: `ysalvatierradipaz-5700s-projects/taller-mecanico-rujim-1rjj`.
- Supabase: organización `autos`, proyecto `auto`, referencia `momjaytehlpzwxysfphg`; coincide con la configuración local.

## Diagnóstico previo

- 2 usuarios, 7 clientes, 6 vehículos y 5 órdenes.
- No hay correos de usuario duplicados por mayúsculas/minúsculas.
- No existen las tablas nuevas de cotizaciones, sesiones o programa de fidelidad.
- La interfaz de Supabase indica que no hay respaldos registrados.
- Google está deshabilitado y no tiene Client ID configurado. Requiere las credenciales OAuth del propietario para habilitarlo.
- Vercel tiene SUPABASE_URL y SUPABASE_KEY. No se revelaron sus valores; no figuran las variables nuevas necesarias para el programa.
- El esquema public contiene también tablas drivers/routes/vehicles. No se deben modificar sus datos ni usar el script global de permisos para el corte de este taller.

## Acciones ejecutadas tras autorización

1. Crear una copia de las tablas del taller dentro del esquema privado `rujim_backup_preprograma_20261102` del mismo proyecto Supabase, con RLS y sin acceso anon/authenticated. SQL: `deployment_preflight.sql`; probado en PostgreSQL temporal.
2. Instalar las migraciones de cotizaciones y del programa, coordinando el cambio de permisos con el backend para evitar un corte por el uso actual de una clave pública.
3. Configurar la clave privada de Supabase exclusivamente en el backend de Vercel, junto con las URLs de producción, cookies y secreto del programador. Esta clave concede acceso amplio a la base y no debe incluirse en Git ni en el frontend.
4. Subir el código al repositorio y publicar frontend/backend coordinadamente. La autenticación cambia a sesiones del servidor y los usuarios deberán iniciar sesión nuevamente.
5. Verificar catálogo, login, paneles y APIs después de publicar. Google, Resend y WhatsApp requieren credenciales/configuración de sus respectivos proveedores antes de probar accesos o envíos reales.

## Resultado y pendientes

- El propietario autorizó expresamente respaldo, migración, configuración privada y publicación. El respaldo se creó en `rujim_backup_preprograma_20261102`, con 2 usuarios, 7 clientes, 6 vehículos y 5 órdenes, conservando las tablas originales.
- Cotizaciones y programa instalados; se separó temporalmente la revocación de permisos heredados para realizarla después de desplegar el backend nuevo. La revocación ya se completó.
- Vercel muestra frontend y backend Ready para el commit funcional. El proxy `/api` del frontend responde JSON desde el backend nuevo.
- Verificaciones de producción: catálogo público HTTP 200; `/api/auth/me` y `/api/programa/panel` HTTP 401 sin sesión; privilegio SELECT de anon en usuarios false y permiso INSERT de service_role en sesiones true.
- Variables nuevas guardadas como secretos exclusivamente en Production del backend. Ninguna clave privada se incluye en el repositorio.
- Site URL actualizado y callback exacto del backend registrado sin comodines. La revisión automática rechazó un comodín amplio; se sustituyó por la ruta exacta implementada. Google sigue deshabilitado, sin credenciales OAuth del propietario.
- Pendiente completar la comprobación administrativa con la sesión del propietario y configurar los proveedores de Google, Resend y WhatsApp para probar esas integraciones reales. No se enviaron mensajes reales de prueba.

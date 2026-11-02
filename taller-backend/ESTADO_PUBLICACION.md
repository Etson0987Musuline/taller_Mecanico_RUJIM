# Publicación pendiente de autorización

Revisión del 2 de noviembre de 2026, sin desplegar ni ejecutar migraciones de producción.

## Destinos verificados

- Repositorio: `Etson0987Musuline/taller_Mecanico_RUJIM`, rama de producción `main`.
- Commit actual local y publicado: `052a98263e0b948edf4b23169234438a55c70ace`.
- Frontend Vercel: `ysalvatierradipaz-5700s-projects/taller-mecanico-rujim-xnbl`.
- Backend Vercel: `ysalvatierradipaz-5700s-projects/taller-mecanico-rujim-1rjj`.
- Supabase: organización `autos`, proyecto `auto`, referencia `momjaytehlpzwxysfphg`; coincide con la configuración local.

## Diagnóstico de solo lectura

- 2 usuarios, 7 clientes, 6 vehículos y 5 órdenes.
- No hay correos de usuario duplicados por mayúsculas/minúsculas.
- No existen las tablas nuevas de cotizaciones, sesiones o programa de fidelidad.
- La interfaz de Supabase indica que no hay respaldos registrados.
- Google está deshabilitado y no tiene Client ID configurado. Requiere las credenciales OAuth del propietario para habilitarlo.
- Vercel tiene SUPABASE_URL y SUPABASE_KEY. No se revelaron sus valores; no figuran las variables nuevas necesarias para el programa.
- El esquema public contiene también tablas drivers/routes/vehicles. No se deben modificar sus datos ni usar el script global de permisos para el corte de este taller.

## Acciones preparadas para autorización

1. Crear una copia de las tablas del taller dentro del esquema privado `rujim_backup_preprograma_20261102` del mismo proyecto Supabase, con RLS y sin acceso anon/authenticated. SQL: `deployment_preflight.sql`; probado en PostgreSQL temporal.
2. Instalar las migraciones de cotizaciones y del programa, coordinando el cambio de permisos con el backend para evitar un corte por el uso actual de una clave pública.
3. Configurar la clave privada de Supabase exclusivamente en el backend de Vercel, junto con las URLs de producción, cookies y secreto del programador. Esta clave concede acceso amplio a la base y no debe incluirse en Git ni en el frontend.
4. Subir el código al repositorio y publicar frontend/backend coordinadamente. La autenticación cambia a sesiones del servidor y los usuarios deberán iniciar sesión nuevamente.
5. Verificar catálogo, login, paneles y APIs después de publicar. Google, Resend y WhatsApp requieren credenciales/configuración de sus respectivos proveedores antes de probar accesos o envíos reales.

## Bloqueo actual

La revisión automática de permisos rechazó el clic Run del respaldo de producción porque no había autorización explícita para crear el esquema y copiar datos privados. El respaldo no se ejecutó. No se intentó eludir el rechazo. Se requiere autorización expresa del propietario para las mutaciones y para transferir la clave privada de Supabase al backend de Vercel.

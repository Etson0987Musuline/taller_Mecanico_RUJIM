# Configuración de registro y acceso con Google

Verificación pública del 4 de noviembre de 2026: Supabase devuelve `external.google=false`. La integración no está activada. El inicio ahora comprueba ese estado antes de abrir OAuth y vuelve al login con una explicación si está deshabilitado o inaccesible.

1. En Google Cloud, seleccionar o crear un proyecto del taller. Si Google exige verificar la cuenta o aceptar condiciones, el propietario debe completar ese paso personalmente.
2. En Google Auth Platform, configurar Branding (nombre del taller y correo de soporte del propietario), Audience (External para clientes externos) y contacto. Solicitar únicamente openid, email y profile. Si la aplicación queda en Testing, añadir las cuentas de prueba en Audience antes de probar; para clientes generales revisar la publicación a Production y cualquier requisito mostrado por Google.
3. Crear un cliente OAuth de tipo Web application. Origen JavaScript autorizado: `https://taller-mecanico-rujim-xnbl.vercel.app`. URI de redirección autorizada: `https://momjaytehlpzwxysfphg.supabase.co/auth/v1/callback`.
4. En Supabase, proyecto `momjaytehlpzwxysfphg`, Authentication > Sign In / Providers > Google: guardar el Client ID y Client Secret y habilitar Google. El secreto se guarda directamente en Supabase; nunca en Git, frontend ni chat.
5. En Authentication > URL Configuration: Site URL `https://taller-mecanico-rujim-xnbl.vercel.app`; Redirect URL del taller `https://taller-mecanico-rujim-xnbl.vercel.app/api/auth/google/callback`. Esta ruta del taller es distinta del callback de Supabase registrado en Google Cloud.
6. El backend usa SUPABASE_URL, SUPABASE_PUBLIC_KEY y AUTH_PUBLIC_URL (URL pública del frontend con `/api`), más FRONTEND_URL y su clave privada de base de datos. Mantener cookies seguras en producción. No sustituir la clave pública de Auth por una clave privada.
7. Comprobar que `/auth/v1/settings` devuelve Google habilitado; probar desde el botón de la web con una cuenta autorizada de prueba. El cliente nuevo se crea como cliente. El personal existente requiere autorización explícita en el taller y conserva su rol; nunca se concede administración automáticamente.

Una respuesta `external.google=true` confirma la activación, pero no prueba por sí sola el Client Secret, el callback ni los permisos. La comprobación completa requiere terminar el acceso en Google y volver al panel correcto del taller.

Referencia: https://supabase.com/docs/guides/auth/social-sign-in/auth-google

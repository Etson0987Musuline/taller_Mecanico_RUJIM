# Correo y contraseña con Supabase Auth

Aplicar `supabase_password_auth.sql` antes del backend. Añade una identidad opcional, única y con referencia a `auth.users`; no modifica roles ni cuentas existentes.

Crear la identidad desde Authentication > Users de Supabase, con el correo autorizado y una contraseña elegida por el propietario directamente en esa interfaz. Asociar su UUID explícitamente a la cuenta correcta de `public.usuarios`, conservando su ID, rol y relaciones. Si cambia el correo, comprobar que no exista otra cuenta con ese correo. Registrar el cambio en auditoría y revocar las sesiones anteriores en la misma transacción. Nunca asociar automáticamente por correo ni desde metadatos enviados por el navegador.

El login consulta la cuenta activa del taller. Si tiene `supabase_uid`, valida la contraseña en el endpoint de Supabase Auth y exige UUID, correo coincidente y confirmación del correo. No acepta la contraseña heredada para cuentas vinculadas. Las cuentas todavía sin vincular mantienen su acceso anterior. Una identidad de Auth sin asociación no obtiene acceso al taller ni permisos administrativos.

El backend usa la clave pública para el intercambio de contraseña y conserva su cliente administrativo separado. No devuelve tokens de Auth al navegador; emite la sesión HttpOnly revocable existente. El correo y la contraseña de cuentas vinculadas se administran en Supabase Auth; el editor de usuarios del taller rechaza esos cambios para evitar inconsistencias.

El botón Google se retiró del login. Su ruta existente queda disponible para una futura configuración, pero no se necesita para entrar por contraseña. No se ha habilitado registro público ni recuperación por correo como parte de este cambio.

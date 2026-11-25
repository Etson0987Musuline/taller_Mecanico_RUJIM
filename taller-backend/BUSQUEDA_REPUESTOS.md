# Búsqueda de repuestos

Los buscadores de Repuestos, Ventas, Órdenes, Mecánico e Inicio buscan en nombre,
descripción, categoría, marca y códigos. Combinan las palabras de la consulta
en cualquier orden e ignoran tildes, mayúsculas y espacios repetidos.

En Repuestos, escribir al menos tres caracteres y pulsar **Sugerencias de internet**
consulta páginas web y muestra sus títulos, descripciones y enlaces dentro del panel.
No agrega productos al inventario ni atribuye precios o disponibilidad al taller.
Modificar la consulta cancela la petición anterior y retira sus sugerencias.

## Activación

1. Obtener una clave de Tavily Search.
2. Configurar `TAVILY_API_KEY` como secreto del backend en el entorno deseado.
   En desarrollo se utiliza `taller-backend/.env`. Nunca ponerla en Angular ni Git.
3. Publicar juntos el frontend y el backend actualizados. Reiniciar el servidor local
   si se acaba de agregar la variable en desarrollo.
4. Entrar como administrador o mecánico y probar una búsqueda de repuesto.

La ruta `GET /api/repuestos/sugerencias-web?q=...` requiere sesión de personal,
limita cada cuenta a diez consultas por minuto y aplica un tiempo de espera de doce
segundos. Sin clave devuelve un mensaje de configuración pendiente; un error del
proveedor no afecta el inventario. No se habilitan suscripciones ni se configuran
credenciales automáticamente.

Documentación del proveedor:
https://docs.tavily.com/documentation/api-reference/endpoint/search

Se fuerza `search_depth: basic` y se desactiva `auto_parameters` para conservar
el costo de una búsqueda básica y evitar el ascenso automático a modo avanzado.

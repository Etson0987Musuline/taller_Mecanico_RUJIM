export function normalizarBusqueda(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

export function coincideRepuesto(repuesto: Record<string, unknown>, consulta: string): boolean {
  const palabras = normalizarBusqueda(consulta).split(' ').filter(Boolean);
  const texto = normalizarBusqueda([
    repuesto['nombre'], repuesto['descripcion'], repuesto['codigo'],
    repuesto['categoria'], repuesto['marca'], repuesto['codigo_barra'],
    repuesto['codigo_original'], repuesto['codigo_oem'], repuesto['marca_oem'],
  ].filter(value => value != null).join(' '));
  return palabras.every(palabra => texto.includes(palabra));
}

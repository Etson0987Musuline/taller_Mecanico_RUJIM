import { describe, expect, it } from 'vitest';
import { coincideRepuesto } from './busqueda-repuestos';

describe('Búsqueda de repuestos', () => {
  const repuesto = { nombre: 'Bomba eléctrica', descripcion: 'Combustible para Toyota Corolla 2014', codigo_original: '23220-12345', codigo_barra: 123456 };
  it('combina palabras del nombre y la descripción en cualquier orden y sin tildes', () => {
    expect(coincideRepuesto(repuesto, '  TOYOTA   electrica ')).toBe(true);
    expect(coincideRepuesto(repuesto, 'corolla combustible')).toBe(true);
    expect(coincideRepuesto(repuesto, 'bomba honda')).toBe(false);
  });
  it('encuentra códigos originales y códigos de barras numéricos', () => {
    expect(coincideRepuesto(repuesto, '23220-12345')).toBe(true);
    expect(coincideRepuesto(repuesto, '123456')).toBe(true);
  });
  it('tolera campos ausentes y conserva todo el catálogo al vaciar el buscador', () => {
    expect(coincideRepuesto({ nombre: null }, 'filtro')).toBe(false);
    expect(coincideRepuesto({}, '  ')).toBe(true);
  });
});

import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { Subject, of, throwError } from 'rxjs';
import { RepuestosComponent } from './repuestos';

function componente() {
  const component = Object.create(RepuestosComponent.prototype) as RepuestosComponent;
  Object.assign(component, { busqueda: 'filtro Toyota', repuestos: [], filtrados: [], seleccionados: new Set(), cdr: { detectChanges: vi.fn() }, sugerenciasWeb: [], buscandoWeb: false, consultaWeb: '', errorWeb: '', url: '/api/repuestos' });
  return component;
}

describe('Sugerencias web de repuestos', () => {
  it('muestra sugerencias dentro del catálogo sin incorporarlas al inventario', () => {
    const c = componente();
    const resultados = [{ titulo: 'Filtro', descripcion: 'Información externa', url: 'https://ejemplo.test', dominio: 'ejemplo.test' }];
    const get = vi.fn(() => of({ resultados })); Object.assign(c, { http: { get } });
    c.buscarEnInternet();
    expect(get).toHaveBeenCalledWith('/api/repuestos/sugerencias-web', { params: { q: 'filtro Toyota' } });
    expect(c.sugerenciasWeb).toEqual(resultados); expect(c.repuestos).toEqual([]); expect(c.buscandoWeb).toBe(false);
  });
  it('cancela una búsqueda anterior al editar el texto y descarta sus resultados', () => {
    const c = componente(), respuesta = new Subject<any>(); Object.assign(c, { http: { get: () => respuesta } });
    c.buscarEnInternet(); c.busqueda = 'bomba'; c.filtrar();
    respuesta.next({ resultados: [{ titulo: 'Filtro anterior' }] });
    expect(c.consultaWeb).toBe(''); expect(c.sugerenciasWeb).toEqual([]); expect(c.buscandoWeb).toBe(false);
  });
  it('explica la falta de configuración sin perder los resultados locales', () => {
    const c = componente(); c.filtrados = [{ nombre: 'Filtro local' }];
    Object.assign(c, { http: { get: () => throwError(() => ({ error: { mensaje: 'Proveedor pendiente de configuración.' } })) } });
    c.buscarEnInternet(); expect(c.errorWeb).toContain('pendiente'); expect(c.filtrados).toHaveLength(1); expect(c.buscandoWeb).toBe(false);
  });
});

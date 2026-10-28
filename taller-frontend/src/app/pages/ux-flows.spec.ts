import '@angular/compiler';
import { describe, it, expect, vi } from 'vitest';
import { OrdenesComponent } from './ordenes/ordenes';
import { ConsultaPublicaComponent } from './consulta-publica/consulta-publica';

function nuevaOrden(form: any = {}) {
  const component = Object.create(OrdenesComponent.prototype) as OrdenesComponent;
  component.ordenForm = form;
  component.pasoNueva = 1;
  component.errorNueva = '';
  return component;
}

describe('Registro guiado de órdenes', () => {
  it('requiere un vehículo y un problema que no sea solo espacios', () => {
    const component = nuevaOrden({ vehiculo_id: 1, descripcion_problema: '   ' });
    component.avanzarNueva();
    expect(component.pasoNueva).toBe(1);
    expect(component.errorNueva).toBeTruthy();
  });
  it('rechaza importes negativos antes de avanzar', () => {
    const component = nuevaOrden({ vehiculo_id: 1, descripcion_problema: 'Ruido', mano_obra: -10 });
    component.avanzarNueva();
    expect(component.pasoNueva).toBe(1);
    expect(component.errorNueva).toBeTruthy();
  });
  it('permite registrar sin mecánico ni fecha definida y llega a confirmación', () => {
    const component = nuevaOrden({ vehiculo_id: 1, descripcion_problema: 'Ruido', mano_obra: 0 });
    component.avanzarNueva();
    expect(component.pasoNueva).toBe(2);
    component.avanzarNueva();
    component.avanzarNueva();
    expect(component.pasoNueva).toBe(3);
  });
  it('evita crear dos veces mientras se está guardando', () => {
    const component = nuevaOrden({ vehiculo_id: 1, descripcion_problema: 'Ruido' });
    component.guardando = true;
    const create = vi.fn();
    (component as any).ordenesService = { create };
    component.guardarOrden();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('Seguimiento del cliente', () => {
  const component = Object.create(ConsultaPublicaComponent.prototype) as ConsultaPublicaComponent;
  it('una cancelación no se presenta como avance de la reparación', () => {
    expect(component.getProgressPercentage('cancelado')).toBe(0);
  });
  it('explica la espera de repuestos sin inventar fechas', () => {
    expect(component.getSiguientePaso('espera_repuestos')).toContain('Consulta al taller');
  });
  it('ofrece una salida comprensible para estados desconocidos', () => {
    expect(component.getSiguientePaso('desconocido')).toContain('Consulta al taller');
  });
});

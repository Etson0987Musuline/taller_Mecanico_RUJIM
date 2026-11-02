import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CotizacionPublicaComponent } from './cotizacion-publica';
import { CotizacionesService } from '../../core/services/cotizaciones.service';

describe('Respuesta a cotizaciones', () => {
  const token = 'a'.repeat(64);
  const presupuesto = { codigo: 'COT-TEST', descripcion: 'Cambio de aceite', estado: 'pendiente', subtotal: 100, igv: 18, total: 118, items: [{tipo:'mano_obra',descripcion:'Cambio',cantidad:1,precio_unitario:100}], vence_at: new Date(Date.now()+86400000).toISOString() };
  let api: { consultar: ReturnType<typeof vi.fn>; responder: ReturnType<typeof vi.fn> };
  beforeEach(async () => {
    api = { consultar: vi.fn(() => of({...presupuesto})), responder: vi.fn(() => of({...presupuesto,estado:'aprobada',aprobado_por:'Cliente Prueba',respondido_at:new Date().toISOString()})) };
    await TestBed.configureTestingModule({imports:[CotizacionPublicaComponent],providers:[provideRouter([]),{provide:ActivatedRoute,useValue:{snapshot:{paramMap:convertToParamMap({token})}}},{provide:CotizacionesService,useValue:api}]}).compileComponents();
  });
  it('muestra importes y requiere consentimiento antes de registrar una decisión', () => {
    const f=TestBed.createComponent(CotizacionPublicaComponent); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('118.00');
    const c=f.componentInstance; c.nombre='Cliente Prueba'; c.decision='aprobada'; c.responder();
    expect(api.responder).not.toHaveBeenCalled();
    c.consentimiento=true; c.responder(); f.detectChanges();
    expect(api.responder).toHaveBeenCalledWith(token,'aprobada','Cliente Prueba');
    expect(f.nativeElement.textContent).toContain('Respuesta registrada');
    expect(f.nativeElement.querySelector('form')).toBeNull();
  });
  it('una cotización vencida no permite responder', () => {
    api.consultar.mockReturnValue(of({...presupuesto,vence_at:'2020-01-01T00:00:00Z'}));
    const f=TestBed.createComponent(CotizacionPublicaComponent); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Este presupuesto venció');
    expect(f.nativeElement.querySelector('form')).toBeNull();
    Object.assign(f.componentInstance,{nombre:'Cliente',decision:'aprobada',consentimiento:true}); f.componentInstance.responder();
    expect(api.responder).not.toHaveBeenCalled();
  });
  it('muestra el conflicto del servidor sin registrar una aprobación local', () => {
    api.responder.mockReturnValue(throwError(() => ({error:{mensaje:'La cotización venció o ya tiene una respuesta.'}})));
    const f=TestBed.createComponent(CotizacionPublicaComponent); f.detectChanges();
    Object.assign(f.componentInstance,{nombre:'Cliente',decision:'aprobada',consentimiento:true}); f.componentInstance.responder(); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('ya tiene una respuesta');
    expect(f.componentInstance.cotizacion?.estado).toBe('pendiente');
    expect(f.componentInstance.guardando).toBe(false);
  });
});

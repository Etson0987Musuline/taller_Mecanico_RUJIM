import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgramaComponent } from './programa';
import { ProgramaService } from '../../core/services/programa.service';
describe('Panel integrado de servicios', () => {
  let datos: any, api: any;
  beforeEach(async () => {
    datos = {
      usuario: { id: 1, rol: 'cliente', nombre: 'Cliente' },
      clientes: [{ id: 1, nombre: 'Cliente', apellido: 'Prueba' }],
      vehiculos: [{ id: 1, placa: 'TEST-001', cliente_id: 1, km_ingreso: 1000 }],
      ordenes: [],
      reportes: [
        { id: 1, estado: 'aprobado' },
        { id: 2, estado: 'pendiente' },
      ],
      reglas: [{ id: 1, servicios: 5, porcentaje: 10, activo: true }],
      tipos: [],
      mantenimientos: [],
      recompensas: [],
      recordatorios: [],
      alertas: [],
      personal: [],
      preferencias: { email: false, whatsapp: false, interna: true },
    };
    api = {
      panel: vi.fn(() => of(datos)),
      estadisticas: vi.fn(() =>
        of({ total_servicios: 1, por_cliente: [], proximos_descuento: [], clientes_inactivos: [] }),
      ),
      enviar: vi.fn(() => of({})),
    };
    await TestBed.configureTestingModule({
      imports: [ProgramaComponent],
      providers: [provideRouter([]), { provide: ProgramaService, useValue: api }],
    }).compileComponents();
  });
  it('el cliente ve su progreso y no ve configuración ni aprobación administrativa', async () => {
    const f = TestBed.createComponent(ProgramaComponent);
    f.detectChanges();
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('1 servicios acumulados');
    expect(f.nativeElement.textContent).toContain('Te faltan 4');
    expect(f.nativeElement.textContent).not.toContain('Configurar programa');
    Array.from<HTMLButtonElement>(f.nativeElement.querySelectorAll('nav button'))
      .find((b) => b.textContent?.includes('Servicios e historial'))!
      .click();
    await f.whenStable();
    expect(f.nativeElement.textContent).not.toContain('Aprobar servicio');
    expect(f.nativeElement.textContent).not.toContain('Reportar servicio finalizado');
  });
  it('el administrador revisa reportes y configura hitos', async () => {
    datos.usuario.rol = 'admin';
    const f = TestBed.createComponent(ProgramaComponent);
    f.detectChanges();
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Configurar programa');
    Array.from<HTMLButtonElement>(f.nativeElement.querySelectorAll('nav button'))
      .find((b) => b.textContent?.includes('Servicios e historial'))!
      .click();
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Aprobar servicio');
    f.componentInstance.revisar({ id: 2 }, true);
    expect(api.enviar).toHaveBeenCalledWith('reportes/2/revisar', { aprobar: true, motivo: '' });
  });
  it('el mecánico inicia en alertas y reporta únicamente componentes seleccionados', () => {
    datos.usuario.rol = 'mecanico';
    const f = TestBed.createComponent(ProgramaComponent);
    f.detectChanges();
    expect(f.componentInstance.tab).toBe('notificaciones');
    f.componentInstance.reporte.orden_id = 9;
    f.componentInstance.componentes = [
      { tipo_id: 1, elegido: true, meses: 6, intervalo_km: 5000 },
      { tipo_id: 2, elegido: false, meses: 12, intervalo_km: 10000 },
    ];
    f.componentInstance.reportar();
    const envio = api.enviar.mock.calls[0];
    expect(envio[0]).toBe('ordenes/9/reportar');
    expect(envio[1].mantenimientos).toHaveLength(1);
    expect(envio[1].mantenimientos[0].tipo_id).toBe(1);
  });
  it('guarda las preferencias explícitas sin activar canales externos por defecto', () => {
    const f = TestBed.createComponent(ProgramaComponent);
    f.detectChanges();
    f.componentInstance.guardarPreferencias();
    expect(api.enviar).toHaveBeenCalledWith(
      'preferencias',
      { email: false, whatsapp: false, interna: true },
      'patch',
    );
  });
});

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/services/auth.service';
import { HomeComponent } from '../../../pages/dashboard/home/home';
import { MecanicoComponent } from '../../../pages/mecanico/mecanico';
import { OrdenesComponent } from '../../../pages/ordenes/ordenes';

const orden = { id: 42, cliente: 'Cliente de prueba', telefono: '+51 987 654 321', placa: 'TEST-001', codigo: 'OT-42', estado: 'listo', vehiculo: 'Auto de prueba' };

describe('Acceso a WhatsApp en los paneles', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it.each(['home', 'mecanico', 'ordenes-admin', 'ordenes-mecanico'])('%s abre el mensaje del cliente seleccionado', async panel => {
    const tipo = panel === 'home' ? HomeComponent : panel === 'mecanico' ? MecanicoComponent : OrdenesComponent;
    // Los datos de prueba sustituyen la carga inicial; no se usan cuentas ni órdenes reales.
    vi.spyOn(tipo.prototype, 'ngOnInit').mockImplementation(() => {});
    const rol = panel.includes('mecanico') ? 'mecanico' : 'admin';
    await TestBed.configureTestingModule({
      imports: [tipo],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), {
        provide: AuthService, useValue: { getUsuario: () => ({ id: 7, rol }), getRol: () => rol },
      }],
    }).compileComponents();
    const f = TestBed.createComponent<any>(tipo);
    if (panel === 'home') {
      f.componentInstance.cargando = false;
      f.componentInstance.stats = {};
      f.componentInstance.ordenesListas = [orden];
    } else if (panel === 'mecanico') {
      f.componentInstance.misTrabajos = [orden];
    } else {
      f.componentInstance.ordenes = [orden];
      f.componentInstance.filtradas = [orden];
    }
    f.detectChanges(); await f.whenStable();
    const buttons = Array.from(f.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const button = buttons.find(b => b.textContent?.includes('Avisar por WhatsApp') || b.textContent?.includes('Mensaje al cliente') || b.getAttribute('aria-label') === 'Notificar cliente por WhatsApp');
    expect(button).toBeDefined();
    button!.click(); f.detectChanges(); await f.whenStable(); f.detectChanges();
    const dialog = f.nativeElement.querySelector('app-whatsapp-cliente');
    expect(dialog.textContent).toContain('Cliente de prueba');
    const link = dialog.querySelector('a[target="_blank"]');
    expect(new URL(link.href).pathname).toBe('/51987654321');
    expect(new URL(link.href).searchParams.get('text')).toContain('OT-42');
    dialog.querySelector('button[aria-label="Cerrar mensaje"]').click(); f.detectChanges();
    expect(f.nativeElement.querySelector('app-whatsapp-cliente')).toBeNull();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});

import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { normalizarTelefonoWhatsApp, WhatsappClienteComponent } from './whatsapp-cliente';

describe('Teléfonos de WhatsApp', () => {
  it.each(['987654321', '987 654 321', '+51 987-654-321', '(51) 987 654 321', '0051 987654321', 987654321])('normaliza el celular peruano %s', value => {
    expect(normalizarTelefonoWhatsApp(value)).toBe('51987654321');
  });
  it('conserva un número internacional sin duplicar el país', () => {
    expect(normalizarTelefonoWhatsApp('+1 (202) 555-0123')).toBe('12025550123');
  });
  it.each(['', null, undefined, '123', '123456789', '+51 123456789', '519876543210', '987abc654321', '987654321 / 912345678', '0000000000', '1234567890123456'])('rechaza el teléfono inválido %s', value => {
    expect(normalizarTelefonoWhatsApp(value)).toBeNull();
  });
});

describe('Mensaje al cliente desde los paneles', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [WhatsappClienteComponent] }).compileComponents();
  });

  async function crear(telefono: string | null = '987654321') {
    const f = TestBed.createComponent(WhatsappClienteComponent);
    f.componentRef.setInput('orden', { telefono, cliente: 'Cliente de prueba', placa: 'TEST-001', codigo: 'OT-1', vehiculo: 'Auto de prueba', estado: 'listo' });
    f.detectChanges();
    await f.whenStable();
    return f;
  }

  it('actualiza el destino después de editar el teléfono y codifica todo el mensaje', async () => {
    const f = await crear();
    const input = f.nativeElement.querySelector('input');
    const textarea = f.nativeElement.querySelector('textarea');
    input.value = '+51 912 345 678'; input.dispatchEvent(new Event('input'));
    textarea.value = 'Revisión & entrega\n¿Está disponible? #1 🚗'; textarea.dispatchEvent(new Event('input'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    const anchor = f.nativeElement.querySelector('a[target="_blank"]');
    const url = new URL(anchor.href);
    expect(url.pathname).toBe('/51912345678');
    expect(url.searchParams.get('text')).toBe(textarea.value);
    expect(anchor.rel).toBe('noopener noreferrer');
    expect(f.nativeElement.querySelector('a[target="_self"]').href).toBe(anchor.href);
  });

  it('no abre números inválidos o mensajes vacíos y permite corregirlos', async () => {
    const f = await crear(null);
    expect(f.nativeElement.querySelector('a')).toBeNull();
    expect(f.nativeElement.textContent).toContain('no tiene teléfono');
    const input = f.nativeElement.querySelector('input');
    const textarea = f.nativeElement.querySelector('textarea');
    input.value = '123'; input.dispatchEvent(new Event('input'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.querySelector('a')).toBeNull();
    input.value = '987654321'; input.dispatchEvent(new Event('input'));
    textarea.value = '  '; textarea.dispatchEvent(new Event('input'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Escribe un mensaje');
    textarea.value = 'Hola'; textarea.dispatchEvent(new Event('input'));
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    expect(f.nativeElement.querySelector('a[target="_blank"]')).not.toBeNull();
  });

  it('mantiene el borrador al abrir WhatsApp y no afirma que el cliente pagó o recibió el mensaje', async () => {
    const f = await crear();
    const cerrar = vi.fn(); f.componentInstance.cerrar.subscribe(cerrar);
    const mensaje = f.componentInstance.mensaje;
    const anchor = f.nativeElement.querySelector('a[target="_blank"]');
    // Impide navegar en la prueba: no se contacta con WhatsApp ni con un cliente.
    anchor.addEventListener('click', (e: Event) => e.preventDefault());
    anchor.click(); f.detectChanges();
    expect(cerrar).not.toHaveBeenCalled();
    expect(f.componentInstance.mensaje).toBe(mensaje);
    expect(mensaje).toContain('confirmar si existe un saldo pendiente');
    expect(mensaje).not.toContain('Total liquidado');
    expect(f.nativeElement.textContent).toContain('Abrir el enlace no confirma el envío');
  });

  it('usa el estado real de la orden y reinicia los datos al seleccionar otro cliente', async () => {
    const f = await crear();
    f.componentRef.setInput('orden', { telefono: '912345678', cliente: 'Otro cliente', placa: 'TEST-002', codigo: 'OT-2', estado: 'espera_repuestos' });
    f.detectChanges();
    expect(f.componentInstance.numero).toBe('51912345678');
    expect(f.componentInstance.mensaje).toContain('en espera de repuestos');
    expect(f.componentInstance.mensaje).not.toContain('TEST-001');
  });
});

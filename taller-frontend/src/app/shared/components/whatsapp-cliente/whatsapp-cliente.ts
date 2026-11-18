import { Component, EventEmitter, HostListener, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// wa.me acepta un número internacional, sin espacios, signos ni paréntesis.
export function normalizarTelefonoWhatsApp(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw || !/^\+?[\d\s().-]+$/.test(raw)) return null;
  let phone = raw.replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (/^9\d{8}$/.test(phone)) phone = '51' + phone;
  if (phone.startsWith('51')) return /^519\d{8}$/.test(phone) ? phone : null;
  return /^[1-9]\d{9,14}$/.test(phone) ? phone : null;
}

export interface OrdenContacto {
  telefono?: string | number | null;
  cliente?: string;
  vehiculo?: string;
  placa?: string;
  codigo?: string | number;
  estado?: string;
}

@Component({
  selector: 'app-whatsapp-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './whatsapp-cliente.html',
  styleUrl: './whatsapp-cliente.css',
})
export class WhatsappClienteComponent implements OnChanges {
  @Input({ required: true }) orden!: OrdenContacto;
  @Output() cerrar = new EventEmitter<void>();
  telefono = '';
  mensaje = '';
  plantilla = 'avance';

  ngOnChanges(): void {
    this.telefono = String(this.orden?.telefono ?? '');
    this.seleccionarPlantilla(this.orden?.estado === 'listo' ? 'listo' : 'avance');
  }

  @HostListener('document:keydown.escape')
  cerrarDialogo(): void { this.cerrar.emit(); }

  get numero(): string | null { return normalizarTelefonoWhatsApp(this.telefono); }

  get error(): string {
    if (!this.telefono.trim()) return 'El cliente no tiene teléfono. Ingresa su número de WhatsApp para continuar.';
    if (!this.numero) return 'Revisa el teléfono: en Perú usa 9 dígitos que empiecen con 9, o +51 seguido del celular. Para otro país incluye su código internacional.';
    if (!this.mensaje.trim()) return 'Escribe un mensaje para el cliente.';
    return '';
  }

  get enlace(): string | null {
    if (this.error) return null;
    return `https://wa.me/${this.numero}?text=${encodeURIComponent(this.mensaje.trim())}`;
  }

  seleccionarPlantilla(tipo: string): void {
    this.plantilla = tipo;
    const o = this.orden || {};
    const estados: Record<string, string> = {
      recibido: 'recibido', diagnostico: 'en diagnóstico', en_reparacion: 'en reparación',
      espera_repuestos: 'en espera de repuestos', listo: 'listo para retirar',
      entregado: 'entregado', cancelado: 'cancelado',
    };
    const saludo = `Hola ${o.cliente || 'cliente'}, le saludamos del Taller RUJIM.\nVehículo: ${o.vehiculo || 'por confirmar'} · Placa: ${o.placa || 'por confirmar'} · Orden: ${o.codigo ?? 'por confirmar'}.\n\n`;
    const textos: Record<string, string> = {
      listo: 'Su vehículo está listo para retirar. Por favor, comuníquese con nosotros para coordinar la entrega y confirmar si existe un saldo pendiente. ¡Gracias por su confianza!',
      avance: `Le informamos que el estado de su vehículo es: ${estados[o.estado || ''] || 'por confirmar'}. Si tiene alguna consulta, puede responder a este mensaje.`,
      diagnostico: 'Hemos finalizado el diagnóstico de su vehículo. Comuníquese con nosotros para revisar la cotización y autorizar los trabajos.',
      ingreso: 'Confirmamos la recepción de su vehículo en el taller. Le mantendremos informado sobre el diagnóstico y el avance del servicio.',
    };
    this.mensaje = saludo + (textos[tipo] || textos['avance']);
  }
}

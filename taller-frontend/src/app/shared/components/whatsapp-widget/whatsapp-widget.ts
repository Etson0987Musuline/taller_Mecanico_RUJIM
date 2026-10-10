import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-whatsapp-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './whatsapp-widget.html',
  styleUrl: './whatsapp-widget.css'
})
export class WhatsappWidgetComponent {
  // Líneas oficiales de WhatsApp
  @Input() primaryPhone: string = '51972865276';
  @Input() primaryDisplay: string = '+51 972 865 276';
  @Input() secondaryPhone: string = '51992080854';
  @Input() secondaryDisplay: string = '+51 992 080 854';
  @Input() workshopName: string = 'Taller Automotriz RUJIM';

  // Compatibilidad hacia atrás si se usa phoneNumber/displayPhone
  @Input() set phoneNumber(val: string) {
    if (val) this.primaryPhone = val;
  }
  @Input() set displayPhone(val: string) {
    if (val) this.primaryDisplay = val;
  }

  selectedLine: 'principal' | 'secundaria' = 'principal';
  isOpen: boolean = false;
  userMessage: string = '';
  horaActual: string = '';

  quickOptions = [
    { label: 'Consultar estado de mi auto', icon: 'bi-car-front-fill', text: 'Hola Taller RUJIM, quisiera consultar el estado actual de mi vehículo.' },
    { label: 'Agendar cita de mantenimiento', icon: 'bi-calendar-check-fill', text: 'Hola Taller RUJIM, deseo agendar una cita para mantenimiento preventivo de mi vehículo.' },
    { label: 'Cotización de repuestos o reparación', icon: 'bi-tools', text: 'Hola Taller RUJIM, necesito cotizar un servicio de reparación y repuestos.' },
    { label: 'Hablar con un asesor técnico', icon: 'bi-headset', text: 'Hola, me gustaría comunicarme con un asesor de atención al cliente de Taller RUJIM.' }
  ];

  constructor() {
    const now = new Date();
    this.horaActual = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  get activePhone(): string {
    return this.selectedLine === 'principal' ? this.primaryPhone : this.secondaryPhone;
  }

  get activeDisplay(): string {
    return this.selectedLine === 'principal' ? this.primaryDisplay : this.secondaryDisplay;
  }

  selectLine(line: 'principal' | 'secundaria'): void {
    this.selectedLine = line;
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
  }

  closeChat(): void {
    this.isOpen = false;
  }

  enviarMensajeRapido(texto: string): void {
    this.abrirWhatsApp(texto, this.activePhone);
  }

  enviarMensajePersonalizado(): void {
    const mensaje = this.userMessage.trim() || 'Hola Taller RUJIM, necesito información y atención sobre un vehículo.';
    this.abrirWhatsApp(mensaje, this.activePhone);
    this.userMessage = '';
    this.isOpen = false;
  }

  abrirWhatsApp(mensaje: string, numero?: string): void {
    const targetPhone = numero || this.activePhone;
    const encoded = encodeURIComponent(mensaje);
    const url = `https://wa.me/${targetPhone}?text=${encoded}`;
    window.open(url, '_blank');
  }

  abrirLineaDirecta(linea: 'principal' | 'secundaria'): void {
    const target = linea === 'principal' ? this.primaryPhone : this.secondaryPhone;
    const mensaje = encodeURIComponent('Hola Taller Automotriz RUJIM, me gustaría contactar con un asesor.');
    window.open(`https://wa.me/${target}?text=${mensaje}`, '_blank');
  }
}

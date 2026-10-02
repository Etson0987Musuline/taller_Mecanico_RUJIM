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
  @Input() phoneNumber: string = '51977398357'; // Código de país + número (configurable)
  @Input() displayPhone: string = '+51 977 398 357';
  @Input() workshopName: string = 'Taller Automotriz RUJIM';

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

  toggleChat(): void {
    this.isOpen = !this.isOpen;
  }

  closeChat(): void {
    this.isOpen = false;
  }

  enviarMensajeRapido(texto: string): void {
    this.abrirWhatsApp(texto);
  }

  enviarMensajePersonalizado(): void {
    const mensaje = this.userMessage.trim() || 'Hola Taller RUJIM, necesito información y atención sobre un vehículo.';
    this.abrirWhatsApp(mensaje);
    this.userMessage = '';
    this.isOpen = false;
  }

  abrirWhatsApp(mensaje: string): void {
    const encoded = encodeURIComponent(mensaje);
    const url = `https://wa.me/${this.phoneNumber}?text=${encoded}`;
    window.open(url, '_blank');
  }
}

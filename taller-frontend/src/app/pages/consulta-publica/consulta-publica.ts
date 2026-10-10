import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SeguimientoService } from '../../core/services/seguimiento.service';
import { WhatsappWidgetComponent } from '../../shared/components/whatsapp-widget/whatsapp-widget';

@Component({
  selector: 'app-consulta-publica',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, WhatsappWidgetComponent],
  templateUrl: './consulta-publica.html',
  styleUrl: './consulta-publica.css'
})
export class ConsultaPublicaComponent implements OnInit {
  busqueda = '';
  tipoBusqueda: 'placa' | 'dni' | 'nombre' = 'placa';
  resultados: any[] = [];
  buscando = false;
  buscado = false;
  error = '';

  // Configuración WhatsApp Oficial y Ubicación
  whatsappPrincipal: string = '51972865276';
  whatsappPrincipalDisplay: string = '+51 972 865 276';
  whatsappSecundario: string = '51992080854';
  whatsappSecundarioDisplay: string = '+51 992 080 854';
  
  // Compatibilidad
  whatsappNumber: string = '51972865276';
  whatsappDisplay: string = '+51 972 865 276';
  
  googleMapsUrl: string = 'https://maps.app.goo.gl/XFa6bnijnWyTobNY7';
  tallerNombre: string = 'Taller Automotriz RUJIM';
  tallerDireccion: string = 'Huamanga, Ayacucho - Perú';
  tallerHorario: string = 'Lunes a Sábado: 8:00 AM – 6:00 PM';

  anioActual: number = new Date().getFullYear();

  estadoConfig: Record<string, { label: string; badgeClass: string; icon: string; stepNumber: number; descripcion: string }> = {
    recibido: {
      label: 'Vehículo Recibido',
      badgeClass: 'badge-recibido',
      icon: 'bi-box-arrow-in-down',
      stepNumber: 1,
      descripcion: 'El vehículo ingresó a las instalaciones y fue registrado en el sistema.'
    },
    diagnostico: {
      label: 'En Diagnóstico',
      badgeClass: 'badge-diagnostico',
      icon: 'bi-search',
      stepNumber: 2,
      descripcion: 'Nuestros mecánicos están realizando el escaneo e inspección integral.'
    },
    en_reparacion: {
      label: 'En Reparación',
      badgeClass: 'badge-reparacion',
      icon: 'bi-tools',
      stepNumber: 3,
      descripcion: 'Los especialistas están trabajando activamente en las reparaciones acordadas.'
    },
    espera_repuestos: {
      label: 'Espera de Repuestos',
      badgeClass: 'badge-repuestos',
      icon: 'bi-hourglass-split',
      stepNumber: 3,
      descripcion: 'Aguardando repuestos o autopartes solicitadas para continuar el trabajo.'
    },
    listo: {
      label: '¡Listo para Retirar!',
      badgeClass: 'badge-listo',
      icon: 'bi-check-circle-fill',
      stepNumber: 4,
      descripcion: 'Trabajo concluido y verificado. Puedes pasar a retirar tu vehículo.'
    },
    entregado: {
      label: 'Vehículo Entregado',
      badgeClass: 'badge-entregado',
      icon: 'bi-shield-check',
      stepNumber: 5,
      descripcion: 'Vehículo entregado al cliente satisfecho.'
    },
    cancelado: {
      label: 'Orden Cancelada',
      badgeClass: 'badge-cancelado',
      icon: 'bi-x-circle-fill',
      stepNumber: 0,
      descripcion: 'El servicio fue cancelado o desestimado.'
    }
  };

  stepsList = [
    { num: 1, key: 'recibido', label: 'Recepción' },
    { num: 2, key: 'diagnostico', label: 'Diagnóstico' },
    { num: 3, key: 'en_reparacion', label: 'Reparación' },
    { num: 4, key: 'listo', label: 'Listo' },
    { num: 5, key: 'entregado', label: 'Entregado' }
  ];

  serviciosDestacados = [
    {
      titulo: 'Mantenimiento Preventivo',
      icono: 'bi-wrench-adjustable',
      desc: 'Cambio de aceite, filtros, bujías y revisión general por kilometraje.',
      tag: 'Esencial'
    },
    {
      titulo: 'Diagnóstico Computarizado',
      icono: 'bi-cpu',
      desc: 'Escaneo con tecnología OBD-II de última generación para todas las marcas.',
      tag: 'Alta Precisión'
    },
    {
      titulo: 'Motor y Transmisión',
      icono: 'bi-gear-wide-connected',
      desc: 'Reparación y ajuste integral de motores a gasolina, diésel y cajas de cambios.',
      tag: 'Especialistas'
    },
    {
      titulo: 'Frenos y Suspensión',
      icono: 'bi-disc',
      desc: 'Rectificación de discos, cambio de pastillas, amortiguadores y terminales.',
      tag: 'Seguridad'
    },
    {
      titulo: 'Sistema Eléctrico y Baterías',
      icono: 'bi-lightning-charge',
      desc: 'Reparación de alternadores, arrancadores, cableado y diagnóstico de baterías.',
      tag: 'Garantizado'
    },
    {
      titulo: 'Venta de Repuestos Originales',
      icono: 'bi-box-seam',
      desc: 'Catálogo de autopartes originales y de primera calidad con garantía.',
      tag: 'Stock Disponible'
    }
  ];

  faqList = [
    {
      pregunta: '¿Cómo puedo saber el avance de mi vehículo?',
      respuesta: 'Ingresa tu número de placa (ej. ABC-123) o tu número de DNI en el buscador superior. Podrás ver en tiempo real la fase actual, el último comentario del mecánico y la fecha estimada de entrega.',
      abierta: false
    },
    {
      pregunta: '¿Cómo me comunico por WhatsApp para una consulta urgente?',
      respuesta: 'Haz clic en el botón flotante verde de WhatsApp en la esquina inferior derecha o en el botón "Consultar por esta orden" en la tarjeta de tu vehículo. Te conectará directamente con nuestro equipo técnico.',
      abierta: false
    },
    {
      pregunta: '¿Cuáles son los horarios de atención del taller?',
      respuesta: 'Atendemos en nuestro local de Huamanga, Ayacucho de Lunes a Sábado de 8:00 AM a 6:00 PM de forma continua.',
      abierta: false
    }
  ];

  constructor(
    private seguimiento: SeguimientoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.anioActual = new Date().getFullYear();
  }

  consultar(): void {
    const query = this.busqueda.trim();
    if (!query) return;

    this.buscando = true;
    this.buscado = false;
    this.error = '';
    this.resultados = [];
    this.cdr.detectChanges();

    let obs;
    if (this.tipoBusqueda === 'placa') {
      obs = this.seguimiento.consultarPorPlaca(query);
    } else if (this.tipoBusqueda === 'dni') {
      obs = this.seguimiento.consultarPorDni(query);
    } else {
      obs = this.seguimiento.consultarPorNombre(query);
    }

    obs.subscribe({
      next: (data) => {
        this.resultados = data;
        this.buscando = false;
        this.buscado = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = `No se encontraron órdenes registradas para la búsqueda "${query}".`;
        this.buscando = false;
        this.buscado = true;
        this.cdr.detectChanges();
      }
    });
  }

  setTipoBusqueda(tipo: 'placa' | 'dni' | 'nombre'): void {
    this.tipoBusqueda = tipo;
    this.busqueda = '';
    this.error = '';
  }

  getEstado(estado: string) {
    return this.estadoConfig[estado] || {
      label: estado,
      badgeClass: 'badge-recibido',
      icon: 'bi-circle',
      stepNumber: 1,
      descripcion: 'Estado en proceso.'
    };
  }

  getStepStatus(estadoActual: string, stepNumber: number): 'completed' | 'current' | 'pending' {
    const actualConfig = this.getEstado(estadoActual);
    const actualStep = actualConfig.stepNumber;

    if (estadoActual === 'cancelado') return 'pending';

    if (actualStep > stepNumber) return 'completed';
    if (actualStep === stepNumber) return 'current';
    return 'pending';
  }

  getProgressPercentage(estado: string): number {
    switch (estado) {
      case 'recibido': return 20;
      case 'diagnostico': return 45;
      case 'en_reparacion': return 70;
      case 'espera_repuestos': return 65;
      case 'listo': return 95;
      case 'entregado': return 100;
      case 'cancelado': return 10;
      default: return 30;
    }
  }

  consultarOrdenPorWhatsApp(r: any, linea: 'principal' | 'secundaria' = 'principal'): void {
    const phone = linea === 'principal' ? this.whatsappPrincipal : this.whatsappSecundario;
    const texto = `Hola Taller Automotriz RUJIM 👋. Mi nombre es *${r.cliente || 'Cliente'}* y deseo consultar información sobre mi vehículo *${r.vehiculo}* (Placa: *${r.placa}*), correspondiente a la Orden de Servicio *#${r.orden}*. El estado actual es: *${this.getEstado(r.estado).label}*. ¡Muchas gracias!`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  }

  contactarWhatsAppGeneral(motivo?: string, linea: 'principal' | 'secundaria' = 'principal'): void {
    const phone = linea === 'principal' ? this.whatsappPrincipal : this.whatsappSecundario;
    const texto = motivo 
      ? `Hola Taller Automotriz RUJIM 👋, deseo consultar sobre: ${motivo}.`
      : 'Hola Taller Automotriz RUJIM 👋, quisiera consultar información sobre sus servicios y atención mecánica.';
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  }

  abrirGoogleMaps(): void {
    window.open(this.googleMapsUrl, '_blank');
  }

  toggleFaq(item: any): void {
    item.abierta = !item.abierta;
  }
}

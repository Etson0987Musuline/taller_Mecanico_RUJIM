import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { OrdenesService } from '../../../core/services/ordenes.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit {
  stats: any = null;
  cargando = true;
  ordenesListas: any[] = [];
  repuestosCriticos: any[] = [];
  placaBusqueda = '';

  estadoConfig: any = {
    recibido:         { label: 'Recibido',           clase: 'badge bg-secondary' },
    diagnostico:      { label: 'En diagnóstico',     clase: 'badge bg-info text-dark' },
    en_reparacion:    { label: 'En reparación',      clase: 'badge bg-primary' },
    espera_repuestos: { label: 'Espera repuestos',   clase: 'badge bg-warning text-dark' },
    listo:            { label: 'Listo para retirar', clase: 'badge bg-success' },
    entregado:        { label: 'Entregado',          clase: 'badge bg-dark' },
    cancelado:        { label: 'Cancelado',          clase: 'badge bg-danger' },
  };

  constructor(
    private ordenesService: OrdenesService,
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cargar();
    this.cargarListos();
    this.cargarStockCritico();
  }

  cargar() {
    this.cargando = true;
    this.ordenesService.getEstadisticas().subscribe({
      next: (data) => {
        this.stats = data;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => { this.cargando = false; this.cdr.detectChanges(); }
    });
  }

  cargarListos() {
    this.ordenesService.getAll().subscribe({
      next: (data) => {
        this.ordenesListas = (data || []).filter(o => o.estado === 'listo');
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  cargarStockCritico() {
    this.http.get<any[]>(`${environment.apiUrl}/repuestos/stock-bajo`).subscribe({
      next: (data) => {
        this.repuestosCriticos = (data || []).slice(0, 5);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  notificarWhatsApp(o: any) {
    let tel = (o.telefono || '').replace(/\D/g, '');
    if (!tel) {
      alert(`La orden #${o.codigo} no tiene registrado un número telefónico para ${o.cliente}.`);
      return;
    }
    if (tel.length === 9) tel = '51' + tel;
    const total = o.total_factura ? `S/ ${parseFloat(o.total_factura).toFixed(2)}` : 'S/ 0.00';
    const msg = `Hola *${o.cliente}* 👋, le saludamos del *Taller Automotriz*. Le informamos que su vehículo *${o.vehiculo}* (Placa: *${o.placa}*) correspondiente a la orden *#${o.codigo}* ya se encuentra ✅ *LISTO PARA RETIRAR*.\n\n💰 Total liquidado: *${total}*.\n📍 ¡Puede pasar por nuestras instalaciones a recoger su unidad!`;
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  consultarPlaca() {
    const p = this.placaBusqueda.trim();
    if (!p) return;
    this.router.navigate(['/dashboard/ordenes'], { queryParams: { q: p } });
  }

  getBadge(estado: string) {
    return this.estadoConfig[estado] || { label: estado, clase: 'badge bg-secondary' };
  }
}

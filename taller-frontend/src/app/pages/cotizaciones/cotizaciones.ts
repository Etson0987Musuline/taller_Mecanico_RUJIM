import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CotizacionesService, Cotizacion, ConceptoCotizacion } from '../../core/services/cotizaciones.service';
import { VehiculosService } from '../../core/services/vehiculos.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-cotizaciones', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cotizaciones.html', styleUrl: './cotizaciones.css'
})
export class CotizacionesComponent implements OnInit {
  cotizaciones: Cotizacion[] = [];
  vehiculos: any[] = [];
  repuestos: any[] = [];
  vehiculoId: number | null = null;
  descripcion = '';
  items: ConceptoCotizacion[] = [];
  error = ''; mensaje = ''; cargando = false; guardando = false; convirtiendo: number | null = null;
  enlace = ''; detalle: Cotizacion | null = null;
  constructor(private api: CotizacionesService, private vehiculosApi: VehiculosService, private http: HttpClient, private cdr: ChangeDetectorRef) {}
  ngOnInit() { this.agregar(); this.cargar(); }
  cargar() {
    this.cargando = true; this.error = '';
    forkJoin({ cotizaciones: this.api.listar(), vehiculos: this.vehiculosApi.getAll(), repuestos: this.http.get<any[]>(`${environment.apiUrl}/repuestos`) }).subscribe({
      next: data => { this.cotizaciones = data.cotizaciones; this.vehiculos = data.vehiculos; this.repuestos = data.repuestos.filter(r => r.activo !== false); this.cargando = false; this.cdr.detectChanges(); },
      error: err => { this.error = err.error?.mensaje || 'No se pudieron cargar los datos.'; this.cargando = false; this.cdr.detectChanges(); }
    });
  }
  agregar() { this.items.push({ tipo: 'mano_obra', descripcion: '', cantidad: 1, precio_unitario: 0, repuesto_id: null }); }
  cambiarTipo(i: ConceptoCotizacion) { i.repuesto_id = null; i.descripcion = ''; i.precio_unitario = 0; }
  seleccionarRepuesto(i: ConceptoCotizacion) {
    const r = this.repuestos.find(r => r.id === i.repuesto_id);
    if (r) { i.descripcion = r.nombre; i.precio_unitario = Number(r.precio_venta); }
  }
  get subtotalCentimos() { return this.items.reduce((sum, i) => sum + Math.round(Number(i.precio_unitario || 0) * 100) * Number(i.cantidad || 0), 0); }
  get subtotal() { return this.subtotalCentimos / 100; }
  get igv() { return Math.round(this.subtotalCentimos * .18) / 100; }
  get total() { return this.subtotal + this.igv; }
  vencida(c: Cotizacion) { return c.estado === 'pendiente' && Date.parse(c.vence_at) <= Date.now(); }
  guardar() {
    if (this.guardando) return;
    this.guardando = true; this.error = ''; this.mensaje = '';
    this.api.crear({ vehiculo_id: this.vehiculoId, descripcion: this.descripcion, items: this.items }).subscribe({
      next: c => {
        this.guardando = false; this.enlace = `${window.location.origin}/cotizacion/${c.token}`;
        this.mensaje = 'Cotización creada. Copia el enlace privado para compartirlo con el cliente. El presupuesto no puede editarse después de enviarlo.';
        this.vehiculoId = null; this.descripcion = ''; this.items = []; this.agregar(); this.cargar(); this.cdr.detectChanges();
      },
      error: err => { this.guardando = false; this.error = err.error?.mensaje || 'No se pudo guardar.'; this.cdr.detectChanges(); }
    });
  }
  verEnlace(c: Cotizacion) { this.enlace = `${window.location.origin}/cotizacion/${c.token}`; this.detalle = c; }
  anular(c: Cotizacion) {
    if (this.convirtiendo !== null) return;
    this.convirtiendo = c.id; this.error = '';
    this.api.anular(c.id).subscribe({
      next: () => { this.convirtiendo = null; this.mensaje = 'Cotización anulada. El enlace ya no permite responder.'; this.detalle = null; this.enlace = ''; this.cargar(); this.cdr.detectChanges(); },
      error: err => { this.convirtiendo = null; this.error = err.error?.mensaje || 'No se pudo anular.'; this.cdr.detectChanges(); }
    });
  }
  convertir(c: Cotizacion) {
    if (this.convirtiendo !== null) return;
    this.convirtiendo = c.id; this.error = ''; this.mensaje = '';
    this.api.convertir(c.id).subscribe({
      next: orden => { this.convirtiendo = null; this.mensaje = `Orden ${orden.codigo} creada con los importes autorizados. Los repuestos se descontaron del inventario.`; this.detalle = null; this.cargar(); this.cdr.detectChanges(); },
      error: err => { this.convirtiendo = null; this.error = err.error?.mensaje || 'No se pudo convertir.'; this.cdr.detectChanges(); }
    });
  }
}

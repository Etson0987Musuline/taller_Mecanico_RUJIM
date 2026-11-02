import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CotizacionesService, Cotizacion } from '../../core/services/cotizaciones.service';

@Component({
  selector: 'app-cotizacion-publica', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cotizacion-publica.html', styleUrl: './cotizaciones.css'
})
export class CotizacionPublicaComponent implements OnInit {
  cotizacion: Cotizacion | null = null;
  nombre = ''; consentimiento = false; decision = ''; error = ''; cargando = true; guardando = false;
  private token = '';
  constructor(private api: CotizacionesService, private route: ActivatedRoute, private cdr: ChangeDetectorRef) {}
  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!/^[a-f0-9]{64}$/.test(this.token)) { this.error = 'El enlace de cotización no es válido.'; this.cargando = false; return; }
    this.api.consultar(this.token).subscribe({
      next: c => { this.cotizacion = c; this.cargando = false; this.cdr.detectChanges(); },
      error: err => { this.error = err.error?.mensaje || 'No se pudo cargar la cotización.'; this.cargando = false; this.cdr.detectChanges(); }
    });
  }
  get vencida() { return !!this.cotizacion && Date.parse(this.cotizacion.vence_at) <= Date.now(); }
  responder() {
    if (this.guardando || this.vencida || !this.consentimiento || this.nombre.trim().length < 3 || !['aprobada', 'rechazada'].includes(this.decision)) return;
    this.guardando = true; this.error = '';
    this.api.responder(this.token, this.decision, this.nombre.trim()).subscribe({
      next: c => { this.cotizacion = c; this.guardando = false; this.cdr.detectChanges(); },
      error: err => { this.error = err.error?.mensaje || 'No se pudo registrar tu respuesta.'; this.guardando = false; this.cdr.detectChanges(); }
    });
  }
}

import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ClientesService } from '../../core/services/clientes.service';
import { VehiculosService } from '../../core/services/vehiculos.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-mecanico',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mecanico.html',
  styleUrl: './mecanico.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MecanicoComponent implements OnInit {
  usuario: any;

  // Pestañas principales de trabajo del mecánico
  vistaMecanico: 'trabajos' | 'nueva_orden' | 'historial' = 'trabajos';

  // Trabajos activos en taller
  misTrabajos: any[] = [];
  cargandoTrabajos = false;

  // Modales rápidos de taller
  mostrarModalRepuestoRapido = false;
  mostrarModalServicioRapido = false;
  mostrarModalDetalleTrabajo = false;
  trabajoSeleccionado: any = null;
  ordenDetalleCompleta: any = null;

  repuestoRapido: any = { repuesto_id: null, cantidad: 1, precio_unitario: 0 };
  busquedaRepuestoRapido = '';
  repuestosFiltradosRapido: any[] = [];
  repuestoSeleccionadoRapido: any = null;
  guardandoRepuestoRapido = false;

  servicioRapido: any = { servicio_id: null, precio: 0, observacion: '' };
  busquedaServicioRapido = '';
  serviciosFiltradosRapido: any[] = [];
  guardandoServicioRapido = false;

  // Historial por placa
  placaBusquedaHistorial = '';
  historialPlacaDatos: any = null;
  cargandoHistorial = false;
  errorHistorial = '';

  // Flujo Crear Orden (Paso a paso)
  flujo: null | 'nuevo' | 'habitual' = null;
  paso = 0;

  // Paso 1 — Cliente
  clienteForm: any = {};
  guardandoCliente = false;
  clienteCreado: any = null;

  // Paso 2 — Vehículo
  vehiculoForm: any = { km_ingreso: 0 };
  guardandoVehiculo = false;
  vehiculoCreado: any = null;
  marcas = ['Toyota','Hyundai','Kia','Nissan','Honda','Chevrolet','Ford',
            'Volkswagen','Mazda','Suzuki','Mitsubishi','Subaru','Otro'];
  tipos  = ['Sedán','SUV','Pickup','Hatchback','Van','Camioneta','Coupé','Otro'];

  // Paso 3 — Orden
  ordenForm: any = {};
  guardandoOrden = false;
  busquedaVehiculo = '';
  vehiculosFiltrados: any[] = [];
  vehiculoSeleccionado: any = null;
  mostrarVehiculos = false;
  serviciosDisponibles: any[] = [];
  repuestosDisponibles: any[] = [];
  serviciosOrden: any[] = [];
  repuestosOrden: any[] = [];
  busquedaServicio = ''; serviciosFiltrados: any[] = [];
  mostrarSugServicio = false; servicioForm: any = {};
  busquedaRepuesto = ''; repuestosFiltrados: any[] = [];
  mostrarSugRepuesto = false; repuestoForm: any = {};

  ordenCreada: any = null;

  estadoConfig: any = {
    recibido:         { label: 'Recibido',           clase: 'badge bg-secondary', icon: 'bi-box-arrow-in-down' },
    diagnostico:      { label: 'En diagnóstico',     clase: 'badge bg-info text-dark', icon: 'bi-search' },
    en_reparacion:    { label: 'En reparación',      clase: 'badge bg-primary', icon: 'bi-tools' },
    espera_repuestos: { label: 'Espera repuestos',   clase: 'badge bg-warning text-dark', icon: 'bi-hourglass-split' },
    listo:            { label: '¡Listo para entrega!', clase: 'badge bg-success', icon: 'bi-check-circle-fill' },
    entregado:        { label: 'Entregado',          clase: 'badge bg-dark', icon: 'bi-shield-check' },
    cancelado:        { label: 'Cancelado',          clase: 'badge bg-danger', icon: 'bi-x-circle' },
  };

  private urlVehiculos = `${environment.apiUrl}/vehiculos`;
  private urlServicios = `${environment.apiUrl}/servicios`;
  private urlRepuestos = `${environment.apiUrl}/repuestos`;

  constructor(
    private router: Router,
    private auth: AuthService,
    private clientesService: ClientesService,
    private vehiculosService: VehiculosService,
    private ordenesService: OrdenesService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
    this.usuario = this.auth.getUsuario();
  }

  ngOnInit() {
    this.cargarCatalogos();
    this.cargarMisTrabajos();
  }

  cargarCatalogos() {
    this.http.get<any[]>(this.urlServicios).subscribe({
      next: d => { this.serviciosDisponibles = d.filter(s => s.activo); this.cdr.detectChanges(); }
    });
    this.http.get<any[]>(this.urlRepuestos).subscribe({
      next: d => { this.repuestosDisponibles = d; this.cdr.detectChanges(); }
    });
  }

  // ── Cargar trabajos activos del taller ──
  cargarMisTrabajos() {
    this.cargandoTrabajos = true;
    this.ordenesService.getAll().subscribe({
      next: (data) => {
        // En un taller activo, se muestran los que están en proceso de trabajo
        const estadosActivos = ['recibido', 'diagnostico', 'en_reparacion', 'espera_repuestos', 'listo'];
        this.misTrabajos = (data || []).filter(o => estadosActivos.includes(o.estado));
        this.cargandoTrabajos = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoTrabajos = false;
        this.cdr.detectChanges();
      }
    });
  }

  cambiarEstadoRapido(trabajo: any, nuevoEstado: string) {
    if (trabajo.estado === nuevoEstado) return;
    this.ordenesService.updateEstado(trabajo.id, nuevoEstado, `Estado actualizado a ${nuevoEstado} por mecánico`).subscribe({
      next: () => {
        trabajo.estado = nuevoEstado;
        this.cdr.detectChanges();
      },
      error: () => alert('Error al actualizar el estado de la orden')
    });
  }

  // ── Agregar repuesto rápido a una orden activa ──
  abrirAgregarRepuestoRapido(trabajo: any) {
    this.trabajoSeleccionado = trabajo;
    this.repuestoRapido = { repuesto_id: null, cantidad: 1, precio_unitario: 0 };
    this.repuestoSeleccionadoRapido = null;
    this.busquedaRepuestoRapido = '';
    this.repuestosFiltradosRapido = [];
    this.mostrarModalRepuestoRapido = true;
    this.cdr.detectChanges();
  }

  buscarRepuestoRapido() {
    const q = this.busquedaRepuestoRapido.toLowerCase().trim();
    if (!q) {
      this.repuestosFiltradosRapido = [];
      return;
    }
    this.repuestosFiltradosRapido = this.repuestosDisponibles.filter(r =>
      r.nombre.toLowerCase().includes(q) || (r.codigo && r.codigo.toLowerCase().includes(q))
    ).slice(0, 7);
  }

  seleccionarRepuestoRapido(r: any) {
    this.repuestoSeleccionadoRapido = r;
    this.repuestoRapido = {
      repuesto_id: r.id,
      nombre: r.nombre,
      cantidad: 1,
      precio_unitario: r.precio_venta
    };
    this.busquedaRepuestoRapido = r.nombre;
    this.repuestosFiltradosRapido = [];
  }

  guardarRepuestoRapido() {
    if (!this.repuestoRapido.repuesto_id || !this.repuestoRapido.cantidad) {
      alert('Selecciona un repuesto y cantidad válida');
      return;
    }
    this.guardandoRepuestoRapido = true;
    this.ordenesService.agregarRepuesto(this.trabajoSeleccionado.id, this.repuestoRapido).subscribe({
      next: () => {
        this.guardandoRepuestoRapido = false;
        this.mostrarModalRepuestoRapido = false;
        alert(`Repuesto agregado con éxito a la orden #${this.trabajoSeleccionado.codigo}`);
        this.cargarMisTrabajos();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.guardandoRepuestoRapido = false;
        alert(err.error?.mensaje || 'Error al agregar repuesto');
        this.cdr.detectChanges();
      }
    });
  }

  // ── Agregar servicio rápido ──
  abrirAgregarServicioRapido(trabajo: any) {
    this.trabajoSeleccionado = trabajo;
    this.servicioRapido = { servicio_id: null, precio: 0, observacion: '' };
    this.busquedaServicioRapido = '';
    this.serviciosFiltradosRapido = [];
    this.mostrarModalServicioRapido = true;
    this.cdr.detectChanges();
  }

  buscarServicioRapido() {
    const q = this.busquedaServicioRapido.toLowerCase().trim();
    if (!q) {
      this.serviciosFiltradosRapido = [];
      return;
    }
    this.serviciosFiltradosRapido = this.serviciosDisponibles.filter(s =>
      s.nombre.toLowerCase().includes(q)
    ).slice(0, 6);
  }

  seleccionarServicioRapido(s: any) {
    this.servicioRapido = {
      servicio_id: s.id,
      nombre: s.nombre,
      precio: s.precio_base,
      observacion: ''
    };
    this.busquedaServicioRapido = s.nombre;
    this.serviciosFiltradosRapido = [];
  }

  guardarServicioRapido() {
    if (!this.servicioRapido.servicio_id) {
      alert('Selecciona un servicio válido');
      return;
    }
    this.guardandoServicioRapido = true;
    this.ordenesService.agregarServicio(this.trabajoSeleccionado.id, this.servicioRapido).subscribe({
      next: () => {
        this.guardandoServicioRapido = false;
        this.mostrarModalServicioRapido = false;
        alert(`Servicio agregado con éxito a la orden #${this.trabajoSeleccionado.codigo}`);
        this.cargarMisTrabajos();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.guardandoServicioRapido = false;
        alert(err.error?.mensaje || 'Error al agregar servicio');
        this.cdr.detectChanges();
      }
    });
  }

  // ── Ver detalle completo de una orden ──
  verDetalleTrabajo(trabajo: any) {
    this.trabajoSeleccionado = trabajo;
    this.ordenesService.getById(trabajo.id).subscribe({
      next: (data) => {
        this.ordenDetalleCompleta = data;
        this.mostrarModalDetalleTrabajo = true;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Consultar Hoja de Vida por Placa ──
  consultarHistorialPlaca(placa?: string) {
    if (placa) this.placaBusquedaHistorial = placa;
    const p = this.placaBusquedaHistorial.trim();
    if (!p) return;
    this.cargandoHistorial = true;
    this.errorHistorial = '';
    this.historialPlacaDatos = null;
    this.http.get<any>(`${environment.apiUrl}/vehiculos/placa/${p}/historial`).subscribe({
      next: (res) => {
        this.historialPlacaDatos = res;
        this.cargandoHistorial = false;
        this.vistaMecanico = 'historial';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargandoHistorial = false;
        this.errorHistorial = err.error?.mensaje || 'No se encontró historial para esta placa';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Asistente de Nueva Orden ──
  iniciarFlujoNuevo() {
    this.vistaMecanico = 'nueva_orden';
    this.flujo = 'nuevo';
    this.paso = 1;
    this.clienteForm = {};
    this.vehiculoForm = { km_ingreso: 0 };
    this.ordenForm = {};
    this.clienteCreado = null;
    this.vehiculoCreado = null;
    this.ordenCreada = null;
    this.serviciosOrden = [];
    this.repuestosOrden = [];
    this.cdr.detectChanges();
  }

  iniciarFlujoHabitual() {
    this.vistaMecanico = 'nueva_orden';
    this.flujo = 'habitual';
    this.paso = 3;
    this.ordenForm = {};
    this.busquedaVehiculo = '';
    this.vehiculoSeleccionado = null;
    this.serviciosOrden = [];
    this.repuestosOrden = [];
    this.cdr.detectChanges();
  }

  resetear() {
    this.flujo = null;
    this.paso = 0;
    this.vistaMecanico = 'trabajos';
    this.cargarMisTrabajos();
    this.cdr.detectChanges();
  }

  guardarCliente() {
    if (!this.clienteForm.nombre || !this.clienteForm.apellido) {
      alert('Nombre y apellido son obligatorios'); return;
    }
    this.guardandoCliente = true;
    this.clientesService.create(this.clienteForm).subscribe({
      next: (res: any) => {
        this.clienteCreado = { ...this.clienteForm, id: res.id };
        this.vehiculoForm.cliente_id = res.id;
        this.guardandoCliente = false;
        this.paso = 2;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.guardandoCliente = false;
        alert(err.error?.mensaje || 'Error al crear cliente');
        this.cdr.detectChanges();
      }
    });
  }

  guardarVehiculo() {
    if (!this.vehiculoForm.placa || !this.vehiculoForm.marca || !this.vehiculoForm.modelo) {
      alert('Placa, marca y modelo son obligatorios'); return;
    }
    this.guardandoVehiculo = true;
    this.vehiculosService.create(this.vehiculoForm).subscribe({
      next: (res: any) => {
        this.vehiculoCreado = { ...this.vehiculoForm, id: res.id };
        this.ordenForm.vehiculo_id = res.id;
        this.busquedaVehiculo = `${this.clienteCreado?.nombre} — ${this.vehiculoForm.marca} ${this.vehiculoForm.modelo} (${this.vehiculoForm.placa})`;
        this.vehiculoSeleccionado = this.vehiculoCreado;
        this.guardandoVehiculo = false;
        this.paso = 3;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.guardandoVehiculo = false;
        alert(err.error?.mensaje || 'Error al crear vehículo');
        this.cdr.detectChanges();
      }
    });
  }

  buscarVehiculo() {
    const q = this.busquedaVehiculo.trim().toLowerCase();
    if (q.length < 2) { this.vehiculosFiltrados = []; this.mostrarVehiculos = false; return; }
    this.http.get<any[]>(this.urlVehiculos).subscribe({ next: data => {
      this.vehiculosFiltrados = data.filter(v =>
        v.cliente?.toLowerCase().includes(q) || v.placa?.toLowerCase().includes(q)
      ).slice(0, 6);
      setTimeout(() => { this.mostrarVehiculos = this.vehiculosFiltrados.length > 0; this.cdr.detectChanges(); });
    }});
  }

  seleccionarVehiculo(v: any) {
    this.vehiculoSeleccionado = v;
    this.ordenForm.vehiculo_id = v.id;
    this.busquedaVehiculo = `${v.cliente} — ${v.marca} ${v.modelo} (${v.placa})`;
    this.mostrarVehiculos = false;
    this.cdr.detectChanges();
  }

  buscarServicio() {
    const q = this.busquedaServicio.toLowerCase();
    this.serviciosFiltrados = this.serviciosDisponibles.filter(s => s.nombre.toLowerCase().includes(q)).slice(0, 6);
    setTimeout(() => { this.mostrarSugServicio = this.serviciosFiltrados.length > 0 && q.length > 0; this.cdr.detectChanges(); });
  }

  seleccionarServicio(s: any) {
    this.servicioForm = { servicio_id: s.id, nombre: s.nombre, precio: s.precio_base, observacion: '' };
    this.busquedaServicio = s.nombre;
    this.mostrarSugServicio = false;
  }

  agregarServicio() {
    if (!this.servicioForm.servicio_id) { alert('Selecciona un servicio'); return; }
    this.serviciosOrden.push({ ...this.servicioForm });
    this.busquedaServicio = '';
    this.servicioForm = {};
    this.mostrarSugServicio = false;
    this.cdr.detectChanges();
  }

  quitarServicio(i: number) { this.serviciosOrden.splice(i, 1); this.cdr.detectChanges(); }

  buscarRepuesto() {
    const q = this.busquedaRepuesto.toLowerCase();
    this.repuestosFiltrados = this.repuestosDisponibles.filter(r =>
      r.nombre.toLowerCase().includes(q) || r.codigo?.toLowerCase().includes(q)
    ).slice(0, 6);
    setTimeout(() => { this.mostrarSugRepuesto = this.repuestosFiltrados.length > 0 && q.length > 0; this.cdr.detectChanges(); });
  }

  seleccionarRepuesto(r: any) {
    this.repuestoForm = { repuesto_id: r.id, nombre: r.nombre, cantidad: 1, precio_unitario: r.precio_venta };
    this.busquedaRepuesto = r.nombre;
    this.mostrarSugRepuesto = false;
  }

  agregarRepuesto() {
    if (!this.repuestoForm.repuesto_id) { alert('Selecciona un repuesto'); return; }
    this.repuestosOrden.push({ ...this.repuestoForm });
    this.busquedaRepuesto = '';
    this.repuestoForm = {};
    this.mostrarSugRepuesto = false;
    this.cdr.detectChanges();
  }

  quitarRepuesto(i: number) { this.repuestosOrden.splice(i, 1); this.cdr.detectChanges(); }

  get totalEstimado() {
    const serv = this.serviciosOrden.reduce((a, s) => a + parseFloat(s.precio || 0), 0);
    const rep  = this.repuestosOrden.reduce((a, r) => a + (parseFloat(r.precio_unitario || 0) * (r.cantidad || 1)), 0);
    const mo   = parseFloat(this.ordenForm.mano_obra || 0);
    return serv + rep + mo;
  }

  guardarOrden() {
    if (!this.ordenForm.vehiculo_id || !this.ordenForm.descripcion_problema) {
      alert('Selecciona un vehículo y describe el problema'); return;
    }
    this.guardandoOrden = true;
    this.ordenesService.create(this.ordenForm).subscribe({
      next: (res) => {
        const ordenId = res.id;
        const servicios = [...this.serviciosOrden];
        const repuestos = [...this.repuestosOrden];

        const agregarServicios = (i: number) => {
          if (i >= servicios.length) { agregarRepuestos(0); return; }
          this.ordenesService.agregarServicio(ordenId, servicios[i]).subscribe({
            next: () => agregarServicios(i + 1),
            error: () => agregarServicios(i + 1)
          });
        };

        const agregarRepuestos = (i: number) => {
          if (i >= repuestos.length) {
            this.ordenCreada = { ...res, codigo: res.codigo };
            this.guardandoOrden = false;
            this.paso = 4;
            this.cdr.detectChanges();
            return;
          }
          this.ordenesService.agregarRepuesto(ordenId, repuestos[i]).subscribe({
            next: () => agregarRepuestos(i + 1),
            error: () => agregarRepuestos(i + 1)
          });
        };

        agregarServicios(0);
      },
      error: (err) => {
        this.guardandoOrden = false;
        alert(err.error?.mensaje || 'Error al crear orden');
        this.cdr.detectChanges();
      }
    });
  }

  getBadge(estado: string) {
    return this.estadoConfig[estado] || { label: estado, clase: 'badge bg-secondary', icon: 'bi-circle' };
  }
}

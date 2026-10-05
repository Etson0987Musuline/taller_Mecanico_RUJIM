import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrdenesService } from '../../core/services/ordenes.service';
import { HttpClient } from '@angular/common/http';
import { RolService } from '../../core/services/rol.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ordenes.html',
  styleUrl: './ordenes.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdenesComponent implements OnInit {
  ordenes:   any[] = [];
  filtradas: any[] = [];
  busqueda     = '';
  filtroEstado = 'todos';
  cargando     = false;

  mostrarModalNueva   = false;
  mostrarModalVer     = false;
  mostrarModalEditar  = false;
  guardando           = false;

  ordenForm: any = {};
  busquedaVehiculo = ''; vehiculosFiltrados: any[] = [];
  vehiculoSeleccionado: any = null; mostrarVehiculos = false;
  busquedaMecanico = ''; mecanicosFiltrados: any[] = [];
  mecanicoSeleccionado: any = null; mostrarMecanicos = false;

  serviciosNuevaOrden: any[] = [];
  repuestosNuevaOrden: any[] = [];
  busquedaServicioNueva = ''; serviciosFiltradosNueva: any[] = [];
  mostrarSugServicioNueva = false; servicioFormNueva: any = {};
  busquedaRepuestoNueva = ''; repuestosFiltradosNueva: any[] = [];
  mostrarSugRepuestoNueva = false; repuestoFormNueva: any = {};

  ordenActual: any = null;
  ordenEditForm: any = {};
  busquedaMecanicoEdit = ''; mecanicosFiltradosEdit: any[] = [];
  mostrarMecanicosEdit = false;
  estadoForm = { estado: '', comentario: '' };

  busquedaServicio = ''; serviciosFiltrados: any[] = [];
  mostrarSugServicio = false; servicioForm: any = {};
  busquedaRepuesto = ''; repuestosFiltrados: any[] = [];
  mostrarSugRepuesto = false; repuestoForm: any = {};

  serviciosDisponibles: any[] = [];
  repuestosDisponibles: any[] = [];

  // Modal WhatsApp
  mostrarModalWhatsApp = false;
  ordenWhatsApp: any = null;
  telefonoWhatsApp = '';
  mensajeWhatsApp = '';
  plantillaActiva = 'listo';

  // Modal Historial por Placa (Hoja de Vida)
  mostrarModalHistorial = false;
  placaBusquedaHistorial = '';
  historialPlacaDatos: any = null;
  cargandoHistorialPlaca = false;
  errorHistorialPlaca = '';

  estadoConfig: any = {
    recibido:         { label: 'Recibido',           clase: 'badge bg-secondary' },
    diagnostico:      { label: 'En diagnóstico',     clase: 'badge bg-info text-dark' },
    en_reparacion:    { label: 'En reparación',      clase: 'badge bg-primary' },
    espera_repuestos: { label: 'Espera repuestos',   clase: 'badge bg-warning text-dark' },
    listo:            { label: 'Listo para retirar', clase: 'badge bg-success' },
    entregado:        { label: 'Entregado',          clase: 'badge bg-dark' },
    cancelado:        { label: 'Cancelado',          clase: 'badge bg-danger' },
  };
  estados = Object.keys(this.estadoConfig);

  private urlVehiculos = `${environment.apiUrl}/vehiculos`;
  private urlUsuarios = `${environment.apiUrl}/usuarios/mecanicos`;
  private urlServicios = `${environment.apiUrl}/servicios`;
  private urlRepuestos = `${environment.apiUrl}/repuestos`;

  constructor(
    private ordenesService: OrdenesService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    public rol: RolService
  ) {}

  ngOnInit() {
    this.cargar();
    this.cargarCatalogos();
  }

  cargar() {
    this.cargando = true;
    this.ordenesService.getAll().subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.ordenes = data;
          this.aplicarFiltros();
          this.cargando = false;
          Promise.resolve().then(() => this.cdr.detectChanges());
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.cargando = false;
          Promise.resolve().then(() => this.cdr.detectChanges());
        });
      }
    });
  }

  aplicarFiltros() {
    let r = this.ordenes;
    if (this.filtroEstado !== 'todos') r = r.filter(o => o.estado === this.filtroEstado);
    if (this.busqueda.trim()) {
      const q = this.busqueda.toLowerCase();
      r = r.filter(o =>
        o.codigo?.toLowerCase().includes(q) ||
        o.cliente?.toLowerCase().includes(q) ||
        o.placa?.toLowerCase().includes(q) ||
        o.mecanico?.toLowerCase().includes(q)
      );
    }
    this.filtradas = r;
  }

  cargarCatalogos() {
    this.http.get<any[]>(this.urlServicios).subscribe({
      next: d => { this.serviciosDisponibles = d.filter(s => s.activo); }
    });
    this.http.get<any[]>(this.urlRepuestos).subscribe({
      next: d => { this.repuestosDisponibles = d.filter(r => r.activo !== 0); }
    });
  }

  // ── Vehículo ──
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
    this.vehiculoSeleccionado  = v;
    this.ordenForm.vehiculo_id = v.id;
    this.busquedaVehiculo      = `${v.cliente} — ${v.marca} ${v.modelo} (${v.placa})`;
    this.mostrarVehiculos      = false;
    this.cdr.detectChanges();
  }

  // ── Mecánico ──
  buscarMecanico(esEditar = false) {
    const q = (esEditar ? this.busquedaMecanicoEdit : this.busquedaMecanico).trim().toLowerCase();
    if (q.length < 2) {
      if (esEditar) { this.mecanicosFiltradosEdit = []; this.mostrarMecanicosEdit = false; }
      else { this.mecanicosFiltrados = []; this.mostrarMecanicos = false; }
      return;
    }
    this.http.get<any[]>(this.urlUsuarios).subscribe({ next: data => {
      const res = data.filter(u => u.nombre?.toLowerCase().includes(q)).slice(0, 5);
      setTimeout(() => {
        if (esEditar) { this.mecanicosFiltradosEdit = res; this.mostrarMecanicosEdit = res.length > 0; }
        else { this.mecanicosFiltrados = res; this.mostrarMecanicos = res.length > 0; }
        this.cdr.detectChanges();
      });
    }});
  }

  seleccionarMecanico(m: any, esEditar = false) {
    if (esEditar) {
      this.ordenEditForm.mecanico_id = m.id;
      this.busquedaMecanicoEdit      = m.nombre;
      this.mostrarMecanicosEdit      = false;
    } else {
      this.mecanicoSeleccionado  = m;
      this.ordenForm.mecanico_id = m.id;
      this.busquedaMecanico      = m.nombre;
      this.mostrarMecanicos      = false;
    }
    this.cdr.detectChanges();
  }

  // ── Servicios nueva orden ──
  buscarServicioNueva() {
    const q = this.busquedaServicioNueva.toLowerCase();
    this.serviciosFiltradosNueva = this.serviciosDisponibles.filter(s => s.nombre.toLowerCase().includes(q)).slice(0, 6);
    setTimeout(() => { this.mostrarSugServicioNueva = this.serviciosFiltradosNueva.length > 0 && q.length > 0; this.cdr.detectChanges(); });
  }

  seleccionarServicioNueva(s: any) {
    this.servicioFormNueva       = { servicio_id: s.id, nombre: s.nombre, precio: s.precio_base, observacion: '' };
    this.busquedaServicioNueva   = s.nombre;
    this.mostrarSugServicioNueva = false;
    this.cdr.detectChanges();
  }

  agregarServicioNueva() {
    if (!this.servicioFormNueva.servicio_id) { alert('Selecciona un servicio'); return; }
    this.serviciosNuevaOrden.push({ ...this.servicioFormNueva });
    this.busquedaServicioNueva   = '';
    this.servicioFormNueva       = {};
    this.mostrarSugServicioNueva = false;
    this.cdr.detectChanges();
  }

  quitarServicioNueva(i: number) { this.serviciosNuevaOrden.splice(i, 1); this.cdr.detectChanges(); }

  // ── Repuestos nueva orden ──
  buscarRepuestoNueva() {
    const q = this.busquedaRepuestoNueva.toLowerCase();
    this.repuestosFiltradosNueva = this.repuestosDisponibles.filter(r =>
      r.nombre.toLowerCase().includes(q) || r.codigo?.toLowerCase().includes(q)
    ).slice(0, 6);
    setTimeout(() => { this.mostrarSugRepuestoNueva = this.repuestosFiltradosNueva.length > 0 && q.length > 0; this.cdr.detectChanges(); });
  }

  seleccionarRepuestoNueva(r: any) {
    this.repuestoFormNueva       = { repuesto_id: r.id, nombre: r.nombre, cantidad: 1, precio_unitario: r.precio_venta };
    this.busquedaRepuestoNueva   = r.nombre;
    this.mostrarSugRepuestoNueva = false;
    this.cdr.detectChanges();
  }

  agregarRepuestoNueva() {
    if (!this.repuestoFormNueva.repuesto_id) { alert('Selecciona un repuesto'); return; }
    this.repuestosNuevaOrden.push({ ...this.repuestoFormNueva });
    this.busquedaRepuestoNueva   = '';
    this.repuestoFormNueva       = {};
    this.mostrarSugRepuestoNueva = false;
    this.cdr.detectChanges();
  }

  quitarRepuestoNueva(i: number) { this.repuestosNuevaOrden.splice(i, 1); this.cdr.detectChanges(); }

  // ── Servicios editar ──
  buscarServicio() {
    const q = this.busquedaServicio.toLowerCase();
    this.serviciosFiltrados = this.serviciosDisponibles.filter(s => s.nombre.toLowerCase().includes(q)).slice(0, 6);
    setTimeout(() => { this.mostrarSugServicio = this.serviciosFiltrados.length > 0 && q.length > 0; this.cdr.detectChanges(); });
  }

  seleccionarServicio(s: any) {
    this.servicioForm       = { servicio_id: s.id, precio: s.precio_base, observacion: '' };
    this.busquedaServicio   = s.nombre;
    this.mostrarSugServicio = false;
    this.cdr.detectChanges();
  }

  agregarServicio() {
    if (!this.servicioForm.servicio_id) { alert('Selecciona un servicio'); return; }
    this.ordenesService.agregarServicio(this.ordenActual.id, this.servicioForm).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.busquedaServicio = '';
          this.servicioForm     = {};
          this.recargarActual();
          this.cargar();
        });
      }
    });
  }

  eliminarServicio(osId: number) {
    if (!confirm('¿Eliminar este servicio?')) return;
    this.ordenesService.eliminarServicio(this.ordenActual.id, osId).subscribe({
      next: () => { this.ngZone.run(() => { this.recargarActual(); this.cargar(); }); }
    });
  }

  // ── Repuestos editar ──
  buscarRepuesto() {
    const q = this.busquedaRepuesto.toLowerCase();
    this.repuestosFiltrados = this.repuestosDisponibles.filter(r =>
      r.nombre.toLowerCase().includes(q) || r.codigo?.toLowerCase().includes(q)
    ).slice(0, 6);
    setTimeout(() => { this.mostrarSugRepuesto = this.repuestosFiltrados.length > 0 && q.length > 0; this.cdr.detectChanges(); });
  }

  seleccionarRepuesto(r: any) {
    this.repuestoForm       = { repuesto_id: r.id, cantidad: 1, precio_unitario: r.precio_venta };
    this.busquedaRepuesto   = r.nombre;
    this.mostrarSugRepuesto = false;
    this.cdr.detectChanges();
  }

  agregarRepuesto() {
    if (!this.repuestoForm.repuesto_id) { alert('Selecciona un repuesto'); return; }
    this.ordenesService.agregarRepuesto(this.ordenActual.id, this.repuestoForm).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.busquedaRepuesto = '';
          this.repuestoForm     = {};
          this.recargarActual();
          this.cargar();
        });
      },
      error: (err) => alert(err.error?.mensaje || 'Error al agregar repuesto')
    });
  }

  eliminarRepuesto(orId: number) {
    if (!confirm('¿Eliminar este repuesto?')) return;
    this.ordenesService.eliminarRepuesto(this.ordenActual.id, orId).subscribe({
      next: () => { this.ngZone.run(() => { this.recargarActual(); this.cargar(); }); }
    });
  }

  // ── Nueva orden ──
  nueva() {
    this.ordenForm              = {};
    this.busquedaVehiculo       = '';
    this.busquedaMecanico       = '';
    this.vehiculoSeleccionado   = null;
    this.mecanicoSeleccionado   = null;
    this.serviciosNuevaOrden    = [];
    this.repuestosNuevaOrden    = [];
    this.busquedaServicioNueva  = '';
    this.busquedaRepuestoNueva  = '';
    this.mostrarModalNueva      = true;
    this.cdr.detectChanges();
  }

  guardarOrden() {
    if (!this.ordenForm.vehiculo_id || !this.ordenForm.descripcion_problema) {
      alert('Selecciona un vehículo y describe el problema'); return;
    }
    this.guardando = true;
    this.cdr.detectChanges();

    this.ordenesService.create(this.ordenForm).subscribe({
      next: (res) => {
        const ordenId   = res.id;
        const servicios = [...this.serviciosNuevaOrden];
        const repuestos = [...this.repuestosNuevaOrden];

        const agregarServicios = (i: number) => {
          if (i >= servicios.length) { agregarRepuestos(0); return; }
          this.ordenesService.agregarServicio(ordenId, servicios[i]).subscribe({
            next: () => agregarServicios(i + 1),
            error: () => agregarServicios(i + 1)
          });
        };

        const agregarRepuestos = (i: number) => {
          if (i >= repuestos.length) {
            this.ngZone.run(() => {
              this.guardando           = false;
              this.mostrarModalNueva   = false;
              this.serviciosNuevaOrden = [];
              this.repuestosNuevaOrden = [];
              Promise.resolve().then(() => { this.cdr.detectChanges(); this.cargar(); });
            });
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
        this.ngZone.run(() => {
          this.guardando = false;
          alert(err.error?.mensaje || 'Error al crear orden');
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ── Ver detalle ──
  verOrden(orden: any) {
    this.ordenesService.getById(orden.id).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.ordenActual     = data;
          this.mostrarModalVer = true;
          Promise.resolve().then(() => this.cdr.detectChanges());
        });
      }
    });
  }

  // ── Editar orden ──
  editarOrden(orden: any) {
    this.ordenesService.getById(orden.id).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.ordenActual   = data;
          this.ordenEditForm = {
            mecanico_id:          data.mecanico_id,
            descripcion_problema: data.descripcion_problema,
            fecha_estimada:       data.fecha_estimada ? data.fecha_estimada.substring(0, 10) : '',
            km_actual:            data.km_actual,
            mano_obra:            data.mano_obra,
            observaciones:        data.observaciones || ''
          };
          this.busquedaMecanicoEdit = data.mecanico || '';
          this.estadoForm           = { estado: data.estado, comentario: '' };
          this.busquedaServicio     = '';
          this.busquedaRepuesto     = '';
          this.servicioForm         = {};
          this.repuestoForm         = {};
          this.mostrarSugServicio   = false;
          this.mostrarSugRepuesto   = false;
          this.mostrarModalEditar   = true;
          Promise.resolve().then(() => this.cdr.detectChanges());
        });
      }
    });
  }

  recargarActual() {
    if (!this.ordenActual) return;
    this.ordenesService.getById(this.ordenActual.id).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.ordenActual = data;
          Promise.resolve().then(() => this.cdr.detectChanges());
        });
      }
    });
  }

  guardarEdicion() {
    this.guardando = true;
    this.cdr.detectChanges();

    this.ordenesService.update(this.ordenActual.id, this.ordenEditForm).subscribe({
      next: () => {
        const estadoCambio = this.estadoForm.estado !== this.ordenActual.estado;
        if (estadoCambio) {
          this.ordenesService.updateEstado(
            this.ordenActual.id, this.estadoForm.estado, this.estadoForm.comentario
          ).subscribe({
            next: () => {
              this.ngZone.run(() => {
                this.guardando          = false;
                this.mostrarModalEditar = false;
                Promise.resolve().then(() => { this.cdr.detectChanges(); this.cargar(); });
              });
            }
          });
        } else {
          this.ngZone.run(() => {
            this.guardando          = false;
            this.mostrarModalEditar = false;
            Promise.resolve().then(() => { this.cdr.detectChanges(); this.cargar(); });
          });
        }
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.guardando = false;
          alert(err.error?.mensaje || 'Error al actualizar');
          this.cdr.detectChanges();
        });
      }
    });
  }

  eliminarOrden(orden: any) {
    if (!confirm(`¿Eliminar permanentemente la orden ${orden.codigo}? Esta acción no se puede deshacer.`)) return;
    this.ordenesService.eliminar(orden.id).subscribe({
      next: () => {
        this.ngZone.run(() => {
          Promise.resolve().then(() => { this.cdr.detectChanges(); this.cargar(); });
        });
      },
      error: (err) => alert(err.error?.mensaje || 'Error al eliminar')
    });
  }

  getBadge(estado: string) {
    return this.estadoConfig[estado] || { label: estado, clase: 'badge bg-secondary' };
  }

  get contadorEstados() {
    const c: any = { todos: this.ordenes.length };
    this.estados.forEach(e => c[e] = this.ordenes.filter(o => o.estado === e).length);
    return c;
  }

  get totalNuevaOrden() {
    const serv = this.serviciosNuevaOrden.reduce((a, s) => a + parseFloat(s.precio || 0), 0);
    const rep  = this.repuestosNuevaOrden.reduce((a, r) => a + (parseFloat(r.precio_unitario || 0) * (r.cantidad || 1)), 0);
    const mo   = parseFloat(this.ordenForm.mano_obra || 0);
    return serv + rep + mo;
  }

  // ── WhatsApp Notifier ──
  abrirModalWhatsApp(o: any) {
    this.ordenWhatsApp = o;
    let tel = (o.telefono || '').replace(/\D/g, '');
    if (tel.length === 9) tel = '51' + tel;
    this.telefonoWhatsApp = tel;
    this.seleccionarPlantillaWhatsApp(o.estado === 'listo' ? 'listo' : 'avance');
    this.mostrarModalWhatsApp = true;
    this.cdr.detectChanges();
  }

  seleccionarPlantillaWhatsApp(tipo: string) {
    this.plantillaActiva = tipo;
    const o = this.ordenWhatsApp;
    if (!o) return;
    const cliente = o.cliente || 'Cliente';
    const vehiculo = o.vehiculo || 'su vehículo';
    const placa = o.placa || '';
    const codigo = o.codigo || '';
    const total = o.total_factura ? `S/ ${parseFloat(o.total_factura).toFixed(2)}` : 'S/ 0.00';

    if (tipo === 'listo') {
      this.mensajeWhatsApp = `Hola *${cliente}* 👋, le saludamos del *Taller Automotriz*. Le informamos que su vehículo *${vehiculo}* (Placa: *${placa}*) correspondiente a la orden *#${codigo}* ya se encuentra ✅ *LISTO PARA RETIRAR*.\n\n💰 Total a pagar: *${total}*.\n📍 ¡Puede pasar a nuestras instalaciones en nuestro horario habitual!`;
    } else if (tipo === 'avance') {
      this.mensajeWhatsApp = `Hola *${cliente}* 👋, le informamos del avance de su vehículo *${vehiculo}* (Placa: *${placa}*). Actualmente se encuentra: *${this.getBadge(o.estado).label}* 🛠️.\nPuede consultar el avance en vivo en nuestra web con su placa. ¡Estamos a su servicio!`;
    } else if (tipo === 'diagnostico') {
      this.mensajeWhatsApp = `Hola *${cliente}* 👋, hemos finalizado el diagnóstico técnico de su vehículo *${vehiculo}* (Placa: *${placa}*). Por favor contáctenos para coordinar el presupuesto y la aprobación de los trabajos a realizar.`;
    } else if (tipo === 'ingreso') {
      this.mensajeWhatsApp = `Hola *${cliente}* 👋, confirmamos el ingreso de su vehículo *${vehiculo}* (Placa: *${placa}*) a nuestras instalaciones con la Orden de Servicio *#${codigo}*. Le mantendremos informado de cada avance.`;
    }
    this.cdr.detectChanges();
  }

  enviarWhatsApp() {
    if (!this.telefonoWhatsApp) {
      alert('Debe ingresar un número de teléfono válido');
      return;
    }
    const url = `https://wa.me/${this.telefonoWhatsApp}?text=${encodeURIComponent(this.mensajeWhatsApp)}`;
    window.open(url, '_blank');
    this.mostrarModalWhatsApp = false;
    this.cdr.detectChanges();
  }

  // ── Cambio Rápido de Estado Directo ──
  cambiarEstadoDirecto(orden: any, nuevoEstado: string) {
    if (orden.estado === nuevoEstado) return;
    this.ordenesService.updateEstado(orden.id, nuevoEstado, 'Actualización rápida').subscribe({
      next: () => {
        orden.estado = nuevoEstado;
        this.aplicarFiltros();
        this.cdr.detectChanges();
      },
      error: () => alert('Error al actualizar estado')
    });
  }

  // ── Historial por Placa (Hoja de Vida) ──
  abrirHistorialPlaca(placa?: string) {
    this.placaBusquedaHistorial = placa ? placa.trim().toUpperCase() : '';
    this.historialPlacaDatos = null;
    this.errorHistorialPlaca = '';
    this.mostrarModalHistorial = true;
    if (this.placaBusquedaHistorial) {
      this.buscarHistorialPlaca();
    }
    this.cdr.detectChanges();
  }

  buscarHistorialPlaca() {
    const p = this.placaBusquedaHistorial.trim();
    if (!p) return;
    this.cargandoHistorialPlaca = true;
    this.errorHistorialPlaca = '';
    this.http.get<any>(`${environment.apiUrl}/vehiculos/placa/${p}/historial`).subscribe({
      next: (res) => {
        this.historialPlacaDatos = res;
        this.cargandoHistorialPlaca = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargandoHistorialPlaca = false;
        this.errorHistorialPlaca = err.error?.mensaje || 'No se encontró historial para esta placa';
        this.historialPlacaDatos = null;
        this.cdr.detectChanges();
      }
    });
  }
}

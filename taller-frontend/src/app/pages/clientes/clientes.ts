import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ClientesService } from '../../core/services/clientes.service';
import { RolService } from '../../core/services/rol.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clientes.html',
  styleUrl: './clientes.css'
})
export class ClientesComponent implements OnInit {
  clientes:  any[] = [];
  filtrados: any[] = [];
  busqueda   = '';
  cargando   = false;
  mostrarModal          = false;
  mostrarModalEliminar  = false;
  mostrarModalHistorial = false;
  guardando    = false;
  eliminando   = false;
  clienteForm: any  = {};
  clienteAEliminar: any  = null;
  clienteHistorial: any  = null;
  modoEdicion  = false;

  // Selección múltiple
  seleccionados: Set<number> = new Set();

  // Historial
  historial:        any[] = [];
  cargandoHistorial = false;
  mostrarModalEditarOrden  = false;
  mostrarModalEliminarOrden = false;
  ordenEditForm: any = {};
  ordenAEliminar: any = null;
  guardandoOrden  = false;
  eliminandoOrden = false;

  // Getter para calcular el total acumulado en el historial de forma segura
  get totalHistorial(): number {
    return this.historial.reduce((acumulador, orden) => {
      const monto = parseFloat(orden.total) || 0;
      return acumulador + monto;
    }, 0);
  }

  estadoConfig: any = {
    recibido:         { label: 'Recibido',           clase: 'bg-secondary' },
    diagnostico:      { label: 'En diagnóstico',     clase: 'bg-info text-dark' },
    en_reparacion:    { label: 'En reparación',      clase: 'bg-primary' },
    espera_repuestos: { label: 'Espera repuestos',   clase: 'bg-warning text-dark' },
    listo:            { label: 'Listo para retirar', clase: 'bg-success' },
    entregado:        { label: 'Entregado',          clase: 'bg-dark' },
    cancelado:        { label: 'Cancelado',          clase: 'bg-danger' },
  };
  estados = Object.keys(this.estadoConfig);

  // Consulta documento
  tipoDoc     = 'dni';
  numDoc      = '';
  buscandoDoc = false;
  errorDoc    = '';

  tiposDoc = [
    { value: 'dni',         label: 'DNI',                 digitos: 8  },
    { value: 'ruc',         label: 'RUC',                 digitos: 11 },
    { value: 'pasaporte',   label: 'Pasaporte',           digitos: 0  },
    { value: 'extranjeria', label: 'Carné de Extranjería',digitos: 0  },
  ];

  private urlBase  = environment.apiUrl;
  private urlProxy = `${environment.apiUrl}/consulta-doc`;

  constructor(
    private clientesService: ClientesService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    public rol: RolService
  ) {}

  ngOnInit() { this.cargar(); }

  cargar() {
    Promise.resolve().then(() => {
      this.cargando = true;
      this.cdr.detectChanges();
      this.clientesService.getAll().subscribe({
        next: (data) => {
          Promise.resolve().then(() => {
            this.clientes  = data;
            this.filtrados = data;
            this.cargando  = false;
            this.seleccionados.clear();
            this.cdr.detectChanges();
          });
        },
        error: () => {
          Promise.resolve().then(() => {
            this.cargando = false;
            this.cdr.detectChanges();
          });
        }
      });
    });
  }

  filtrar() {
    const q = this.busqueda.toLowerCase();
    this.filtrados = this.clientes.filter(c =>
      `${c.nombre} ${c.apellido}`.toLowerCase().includes(q) ||
      c.dni?.includes(q) || c.telefono?.includes(q)
    );
    this.seleccionados.clear();
  }

  toggleSeleccion(id: number) {
    if (this.seleccionados.has(id)) this.seleccionados.delete(id);
    else this.seleccionados.add(id);
    this.cdr.detectChanges();
  }

  toggleTodos() {
    if (this.seleccionados.size === this.filtrados.length)
      this.seleccionados.clear();
    else
      this.filtrados.forEach(c => this.seleccionados.add(c.id));
    this.cdr.detectChanges();
  }

  get todosSeleccionados() {
    return this.filtrados.length > 0 &&
           this.seleccionados.size === this.filtrados.length;
  }

  // ── Modal cliente ──
  nuevo() {
    this.clienteForm  = { tipo_documento: 'dni' };
    this.modoEdicion  = false;
    this.tipoDoc      = 'dni';
    this.numDoc       = '';
    this.errorDoc     = '';
    this.mostrarModal = true;
  }

  editar(c: any) {
    if (!this.rol.puedeEditarCliente()) return;
    this.clienteForm  = { ...c };
    this.modoEdicion  = true;
    this.tipoDoc      = c.tipo_documento || 'dni';
    this.numDoc       = c.dni || '';
    this.errorDoc     = '';
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.errorDoc     = '';
    this.numDoc       = '';
  }

  onTipoDocChange() { this.numDoc = ''; this.errorDoc = ''; }

  onNumDocKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') this.buscarDocumento();
  }

  get tipoCfg() {
    return this.tiposDoc.find(t => t.value === this.tipoDoc)!;
  }

  get puedeConsultar() {
    return this.tipoDoc === 'dni' || this.tipoDoc === 'ruc';
  }

  buscarDocumento() {
    if (!this.puedeConsultar) return;
    const num = this.numDoc.trim();
    if (!num) { this.errorDoc = 'Ingresa el número de documento'; return; }
    const cfg = this.tipoCfg;
    if (cfg.digitos > 0 && num.length !== cfg.digitos) {
      this.errorDoc = `El ${cfg.label} debe tener ${cfg.digitos} dígitos`;
      return;
    }
    this.buscandoDoc = true;
    this.errorDoc    = '';
    const url = this.tipoDoc === 'dni'
      ? `${this.urlProxy}/dni/${num}`
      : `${this.urlProxy}/ruc/${num}`;

    this.http.get<any>(url).subscribe({
      next: (res) => {
        this.buscandoDoc = false;
        if (this.tipoDoc === 'dni') {
          this.clienteForm.nombre   = res.nombres || '';
          this.clienteForm.apellido =
            `${res.apellidoPaterno || ''} ${res.apellidoMaterno || ''}`.trim();
          this.clienteForm.dni      = num;
        } else {
          this.clienteForm.nombre    = res.razonSocial || '';
          this.clienteForm.apellido  = '';
          this.clienteForm.dni       = num;
          this.clienteForm.direccion = res.direccion || '';
        }
        this.clienteForm.tipo_documento = this.tipoDoc;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.buscandoDoc = false;
        this.errorDoc = err.status === 404 || err.status === 422
          ? `${cfg.label} no encontrado. Puedes completar manualmente.`
          : 'Error de conexión. Completa los datos manualmente.';
        this.cdr.detectChanges();
      }
    });
  }

  guardar() {
    if (!this.clienteForm.nombre) {
      alert('El nombre / razón social es obligatorio'); return;
    }
    this.clienteForm.tipo_documento = this.tipoDoc;
    this.guardando = true;
    const op = this.modoEdicion
      ? this.clientesService.update(this.clienteForm.id, this.clienteForm)
      : this.clientesService.create(this.clienteForm);

    op.subscribe({
      next: () => {
        Promise.resolve().then(() => {
          this.guardando    = false;
          this.mostrarModal = false;
          this.cdr.detectChanges();
          this.cargar();
        });
      },
      error: (err) => {
        Promise.resolve().then(() => {
          this.guardando = false;
          alert(err.error?.mensaje || 'Error al guardar');
          this.cdr.detectChanges();
        });
      }
    });
  }

  abrirEliminar(c: any) {
    this.clienteAEliminar    = c;
    this.mostrarModalEliminar = true;
  }

  confirmarEliminar() {
    if (!this.clienteAEliminar) return;
    this.eliminando = true;
    this.http.delete(`${this.urlBase}/clientes/${this.clienteAEliminar.id}`)
      .subscribe({
        next: () => {
          this.eliminando           = false;
          this.mostrarModalEliminar = false;
          this.clienteAEliminar     = null;
          this.cdr.detectChanges();
          this.cargar();
        },
        error: (err) => {
          this.eliminando = false;
          alert(err.error?.mensaje || 'Error al eliminar');
          this.cdr.detectChanges();
        }
      });
  }

  eliminarSeleccionados() {
    if (this.seleccionados.size === 0) return;
    if (!confirm(`¿Eliminar ${this.seleccionados.size} cliente(s)?`)) return;
    const ids = Array.from(this.seleccionados);
    let completados = 0; let errores: string[] = [];
    ids.forEach(id => {
      this.http.delete(`${this.urlBase}/clientes/${id}`).subscribe({
        next: () => { completados++; if (completados === ids.length) { if (errores.length) alert(errores.join('\n')); this.cargar(); } },
        error: (err) => { completados++; errores.push(err.error?.mensaje || `Error con ID ${id}`); if (completados === ids.length) { if (errores.length) alert(errores.join('\n')); this.cargar(); } }
      });
    });
  }

  // ── HISTORIAL ──
  verHistorial(c: any) {
    this.clienteHistorial     = c;
    this.historial            = [];
    this.cargandoHistorial    = true;
    this.mostrarModalHistorial = true;
    this.cdr.detectChanges();

    this.http.get<any[]>(`${this.urlBase}/clientes/${c.id}/historial`).subscribe({
      next: (data) => {
        this.historial         = data;
        this.cargandoHistorial = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoHistorial = false;
        this.cdr.detectChanges();
      }
    });
  }

  getBadge(estado: string) {
    return this.estadoConfig[estado] || { label: estado, clase: 'bg-secondary' };
  }

  // Editar orden desde historial
  abrirEditarOrden(orden: any) {
    this.ordenEditForm = {
      id:                   orden.id,
      descripcion_problema: orden.descripcion,
      estado:               orden.estado,
      mano_obra:            orden.mano_obra,
      fecha_estimada:       ''
    };
    this.mostrarModalEditarOrden = true;
  }

  guardarOrdenHistorial() {
    if (!this.clienteHistorial || !this.ordenEditForm.id) return;
    this.guardandoOrden = true;
    this.http.put(
      `${this.urlBase}/clientes/${this.clienteHistorial.id}/historial/${this.ordenEditForm.id}`,
      this.ordenEditForm
    ).subscribe({
      next: () => {
        this.guardandoOrden          = false;
        this.mostrarModalEditarOrden = false;
        this.verHistorial(this.clienteHistorial);
      },
      error: (err) => {
        this.guardandoOrden = false;
        alert(err.error?.mensaje || 'Error al actualizar');
        this.cdr.detectChanges();
      }
    });
  }

  // Eliminar orden desde historial
  abrirEliminarOrden(orden: any) {
    this.ordenAEliminar            = orden;
    this.mostrarModalEliminarOrden = true;
  }

  confirmarEliminarOrden() {
    if (!this.ordenAEliminar || !this.clienteHistorial) return;
    this.eliminandoOrden = true;
    this.http.delete(
      `${this.urlBase}/clientes/${this.clienteHistorial.id}/historial/${this.ordenAEliminar.id}`
    ).subscribe({
      next: () => {
        this.eliminandoOrden           = false;
        this.mostrarModalEliminarOrden = false;
        this.ordenAEliminar            = null;
        this.verHistorial(this.clienteHistorial);
      },
      error: (err) => {
        this.eliminandoOrden = false;
        alert(err.error?.mensaje || 'Error al eliminar');
        this.cdr.detectChanges();
      }
    });
  }
}


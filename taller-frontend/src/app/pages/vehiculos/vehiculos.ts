import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { VehiculosService } from '../../core/services/vehiculos.service';
import { ClientesService } from '../../core/services/clientes.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-vehiculos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vehiculos.html',
  styleUrl: './vehiculos.css'
})
export class VehiculosComponent implements OnInit {
  vehiculos: any[] = [];
  filtrados: any[] = [];
  clientes: any[] = [];
  busqueda = '';
  cargando = false;
  mostrarModal = false;
  guardando = false;
  vehiculoForm: any = {};
  modoEdicion = false;
  seleccionados: Set<number> = new Set();
  mostrarModalEliminar = false;
  vehiculoAEliminar: any = null;
  eliminando = false;
  marcas: string[] = [];
  modelos: string[] = [];
  tipos: string[] = [];
  catalogoRaw: any[] = [];
  busquedaCliente = '';
  clientesFiltrados: any[] = [];
  mostrarSugClientes = false;
  clienteSeleccionado: any = null;
  panelCatalogo: 'marca' | 'modelo' | 'tipo_vehiculo' | null = null;
  nuevoCatalogoValor = '';
  guardandoCatalogo = false;
  private urlCatalogos = `${environment.apiUrl}/catalogos`;

  constructor(
    private vehiculosService: VehiculosService,
    private clientesService: ClientesService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.cargar();
    this.cargarClientes();
    this.cargarCatalogos();
  }

  cargar() {
    this.cargando = true;
    this.vehiculosService.getAll().subscribe({
      next: (data) => {
        this.vehiculos = data;
        this.filtrados = data;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  cargarClientes() {
    this.clientesService.getAll().subscribe({
      next: (data) => { this.clientes = data; }
    });
  }

  cargarCatalogos() {
    this.http.get<any[]>(this.urlCatalogos).subscribe({
      next: (data) => {
        this.catalogoRaw = data;
        this.sincronizarCatalogos();
        this.cdr.detectChanges();
      }
    });
  }

  sincronizarCatalogos() {
    const por = (tipo: string) =>
      this.catalogoRaw.filter(c => c.tipo === tipo).map(c => c.valor).sort();
    this.marcas = por('marca');
    this.modelos = por('modelo');
    this.tipos = por('tipo_vehiculo');
  }

  filtrar() {
    const q = this.busqueda.toLowerCase();
    this.filtrados = this.vehiculos.filter(v =>
      v.placa?.toLowerCase().includes(q) ||
      v.marca?.toLowerCase().includes(q) ||
      v.modelo?.toLowerCase().includes(q) ||
      v.cliente?.toLowerCase().includes(q)
    );
  }

  buscarCliente() {
    const q = this.busquedaCliente.trim().toLowerCase();
    if (q.length < 1) {
      this.clientesFiltrados = [];
      this.mostrarSugClientes = false;
      return;
    }
    this.clientesFiltrados = this.clientes.filter(c =>
      `${c.nombre} ${c.apellido}`.toLowerCase().includes(q) || c.dni?.includes(q)
    ).slice(0, 7);
    this.mostrarSugClientes = this.clientesFiltrados.length > 0;
  }

  seleccionarCliente(c: any) {
    this.clienteSeleccionado = c;
    this.vehiculoForm.cliente_id = c.id;
    this.busquedaCliente = `${c.nombre} ${c.apellido}`.trim() + (c.dni ? ` — ${c.dni}` : '');
    this.mostrarSugClientes = false;
  }

  nuevo() {
    this.vehiculoForm = {};
    this.modoEdicion = false;
    this.busquedaCliente = '';
    this.clienteSeleccionado = null;
    this.panelCatalogo = null;
    this.mostrarModal = true;
    this.cdr.detectChanges();
  }

  editar(v: any) {
    this.vehiculoForm = { ...v };
    this.modoEdicion = true;
    const c = this.clientes.find(cl => cl.id === v.cliente_id);
    this.clienteSeleccionado = c || null;
    this.busquedaCliente = c ? `${c.nombre} ${c.apellido}`.trim() + (c.dni ? ` — ${c.dni}` : '') : (v.cliente || '');
    this.mostrarModal = true;
    this.cdr.detectChanges();
  }

  guardar() {
    if (!this.vehiculoForm.cliente_id || !this.vehiculoForm.placa || !this.vehiculoForm.marca) {
      alert('Completa los campos obligatorios (*)');
      return;
    }
    this.guardando = true;
    const op = this.modoEdicion
      ? this.vehiculosService.update(this.vehiculoForm.id, this.vehiculoForm)
      : this.vehiculosService.create(this.vehiculoForm);

    op.subscribe({
      next: () => {
        this.guardando = false;
        this.mostrarModal = false;
        this.cargar();
      },
      error: (err) => {
        this.guardando = false;
        alert(err.error?.mensaje || 'Error al guardar');
        this.cdr.detectChanges();
      }
    });
  }

  abrirSunarp() {
    window.open('https://consultavehicular.sunarp.gob.pe/consulta-vehicular/inicio', '_blank', 'noopener,noreferrer');
  }

  togglePanel(tipo: 'marca' | 'modelo' | 'tipo_vehiculo') {
    this.panelCatalogo = this.panelCatalogo === tipo ? null : tipo;
    this.nuevoCatalogoValor = '';
  }

  agregarCatalogo() {
    const valor = this.nuevoCatalogoValor.trim();
    if (!valor || !this.panelCatalogo) return;
    this.guardandoCatalogo = true;
    this.http.post(this.urlCatalogos, { tipo: this.panelCatalogo, valor }).subscribe({
      next: () => {
        this.guardandoCatalogo = false;
        this.nuevoCatalogoValor = '';
        this.cargarCatalogos();
      },
      error: () => {
        this.guardandoCatalogo = false;
        alert('Error al agregar al catálogo.');
      }
    });
  }

  eliminarCatalogo(item: any) {
    if (!confirm(`¿Eliminar "${item.valor}"?`)) return;
    this.http.delete(`${this.urlCatalogos}/${item.id}`).subscribe({
      next: () => this.cargarCatalogos()
    });
  }

  itemsDe(tipo: string) { return this.catalogoRaw.filter(c => c.tipo === tipo); }

  labelPanel(tipo: string | null) {
    const m: Record<string, string> = { marca: 'Marcas', modelo: 'Modelos', tipo_vehiculo: 'Tipos' };
    return tipo ? (m[tipo] || tipo) : '';
  }

  toggleSeleccion(id: number) {
    if (this.seleccionados.has(id)) this.seleccionados.delete(id);
    else this.seleccionados.add(id);
  }

  toggleTodos() {
    if (this.seleccionados.size === this.filtrados.length) this.seleccionados.clear();
    else this.filtrados.forEach(v => this.seleccionados.add(v.id));
  }

  get todosSeleccionados() {
    return this.filtrados.length > 0 && this.seleccionados.size === this.filtrados.length;
  }

  abrirEliminar(v: any) {
    this.vehiculoAEliminar = v;
    this.mostrarModalEliminar = true;
  }

  confirmarEliminar() {
    this.eliminando = true;
    this.http.delete(`${environment.apiUrl}/vehiculos/${this.vehiculoAEliminar.id}`).subscribe({
      next: () => {
        this.eliminando = false;
        this.mostrarModalEliminar = false;
        this.cargar();
      },
      error: () => {
        this.eliminando = false;
        alert('Error al eliminar');
      }
    });
  }

  eliminarSeleccionados() {
    if (!confirm(`¿Eliminar ${this.seleccionados.size} seleccionados?`)) return;
    Array.from(this.seleccionados).forEach(id => {
      this.http.delete(`${environment.apiUrl}/vehiculos/${id}`).subscribe({
        next: () => this.cargar()
      });
    });
    this.seleccionados.clear();
  }
}

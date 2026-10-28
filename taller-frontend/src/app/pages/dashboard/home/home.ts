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
  refrescando = false;
  ordenesListas: any[] = [];
  ordenesAtrasadas: any[] = [];
  ordenesSinAsignar: any[] = [];
  errorPrioridades = false;
  cargandoPrioridades = true;
  repuestosCriticos: any[] = [];
  placaBusqueda = '';
  fechaActual = new Date();

  // Catálogo y Precios de Productos en Vivo
  productos: any[] = [];
  productosFiltrados: any[] = [];
  cargandoProductos = false;
  busquedaProducto = '';
  categoriaSeleccionada = 'Todas';
  filtroStock: 'todos' | 'con-stock' | 'sin-stock' | 'critico' = 'todos';
  ordenProductos: 'nombre' | 'mayor-precio' | 'menor-precio' | 'mayor-stock' = 'mayor-precio';
  categorias: string[] = [];
  paginaProductos = 1;
  itemsPorPagina = 8;
  productoSeleccionadoModal: any = null;
  mostrarModalPrecio = false;
  mensajeToast = '';

  // Pestañas
  pestanaActividad: 'ordenes' | 'ventas' = 'ordenes';
  pestanaPeriodoVenta: 'dia' | 'mes' = 'dia';

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
    this.cargarProductos();
  }

  refrescarTodo() {
    this.refrescando = true;
    this.fechaActual = new Date();
    this.cargar();
    this.cargarListos();
    this.cargarStockCritico();
    this.cargarProductos();
    setTimeout(() => {
      this.refrescando = false;
      this.mostrarToast('Datos actualizados');
      this.cdr.detectChanges();
    }, 600);
  }

  cargar() {
    this.cargando = true;
    this.ordenesService.getEstadisticas().subscribe({
      next: (data) => {
        this.stats = data;
        this.cargando = false;
        this.recalcularFallbacks();
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  cargarListos() {
    this.cargandoPrioridades = true;
    this.ordenesService.getAll().subscribe({
      next: (data) => {
        const ordenes = data || [];
        const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        const activas = ordenes.filter(o => !['entregado', 'cancelado'].includes(o.estado));
        this.ordenesListas = ordenes.filter(o => o.estado === 'listo');
        this.ordenesAtrasadas = activas.filter(o => o.estado !== 'listo' && o.fecha_estimada && String(o.fecha_estimada).slice(0, 10) < hoy);
        this.ordenesSinAsignar = activas.filter(o => o.estado !== 'listo' && !o.mecanico_id && !o.mecanico);
        this.errorPrioridades = false;
        this.cargandoPrioridades = false;
        this.cdr.detectChanges();
      },
      error: () => { this.cargandoPrioridades = false; this.errorPrioridades = true; this.cdr.detectChanges(); }
    });
  }

  cargarStockCritico() {
    this.http.get<any[]>(`${environment.apiUrl}/repuestos/stock-bajo`).subscribe({
      next: (data) => {
        this.repuestosCriticos = (data || []).slice(0, 6);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  cargarProductos() {
    this.cargandoProductos = true;
    this.http.get<any[]>(`${environment.apiUrl}/repuestos`).subscribe({
      next: (data) => {
        this.productos = (data || []).filter(p => p.activo !== false);

        // Extraer categorías únicas
        const catSet = new Set<string>();
        this.productos.forEach(p => {
          if (p.categoria && p.categoria.trim()) {
            catSet.add(p.categoria.trim());
          }
        });
        this.categorias = Array.from(catSet).sort();

        this.filtrarProductos();
        this.recalcularFallbacks();
        this.cargandoProductos = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoProductos = false;
        this.cdr.detectChanges();
      }
    });
  }

  recalcularFallbacks() {
    if (!this.stats) return;

    // Si el backend no envió ventaDiaria (ej. versión previa)
    if (!this.stats.ventaDiaria) {
      this.stats.ventaDiaria = {
        total: 0,
        taller: 0,
        mostrador: 0,
        cantidad: 0,
        cantTaller: 0,
        cantMostrador: 0
      };
    }

    // Si el backend no envió ventaMensual
    if (!this.stats.ventaMensual) {
      const mes = this.stats.ingresosMes || 0;
      this.stats.ventaMensual = {
        total: mes,
        taller: mes,
        mostrador: 0,
        cantidad: 0,
        ticketPromedio: mes
      };
    }

    // Si el backend no envió inventario y tenemos los productos
    if (!this.stats.inventario && this.productos.length > 0) {
      let vVenta = 0;
      let vCosto = 0;
      let sinStock = 0;
      let critico = 0;
      for (const r of this.productos) {
        const s = r.stock || 0;
        const pv = parseFloat(r.precio_venta) || 0;
        const pc = parseFloat(r.precio_compra) || 0;
        if (s <= 0) {
          sinStock++;
        } else {
          vVenta += s * pv;
          vCosto += s * pc;
          if (s <= (r.stock_minimo || 5)) critico++;
        }
      }
      this.stats.inventario = {
        totalProductos: this.productos.length,
        valorInventarioVenta: Math.round(vVenta * 100) / 100,
        valorInventarioCosto: Math.round(vCosto * 100) / 100,
        margenPotencial: Math.round((vVenta - vCosto) * 100) / 100,
        sinStock,
        critico,
        conStock: this.productos.length - sinStock
      };
    }
  }

  filtrarProductos() {
    const q = (this.busquedaProducto || '').trim().toLowerCase();
    const cat = this.categoriaSeleccionada;
    const stockFiltro = this.filtroStock;

    let res = this.productos.filter(p => {
      // Búsqueda por texto
      const coincideTexto = !q ||
        (p.nombre && p.nombre.toLowerCase().includes(q)) ||
        (p.codigo && p.codigo.toLowerCase().includes(q)) ||
        (p.codigo_barra && p.codigo_barra.toLowerCase().includes(q)) ||
        (p.codigo_oem && p.codigo_oem.toLowerCase().includes(q)) ||
        (p.marca && p.marca.toLowerCase().includes(q)) ||
        (p.categoria && p.categoria.toLowerCase().includes(q));

      // Búsqueda por categoría
      const coincideCat = cat === 'Todas' || p.categoria === cat;

      // Búsqueda por stock
      let coincideStock = true;
      const s = p.stock || 0;
      const sMin = p.stock_minimo || 5;
      if (stockFiltro === 'con-stock') coincideStock = s > 0;
      else if (stockFiltro === 'sin-stock') coincideStock = s <= 0;
      else if (stockFiltro === 'critico') coincideStock = s > 0 && s <= sMin;

      return coincideTexto && coincideCat && coincideStock;
    });

    // Ordenamiento
    if (this.ordenProductos === 'mayor-precio') {
      res.sort((a, b) => (parseFloat(b.precio_venta) || 0) - (parseFloat(a.precio_venta) || 0));
    } else if (this.ordenProductos === 'menor-precio') {
      res.sort((a, b) => (parseFloat(a.precio_venta) || 0) - (parseFloat(b.precio_venta) || 0));
    } else if (this.ordenProductos === 'mayor-stock') {
      res.sort((a, b) => (b.stock || 0) - (a.stock || 0));
    } else if (this.ordenProductos === 'nombre') {
      res.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    }

    this.productosFiltrados = res;
    this.paginaProductos = 1;
    this.cdr.detectChanges();
  }

  get productosPaginados(): any[] {
    const start = (this.paginaProductos - 1) * this.itemsPorPagina;
    return this.productosFiltrados.slice(start, start + this.itemsPorPagina);
  }

  get totalPaginas(): number {
    return Math.ceil(this.productosFiltrados.length / this.itemsPorPagina) || 1;
  }

  cambiarPagina(nuevaPagina: number) {
    if (nuevaPagina >= 1 && nuevaPagina <= this.totalPaginas) {
      this.paginaProductos = nuevaPagina;
      this.cdr.detectChanges();
    }
  }

  limpiarBusqueda() {
    this.busquedaProducto = '';
    this.categoriaSeleccionada = 'Todas';
    this.filtroStock = 'todos';
    this.filtrarProductos();
  }

  copiarPrecio(p: any) {
    const precio = parseFloat(p.precio_venta || 0).toFixed(2);
    const moneda = p.moneda === 'USD' ? '$' : 'S/';
    const texto = `${p.nombre} (Cód: ${p.codigo || '—'}) - Precio: ${moneda} ${precio}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(texto).then(() => {
        this.mostrarToast(`¡Precio copiado! ${p.nombre}: ${moneda} ${precio}`);
      }).catch(() => {
        this.mostrarToast(`${moneda} ${precio}`);
      });
    } else {
      this.mostrarToast(`${moneda} ${precio}`);
    }
  }

  verDetallePrecios(p: any) {
    this.productoSeleccionadoModal = p;
    this.mostrarModalPrecio = true;
    this.cdr.detectChanges();
  }

  cerrarModalPrecio() {
    this.mostrarModalPrecio = false;
    this.productoSeleccionadoModal = null;
    this.cdr.detectChanges();
  }

  mostrarToast(msg: string) {
    this.mensajeToast = msg;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.mensajeToast = '';
      this.cdr.detectChanges();
    }, 2800);
  }

  getMargen(p: any): { monto: number, porcentaje: number } {
    const venta = parseFloat(p?.precio_venta) || 0;
    const compra = parseFloat(p?.precio_compra) || 0;
    const monto = venta - compra;
    const porcentaje = compra > 0 ? ((monto / compra) * 100) : (venta > 0 ? 100 : 0);
    return {
      monto: Math.round(monto * 100) / 100,
      porcentaje: Math.round(porcentaje)
    };
  }

  getMax7Dias(): number {
    if (!this.stats?.ultimos7Dias || this.stats.ultimos7Dias.length === 0) return 100;
    const max = Math.max(...this.stats.ultimos7Dias.map((d: any) => d.total || 0));
    return max > 0 ? max : 100;
  }

  getBarHeight(total: number): number {
    const max = this.getMax7Dias();
    if (!total || total <= 0) return 6; // barra mínima para estética
    const pct = (total / max) * 100;
    return Math.max(pct, 10);
  }

  getTotalMetodos(): number {
    if (!this.stats?.metodosPago) return 0;
    const m = this.stats.metodosPago;
    return (m.efectivo || 0) + (m.yape || 0) + (m.plin || 0) + (m.tarjeta || 0) + (m.transferencia || 0);
  }

  getPctMetodo(monto: number): number {
    const total = this.getTotalMetodos();
    if (total <= 0) return 0;
    return Math.round(((monto || 0) / total) * 100);
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

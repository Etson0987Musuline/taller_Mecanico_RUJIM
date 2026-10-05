import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VentasService } from '../../core/services/ventas.service';
import { HttpClient } from '@angular/common/http';
import { RolService } from '../../core/services/rol.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ventas.html',
  styleUrl: './ventas.css'
})
export class VentasComponent implements OnInit {
  @ViewChild('inputBusqueda') inputBusqueda!: ElementRef;
  @ViewChild('contenedorBusqueda') contenedorBusqueda!: ElementRef;
  @ViewChild('inputCodigo') inputCodigo!: ElementRef;

  vista: 'carrito' | 'historial' = 'carrito';

  // Catálogo
  todosProductos:    any[] = [];
  productosMostrados:any[] = [];
  busqueda           = '';
  categoriaActiva    = 'Todas';
  categorias:        string[] = [];
  yaBusco            = false;

  // Carrito
  carrito:      any[] = [];
  clienteNombre = '';
  clienteDni    = '';
  metodoPago    = 'efectivo';
  metodos       = ['efectivo','tarjeta','transferencia','yape','plin'];
  procesando    = false;
  productoError = '';

  // Código de barras
  codigoBarra = '';

  // Resultado venta
  ventaExitosa: any = null;

  // Historial
  ventas:           any[] = [];
  ventasFiltradas:  any[] = [];
  busquedaHistorial = '';
  cargandoHistorial = false;
  ventaDetalle:     any   = null;
  mostrarDetalle    = false;

  private urlBase = environment.apiUrl.replace('/api', '');
  private urlRep  = `${environment.apiUrl}/repuestos`;

  constructor(
    private ventasService: VentasService,
    private http: HttpClient,
    public cdr: ChangeDetectorRef,
    public rol: RolService
  ) {}

  ngOnInit() { this.cargarProductos(); }

  @HostListener('document:click', ['$event'])
  onClickFuera(event: MouseEvent) {
    if (this.contenedorBusqueda &&
        !this.contenedorBusqueda.nativeElement.contains(event.target)) {
      this.yaBusco = false;
      this.cdr.detectChanges();
    }
  }

  // ── Imagen ──
  getImagenUrl(imagen: string | null) {
    if (!imagen) return null;
    return `${this.urlBase}${imagen}`;
  }

  // ── Catálogo ──
  cargarProductos() {
    this.http.get<any[]>(this.urlRep).subscribe({
      next: (data) => {
        this.todosProductos = data;
        this.categorias     = ['Todas', ...new Set(
          data.map(p => p.categoria).filter(Boolean)
        )];
        this.cdr.detectChanges();
      }
    });
  }

  buscar() {
    const q = this.busqueda.trim().toLowerCase();
    this.yaBusco  = true;
    let resultado = this.todosProductos;
    if (this.categoriaActiva !== 'Todas')
      resultado = resultado.filter(p => p.categoria === this.categoriaActiva);
    if (q)
      resultado = resultado.filter(p =>
        p.nombre?.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q) ||
        p.codigo_barra?.includes(q) ||
        p.categoria?.toLowerCase().includes(q)
      );
    this.productosMostrados = resultado.slice(0, 20);
    this.cdr.detectChanges();
  }

  filtrarPorCategoria(cat: string) {
    this.categoriaActiva = cat;
    this.buscar();
  }

  limpiarBusqueda() {
    this.busqueda          = '';
    this.yaBusco           = false;
    this.productosMostrados = [];
    this.cdr.detectChanges();
  }

  // ── Código de barras ──
  onCodigoKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') this.buscarPorCodigo();
  }

  buscarPorCodigo() {
    const codigo = this.codigoBarra.trim();
    if (!codigo) return;
    this.productoError = '';
    this.ventasService.buscarPorCodigo(codigo).subscribe({
      next: (producto) => {
        this.agregarAlCarrito(producto);
        this.codigoBarra = '';
        this.cdr.detectChanges();
        setTimeout(() => this.inputCodigo?.nativeElement.focus(), 100);
      },
      error: () => {
        this.productoError = `No se encontró: ${codigo}`;
        this.codigoBarra   = '';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Carrito ──
  agregarAlCarrito(producto: any) {
    if (producto.stock <= 0) {
      this.productoError = `Sin stock: ${producto.nombre}`; return;
    }
    const existente = this.carrito.find(i => i.repuesto_id === producto.id);
    if (existente) {
      if (existente.cantidad >= producto.stock) {
        this.productoError = `Stock máximo alcanzado (${producto.stock})`; return;
      }
      existente.cantidad++;
    } else {
      this.carrito.push({
        repuesto_id:     producto.id,
        nombre:          producto.nombre,
        codigo:          producto.codigo || producto.codigo_barra,
        categoria:       producto.categoria,
        imagen:          producto.imagen || null,
        precio_unitario: producto.precio_venta,
        precio_compra:   producto.precio_compra, // solo para referencia interna
        cantidad:        1,
        stock_max:       producto.stock,
        descuento:       0,
        mostrarDescuento:false
      });
    }
    this.productoError = '';
    this.cdr.detectChanges();
  }

  quitarItem(index: number) {
    this.carrito.splice(index, 1);
    this.cdr.detectChanges();
  }

  cambiarCantidad(item: any, delta: number) {
    item.cantidad += delta;
    if (item.cantidad < 1)              item.cantidad = 1;
    if (item.cantidad > item.stock_max) item.cantidad = item.stock_max;
    this.cdr.detectChanges();
  }

  toggleDescuento(item: any) {
    item.mostrarDescuento = !item.mostrarDescuento;
    if (!item.mostrarDescuento) item.descuento = 0;
    this.cdr.detectChanges();
  }

  precioConDescuento(item: any) {
    const d = parseFloat(item.descuento) || 0;
    return Math.max(0, parseFloat(item.precio_unitario) - d);
  }

  totalItem(item: any) {
    return this.precioConDescuento(item) * item.cantidad;
  }

  stockCritico(item: any) {
    return item.cantidad >= item.stock_max * 0.8;
  }

  get subtotal()   { return this.carrito.reduce((a, i) => a + this.totalItem(i), 0); }
  get igv()        { return this.subtotal * 0.18; }
  get total()      { return this.subtotal + this.igv; }
  get totalItems() { return this.carrito.reduce((a, i) => a + i.cantidad, 0); }
  get hayDescuentos() {
    return this.carrito.some(i => (parseFloat(i.descuento) || 0) > 0);
  }
  get totalDescuentos() {
    return this.carrito.reduce((a, i) => a + ((parseFloat(i.descuento) || 0) * i.cantidad), 0);
  }

  limpiarCarrito() {
    this.carrito       = [];
    this.clienteNombre = '';
    this.clienteDni    = '';
    this.metodoPago    = 'efectivo';
    this.productoError = '';
    this.ventaExitosa  = null;
    this.cdr.detectChanges();
  }

  procesarVenta() {
    if (this.carrito.length === 0) return;
    this.procesando = true;
    const payload = {
      cliente_nombre: this.clienteNombre || 'Cliente general',
      cliente_dni:    this.clienteDni,
      metodo_pago:    this.metodoPago,
      items: this.carrito.map(i => ({
        repuesto_id:     i.repuesto_id,
        cantidad:        i.cantidad,
        precio_unitario: i.precio_unitario,
        descuento:       parseFloat(i.descuento) || 0,
        nombre:          i.nombre,
        codigo:          i.codigo
      }))
    };
    this.ventasService.create(payload).subscribe({
      next: (res) => {
        this.ventaExitosa = {
          ...res,
          cliente:         this.clienteNombre || 'Cliente general',
          dni:             this.clienteDni,
          metodo:          this.metodoPago,
          items:           [...this.carrito],
          subtotal:        this.subtotal,
          igv:             this.igv,
          total:           this.total,
          totalDescuentos: this.totalDescuentos,
          fecha:           new Date()
        };
        this.procesando = false;
        this.carrito    = [];
        this.cargarProductos();
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert(err.error?.mensaje || 'Error al procesar la venta');
        this.procesando = false;
        this.cdr.detectChanges();
      }
    });
  }

  imprimirBoleta() {
    const v    = this.ventaExitosa;
    const fecha = new Date(v.fecha).toLocaleString('es-PE');
    const filas = v.items.map((i: any) => {
      const desc      = parseFloat(i.descuento) || 0;
      const precioFin = parseFloat(i.precio_unitario) - desc;
      const subtot    = precioFin * i.cantidad;
      return `
        <tr>
          <td>${i.nombre}${desc > 0 ? `<br><small style="color:#666">Desc: -S/${desc.toFixed(2)}</small>` : ''}</td>
          <td style="text-align:center">${i.cantidad}</td>
          <td style="text-align:right">S/ ${precioFin.toFixed(2)}</td>
          <td style="text-align:right">S/ ${subtot.toFixed(2)}</td>
        </tr>`;
    }).join('');

    const html = `
      <html><head><title>Boleta ${v.numero}</title>
      <style>
        body { font-family:'Courier New',monospace; font-size:12px; width:300px; margin:0 auto; }
        h2   { text-align:center; margin:4px 0; font-size:14px; }
        p    { margin:2px 0; }
        table{ width:100%; border-collapse:collapse; margin:8px 0; }
        th   { border-bottom:1px solid #000; padding:2px; font-size:11px; }
        td   { padding:2px; font-size:11px; }
        .total-row { border-top:1px solid #000; font-weight:bold; }
        .center { text-align:center; } .right { text-align:right; }
        hr { border:none; border-top:1px dashed #000; }
      </style></head><body>
      <h2>TALLER MECÁNICO</h2>
      <p class="center">BOLETA DE VENTA ELECTRÓNICA</p>
      <p class="center"><strong>${v.numero}</strong></p>
      <hr>
      <p>Fecha: ${fecha}</p>
      <p>Cliente: ${v.cliente}</p>
      ${v.dni ? `<p>DNI: ${v.dni}</p>` : ''}
      <p>Pago: ${v.metodo.toUpperCase()}</p>
      <hr>
      <table>
        <tr><th>Producto</th><th>Cant</th><th>P.Unit</th><th>Total</th></tr>
        ${filas}
        ${v.totalDescuentos > 0 ? `
        <tr>
          <td colspan="3" style="color:#e53e3e">Descuento total</td>
          <td class="right" style="color:#e53e3e">-S/ ${v.totalDescuentos.toFixed(2)}</td>
        </tr>` : ''}
        <tr class="total-row">
          <td colspan="3">Subtotal</td>
          <td class="right">S/ ${v.subtotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td colspan="3">IGV (18%)</td>
          <td class="right">S/ ${v.igv.toFixed(2)}</td>
        </tr>
        <tr>
          <td colspan="3"><strong>TOTAL</strong></td>
          <td class="right"><strong>S/ ${v.total.toFixed(2)}</strong></td>
        </tr>
      </table>
      <hr>
      <p class="center">¡Gracias por su compra!</p>
      <p class="center">Conserve su comprobante</p>
      </body></html>`;

    const ventana = window.open('', '_blank', 'width=380,height=600');
    ventana!.document.write(html);
    ventana!.document.close();
    ventana!.focus();
    setTimeout(() => ventana!.print(), 500);
  }

  // ── Historial ──
  cargarHistorial() {
    this.cargandoHistorial = true;
    this.ventasService.getAll().subscribe({
      next: (data) => {
        this.ventas            = data;
        this.ventasFiltradas   = data;
        this.cargandoHistorial = false;
        this.cdr.detectChanges();
      },
      error: () => { this.cargandoHistorial = false; this.cdr.detectChanges(); }
    });
  }

  filtrarHistorial() {
    const q = this.busquedaHistorial.toLowerCase();
    this.ventasFiltradas = this.ventas.filter(v =>
      v.numero?.toLowerCase().includes(q) ||
      v.cliente_nombre?.toLowerCase().includes(q) ||
      v.vendedor?.toLowerCase().includes(q)
    );
  }

  cambiarVista(v: 'carrito' | 'historial') {
    this.vista = v;
    if (v === 'historial') this.cargarHistorial();
  }

  verDetalle(venta: any) {
    this.ventasService.getById(venta.id).subscribe({
      next: (data) => {
        this.ventaDetalle   = data;
        this.mostrarDetalle = true;
        this.cdr.detectChanges();
      }
    });
  }
}


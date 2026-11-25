import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, exhaustMap, of, timer, Subscription } from 'rxjs';
import { RolService } from '../../core/services/rol.service';
import { environment } from '../../../environments/environment';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { coincideRepuesto } from '../../core/utils/busqueda-repuestos';

interface SugerenciaWeb {
  titulo: string;
  descripcion: string;
  url: string;
  dominio: string;
}

@Component({
  selector: 'app-repuestos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './repuestos.html',
  styleUrl: './repuestos.css'
})
export class RepuestosComponent implements OnInit {
  esAdmin = false;
  tipoCambio: { tasa: number; fecha: string } | null = null;
  repuestos: any[] = [];
  filtrados: any[] = [];
  busqueda   = '';
  cargando   = false;
  vista: 'tabla' | 'cuadricula' = 'tabla';
  sugerenciasWeb: SugerenciaWeb[] = [];
  buscandoWeb = false;
  consultaWeb = '';
  errorWeb = '';
  private peticionWeb?: Subscription;

  mostrarModal = false;
  guardando    = false;
  repuestoForm: any = {};
  modoEdicion  = false;
  imagenPreview: string | null = null;
  archivoImagen: File | null   = null;

  importando       = false;
  resultadoImport: any = null;

  verMas = false;

  mostrarModalEliminar = false;
  modoEliminar: 'individual' | 'grupal' | 'categoria' = 'individual';
  repuestoAEliminar: any = null;
  seleccionados: Set<number> = new Set();
  categoriaEliminar = '';
  previewEliminar: any = null;
  eliminando   = false;
  mensajeError = '';

  categorias: string[] = [];
  private url = `${environment.apiUrl}/repuestos`;
  urlBase     = environment.apiUrl.replace('/api', '');

  constructor(
    private http: HttpClient,
    public cdr: ChangeDetectorRef,
    public rol: RolService,
    private ngZone: NgZone
  ) {
    this.esAdmin = this.rol.isAdmin();
    timer(0, 15 * 60 * 1000).pipe(
      exhaustMap(() => this.http.get<{ tasa: number; fecha: string }>(`${this.url}/tipo-cambio`).pipe(
        catchError(() => of(null)),
      )),
      takeUntilDestroyed(),
    ).subscribe(tipoCambio => {
      this.tipoCambio = tipoCambio;
      this.cdr.markForCheck();
    });
  }

  precioMostrado(precio: number, moneda?: string): number {
    return moneda === 'USD' && this.tipoCambio ? precio * this.tipoCambio.tasa : precio;
  }

  simboloPrecio(moneda?: string): string {
    if (moneda === 'USD') return this.tipoCambio ? 'S/' : 'US$';
    return !moneda || moneda === 'PEN' ? 'S/' : moneda;
  }

  ngOnInit() { this.cargar(); }

  cargar() {
    Promise.resolve().then(() => {
      this.cargando = true;
      this.cdr.detectChanges();

      this.http.get<any[]>(this.url).subscribe({
        next: (data) => {
          this.ngZone.run(() => {
            this.repuestos  = data;
            this.filtrados  = data.filter(r => coincideRepuesto(r, this.busqueda));
            this.cargando   = false;
            this.categorias = [...new Set(data.map((r: any) => r.categoria).filter(Boolean))];
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
    });
  }

  filtrar() {
    this.peticionWeb?.unsubscribe();
    this.sugerenciasWeb = [];
    this.buscandoWeb = false;
    this.consultaWeb = '';
    this.errorWeb = '';
    this.filtrados = this.repuestos.filter(r => coincideRepuesto(r, this.busqueda));
    this.seleccionados.clear();
    this.cdr.detectChanges();
  }

  buscarEnInternet() {
    const q = this.busqueda.replace(/\s+/g, ' ').trim();
    if (this.buscandoWeb || q.length < 3 || q.length > 160) return;
    this.errorWeb = '';
    this.sugerenciasWeb = [];
    this.consultaWeb = q;
    this.buscandoWeb = true;
    this.peticionWeb = this.http.get<{ resultados: SugerenciaWeb[] }>(`${this.url}/sugerencias-web`, { params: { q } }).subscribe({
      next: respuesta => {
        if (this.consultaWeb !== q) return;
        this.sugerenciasWeb = respuesta.resultados;
        this.buscandoWeb = false;
        this.cdr.detectChanges();
      },
      error: err => {
        if (this.consultaWeb !== q) return;
        this.errorWeb = err.error?.mensaje || 'No se pudieron obtener sugerencias de internet. Intenta nuevamente.';
        this.buscandoWeb = false;
        this.cdr.detectChanges();
      },
    });
  }

  ngOnDestroy() { this.peticionWeb?.unsubscribe(); }

  // ── Imagen ──
  onImagenSeleccionada(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { alert('La imagen no puede superar 3MB'); return; }
    this.archivoImagen = file;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.ngZone.run(() => {
        this.imagenPreview = e.target.result;
        this.cdr.detectChanges();
      });
    };
    reader.readAsDataURL(file);
  }

  quitarImagen() {
    this.archivoImagen       = null;
    this.imagenPreview       = null;
    this.repuestoForm.imagen = null;
    this.cdr.detectChanges();
  }

  abrirSelectorImagen() {
    const input = document.getElementById('inputImagen') as HTMLInputElement;
    if (input) input.click();
  }

  getImagenUrl(imagen: string | null) {
    if (!imagen) return null;
    if (/^https:\/\//i.test(imagen)) return imagen;
    return `${this.urlBase}${imagen}`;
  }

  // ── Modal ──
  abrirModal() {
    this.ngZone.run(() => {
      this.mostrarModal = true;
      this.cdr.detectChanges();
    });
  }

  cerrarModal() {
    this.ngZone.run(() => {
      this.mostrarModal = false;
      this.cdr.detectChanges();
    });
  }

  // ── CRUD ──
  nuevo() {
    this.repuestoForm  = { stock: 0, stock_minimo: 5, moneda: 'PEN' };
    this.modoEdicion   = false;
    this.imagenPreview = null;
    this.archivoImagen = null;
    this.abrirModal();
  }

  editar(r: any) {
    this.repuestoForm  = { ...r };
    this.modoEdicion   = true;
    this.imagenPreview = r.imagen ? this.getImagenUrl(r.imagen) : null;
    this.archivoImagen = null;
    this.abrirModal();
  }

  guardar() {
    if (!this.repuestoForm.nombre) { alert('El nombre es obligatorio'); return; }
    this.guardando = true;

    const formData = new FormData();
    Object.keys(this.repuestoForm).forEach(key => {
      if (this.repuestoForm[key] !== null && this.repuestoForm[key] !== undefined) {
        formData.append(key, this.repuestoForm[key]);
      }
    });
    if (this.archivoImagen) formData.append('imagen', this.archivoImagen);
    if (this.repuestoForm.imagen) formData.append('imagen_actual', this.repuestoForm.imagen);

    const op = this.modoEdicion
      ? this.http.put(`${this.url}/${this.repuestoForm.id}`, formData)
      : this.http.post(this.url, formData);

    op.subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.guardando    = false;
          this.mostrarModal = false;
          this.cdr.detectChanges();
          // Esperar al siguiente ciclo para cargar
          Promise.resolve().then(() => this.cargar());
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.guardando = false;
          alert(err.error?.mensaje || 'Error al guardar');
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ── Selección grupal ──
  toggleSeleccion(id: number) {
    if (this.seleccionados.has(id)) this.seleccionados.delete(id);
    else this.seleccionados.add(id);
    this.cdr.detectChanges();
  }

  toggleTodos() {
    if (this.seleccionados.size === this.filtrados.length) {
      this.seleccionados.clear();
    } else {
      this.filtrados.forEach(r => this.seleccionados.add(r.id));
    }
    this.cdr.detectChanges();
  }

  get todosSeleccionados() {
    return this.seleccionados.size === this.filtrados.length && this.filtrados.length > 0;
  }

  // ── Eliminación ──
  abrirEliminarIndividual(r: any) {
    this.ngZone.run(() => {
      this.modoEliminar         = 'individual';
      this.repuestoAEliminar    = r;
      this.previewEliminar      = { total: 1, productos: [r] };
      this.mensajeError         = '';
      this.mostrarModalEliminar = true;
      this.cdr.detectChanges();
    });
  }

  abrirEliminarGrupal() {
    if (this.seleccionados.size === 0) { alert('Selecciona al menos un producto'); return; }
    this.modoEliminar = 'grupal';
    const ids = Array.from(this.seleccionados);
    this.http.post<any>(`${this.url}/preview-eliminar`, { ids }).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.previewEliminar      = data;
          this.mensajeError         = '';
          this.mostrarModalEliminar = true;
          this.cdr.detectChanges();
        });
      }
    });
  }

  abrirEliminarCategoria() {
    if (!this.categoriaEliminar) { alert('Selecciona una categoría'); return; }
    this.modoEliminar = 'categoria';
    this.http.post<any>(`${this.url}/preview-eliminar`, { categoria: this.categoriaEliminar }).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.previewEliminar      = data;
          this.mensajeError         = '';
          this.mostrarModalEliminar = true;
          this.cdr.detectChanges();
        });
      }
    });
  }

  cerrarModalEliminar() {
    this.ngZone.run(() => {
      this.mostrarModalEliminar = false;
      this.mensajeError         = '';
      this.cdr.detectChanges();
    });
  }

  confirmarEliminar() {
    this.eliminando   = true;
    this.mensajeError = '';
    let op;

    if (this.modoEliminar === 'individual') {
      op = this.http.delete<any>(`${this.url}/${this.repuestoAEliminar.id}`);
    } else if (this.modoEliminar === 'grupal') {
      op = this.http.post<any>(`${this.url}/eliminar-grupal`, { ids: Array.from(this.seleccionados) });
    } else {
      op = this.http.post<any>(`${this.url}/eliminar-grupal`, { categoria: this.categoriaEliminar });
    }

    op.subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          this.eliminando           = false;
          this.mostrarModalEliminar = false;
          this.seleccionados.clear();
          this.categoriaEliminar    = '';
          this.previewEliminar      = null;
          this.mensajeError         = '';
          if (res?.desactivado) {
            alert('ℹ️ ' + res.mensaje);
          }
          Promise.resolve().then(() => {
            this.cdr.detectChanges();
            this.cargar();
          });
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.eliminando   = false;
          this.mensajeError = err.error?.mensaje || 'Error al eliminar';
          Promise.resolve().then(() => this.cdr.detectChanges());
        });
      }
    });
  }

  // ── Importar Excel ──
  onArchivoSeleccionado(event: any) {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    if (!archivo.name.endsWith('.xlsx') && !archivo.name.endsWith('.xls')) {
      alert('Solo se permiten archivos Excel (.xlsx o .xls)');
      input.value = '';
      return;
    }
    this.importando      = true;
    this.resultadoImport = null;
    const formData = new FormData();
    formData.append('archivo', archivo);
    this.http.post<any>(`${this.url}/importar`, formData).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.importando      = false;
          this.resultadoImport = res;
          input.value          = '';
          this.cdr.detectChanges();
          this.cargar();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.importando = false;
          input.value     = '';
          alert(err.error?.mensaje || 'Error al importar');
          this.cdr.detectChanges();
        });
      }
    });
  }


  abrirSelectorArchivo() { document.getElementById('inputExcel')?.click(); }

  stockBajo(r: any) { return r.stock <= r.stock_minimo; }

  // ── Exportar inventario actual a Excel ──
exportarExcel() {
  const datos = this.repuestos.map(r => ({
    'NOMBRE':               r.nombre             || '',
    'UBICACION':            r.codigo             || '',
    'STOCK':                r.stock              ?? 0,
    'PRECIO UNIDAD':        r.precio_venta       ?? 0,
    'COSTO UNIDAD':         r.precio_compra      ?? 0,
    'UNIDAD DE MEDIDA':     r.unidad_medida      || '',
    'PRECIO POR MAYOR':     r.precio_mayor       ?? 0,
    'CANTIDAD POR MAYOR':   r.cantidad_mayor     ?? 0,
    'CODIGO BARRA':         r.codigo_barra       || '',
    'CATEGORIA':            r.categoria          || '',
    'MARCA':                r.marca              || '',
    'TIPO DE MONEDA':       r.moneda             || 'PEN',
    'MARCA OEM':            r.marca_oem          || '',
    'PROVEEDOR OEM':        r.proveedor_oem      || '',
    'CODIGO OEM':           r.codigo_oem         || '',
    'CODIGO ORIGINAL':      r.codigo_original    || '',
    'PRECIO DISTRIBUIDOR 1':r.precio_dist1       ?? 0,
    'PRECIO DISTRIBUIDOR 2':r.precio_dist2       ?? 0,
    'PRECIO DISTRIBUIDOR 3':r.precio_dist3       ?? 0,
  }));

  const hoja      = XLSX.utils.json_to_sheet(datos);
  const libro     = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Inventario');

  // Ancho de columnas automático
  const anchos = Object.keys(datos[0] || {}).map(k => ({ wch: Math.max(k.length, 14) }));
  hoja['!cols'] = anchos;

  const buffer = XLSX.write(libro, { bookType: 'xlsx', type: 'array' });
  const fecha  = new Date().toISOString().slice(0, 10);
  saveAs(new Blob([buffer], { type: 'application/octet-stream' }),
         `inventario_${fecha}.xlsx`);
}

// ── Descargar formato vacío para importación ──
descargarFormato() {
  const columnas = [{
    'NOMBRE':               '',
    'UBICACION':            '',
    'STOCK':                0,
    'PRECIO UNIDAD':        0,
    'COSTO UNIDAD':         0,
    'UNIDAD DE MEDIDA':     '',
    'PRECIO POR MAYOR':     0,
    'CANTIDAD POR MAYOR':   0,
    'CODIGO BARRA':         '',
    'CATEGORIA':            '',
    'MARCA':                '',
    'TIPO DE MONEDA':       'PEN',
    'MARCA OEM':            '',
    'PROVEEDOR OEM':        '',
    'CODIGO OEM':           '',
    'CODIGO ORIGINAL':      '',
    'PRECIO DISTRIBUIDOR 1':0,
    'PRECIO DISTRIBUIDOR 2':0,
    'PRECIO DISTRIBUIDOR 3':0,
  }];

  const hoja  = XLSX.utils.json_to_sheet(columnas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Productos');

  // Estilo de encabezado — ancho mínimo por columna
  const anchos = Object.keys(columnas[0]).map(k => ({ wch: Math.max(k.length + 2, 16) }));
  hoja['!cols'] = anchos;

  // Eliminar la fila de ejemplo dejando solo los encabezados
  // (xlsx no soporta filas vacías directamente, así que borramos los valores)
  const rango = XLSX.utils.decode_range(hoja['!ref'] || 'A1');
  for (let col = rango.s.c; col <= rango.e.c; col++) {
    const celda = XLSX.utils.encode_cell({ r: 1, c: col });
    delete hoja[celda];
  }
  hoja['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: rango.e.c } });

  const buffer = XLSX.write(libro, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buffer], { type: 'application/octet-stream' }),
         'formato_importacion_repuestos.xlsx');
}
}

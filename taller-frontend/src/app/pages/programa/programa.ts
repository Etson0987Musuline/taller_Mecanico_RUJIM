import { Component, OnInit, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, interval } from 'rxjs';
import { ProgramaService } from '../../core/services/programa.service';
@Component({
  selector: 'app-programa',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './programa.html',
  styleUrl: './programa.css',
})
export class ProgramaComponent implements OnInit {
  datos: any = null;
  stats: any = null;
  cargando = false;
  ocupado = false;
  error = '';
  mensaje = '';
  tab = 'resumen';
  detalle: any = null;
  filtros: any = { desde: '', hasta: '', cliente_id: '', vehiculo_id: '', tipo: '' };
  reporte: any = {
    orden_id: null,
    tipo_servicio: 'Mantenimiento preventivo',
    fecha_servicio: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }),
    km: 0,
    observaciones: '',
    fallas: '',
    recomendaciones: '',
  };
  componentes: any[] = [];
  motivos: Record<number, string> = {};
  regla: any = { servicios: 5, porcentaje: 10, vigencia_dias: 90, activo: true };
  tipo: any = { nombre: '', meses: 6, km: 5000, aviso_dias: 14, aviso_km: 500, activo: true };
  mantenimiento: any = {
    vehiculo_id: null,
    tipo_id: null,
    mecanico_id: null,
    ultima_fecha: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }),
    ultimo_km: 0,
    meses: 6,
    intervalo_km: 5000,
    recomendaciones: '',
  };
  recordatorio: any = {
    cliente_id: null,
    vehiculo_id: null,
    canal: 'interna',
    mensaje: '',
    programado_at: '',
  };
  kilometrajes: Record<number, number> = {};
  mesCalendario = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }).slice(0, 7);
  get diasCalendario() {
    if (!/^\d{4}-\d{2}$/.test(this.mesCalendario)) return [];
    const [year, month] = this.mesCalendario.split('-').map(Number),
      inicio = new Date(Date.UTC(year, month - 1, 1));
    const espacios = (inicio.getUTCDay() + 6) % 7,
      total = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return Array.from({ length: espacios + total }, (_, i) => {
      const dia = i - espacios + 1,
        fecha = `${this.mesCalendario}-${String(dia).padStart(2, '0')}`;
      return {
        dia: dia > 0 ? dia : null,
        eventos:
          dia > 0
            ? (this.datos?.mantenimientos || []).filter((m: any) => m.proxima_fecha === fecha)
            : [],
      };
    });
  }
  private destroyRef = inject(DestroyRef);
  constructor(
    private api: ProgramaService,
    private cdr: ChangeDetectorRef,
  ) {}
  get admin() {
    return this.datos?.usuario.rol === 'admin';
  }
  get cliente() {
    return this.datos?.usuario.rol === 'cliente';
  }
  get mecanico() {
    return this.datos?.usuario.rol === 'mecanico';
  }
  ngOnInit() {
    this.cargar();
    interval(30000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.ocupado || this.cargando || this.tab === 'preferencias') return;
        this.api.panel().subscribe({
          next: (d) => {
            this.datos = d;
            if (this.admin && this.tab === 'resumen') this.filtrarEstadisticas();
            this.cdr.detectChanges();
          },
          error: () => {},
        });
      });
  }
  cargar() {
    if (this.cargando) return;
    this.cargando = true;
    this.error = '';
    this.api.panel().subscribe({
      next: (d) => {
        const primera = !this.datos;
        this.datos = d;
        this.cargando = false;
        this.componentes = d.tipos
          .filter((t: any) => t.activo)
          .map((t: any) => ({
            tipo_id: t.id,
            nombre: t.nombre,
            meses: t.meses,
            intervalo_km: t.km,
            elegido: false,
          }));
        d.vehiculos.forEach((v: any) => (this.kilometrajes[v.id] = v.km_ingreso));
        if (primera && this.mecanico) this.tab = 'notificaciones';
        if (this.admin) this.filtrarEstadisticas();
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.error = e.error?.mensaje || 'No se pudo cargar el panel.';
        this.cargando = false;
        this.cdr.detectChanges();
      },
    });
  }
  ejecutar(peticion: Observable<any>, mensaje: string) {
    if (this.ocupado) return;
    this.ocupado = true;
    this.error = '';
    this.mensaje = '';
    peticion.subscribe({
      next: (r) => {
        this.ocupado = false;
        this.mensaje = mensaje;
        this.detalle = null;
        this.cargar();
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.ocupado = false;
        this.error = e.error?.mensaje || 'No se pudo guardar.';
        this.cdr.detectChanges();
      },
    });
  }
  filtrarEstadisticas() {
    this.api.estadisticas(this.filtros).subscribe({
      next: (s) => {
        this.stats = s;
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.error = e.error?.mensaje || 'No se pudieron cargar las estadísticas.';
        this.cdr.detectChanges();
      },
    });
  }
  placa(id: number) {
    return this.datos?.vehiculos.find((v: any) => v.id === id)?.placa || '—';
  }
  nombre(id: number) {
    const c = this.datos?.clientes.find((c: any) => c.id === id);
    return c ? `${c.nombre} ${c.apellido}` : '—';
  }
  responsable(id: number) {
    return this.datos?.personal.find((p: any) => p.id === id)?.nombre || 'Sin asignar';
  }
  estadoPremio(r: any) {
    return r.usada_at
      ? 'Utilizado'
      : Date.parse(r.vence_at) < Date.now()
        ? 'Vencido'
        : 'Disponible';
  }
  get acumulados() {
    return this.datos?.reportes.filter((r: any) => r.estado === 'aprobado').length || 0;
  }
  get proximaRegla() {
    return this.datos?.reglas
      .filter((r: any) => r.activo && r.servicios > this.acumulados)
      .sort((a: any, b: any) => a.servicios - b.servicios)[0];
  }
  get progreso() {
    return this.proximaRegla
      ? Math.min(100, (100 * this.acumulados) / this.proximaRegla.servicios)
      : 100;
  }
  get ordenesReportables() {
    return (
      this.datos?.ordenes.filter(
        (o: any) =>
          !['cancelado', 'entregado'].includes(o.estado) &&
          !this.datos.reportes.some((r: any) => r.orden_id === o.id && r.estado !== 'rechazado'),
      ) || []
    );
  }
  get historial() {
    return (
      this.datos?.reportes.filter(
        (r: any) =>
          (!this.filtros.cliente_id || r.cliente_id === this.filtros.cliente_id) &&
          (!this.filtros.vehiculo_id || r.vehiculo_id === this.filtros.vehiculo_id) &&
          (!this.filtros.desde || r.fecha_servicio >= this.filtros.desde) &&
          (!this.filtros.hasta || r.fecha_servicio <= this.filtros.hasta) &&
          (!this.filtros.tipo || r.tipo_servicio === this.filtros.tipo),
      ) || []
    );
  }
  get tiposServicio(): string[] {
    return [...new Set<string>((this.datos?.reportes || []).map((r: any) => r.tipo_servicio))];
  }
  get vehiculosRecordatorio() {
    return (
      this.datos?.vehiculos.filter((v: any) => v.cliente_id === this.recordatorio.cliente_id) || []
    );
  }
  seleccionarOrden() {
    const o = this.datos.ordenes.find((o: any) => o.id === this.reporte.orden_id);
    if (o)
      this.reporte.km = Math.max(
        o.km_actual || 0,
        this.datos.vehiculos.find((v: any) => v.id === o.vehiculo_id)?.km_ingreso || 0,
      );
  }
  reportar() {
    const { orden_id, ...b } = this.reporte;
    this.ejecutar(
      this.api.enviar(`ordenes/${orden_id}/reportar`, {
        ...b,
        mantenimientos: this.componentes
          .filter((c) => c.elegido)
          .map(({ tipo_id, meses, intervalo_km }) => ({ tipo_id, meses, intervalo_km })),
      }),
      'Servicio enviado para revisión. Todavía no suma a fidelización.',
    );
  }
  revisar(r: any, aprobar: boolean) {
    this.ejecutar(
      this.api.enviar(`reportes/${r.id}/revisar`, { aprobar, motivo: this.motivos[r.id] || '' }),
      aprobar
        ? 'Servicio aprobado. Historial, fidelización y mantenimientos actualizados.'
        : 'Reporte devuelto al mecánico para corregir.',
    );
  }
  guardarRegla() {
    this.ejecutar(
      this.api.enviar(
        this.regla.id ? `reglas/${this.regla.id}` : 'reglas',
        this.regla,
        this.regla.id ? 'put' : 'post',
      ),
      'Regla guardada. Las recompensas ya emitidas conservan sus condiciones.',
    );
  }
  editarRegla(r: any) {
    this.regla = { ...r };
  }
  editarTipo(t: any) {
    this.tipo = { ...t };
  }
  guardarTipo() {
    this.ejecutar(
      this.api.enviar(
        this.tipo.id ? `tipos/${this.tipo.id}` : 'tipos',
        this.tipo,
        this.tipo.id ? 'put' : 'post',
      ),
      'Intervalo guardado. Revisa las fichas individuales si necesitan ajustes.',
    );
  }
  elegirTipo() {
    const t = this.datos.tipos.find((t: any) => t.id === this.mantenimiento.tipo_id);
    if (t) {
      this.mantenimiento.meses = t.meses;
      this.mantenimiento.intervalo_km = t.km;
    }
  }
  editarMantenimiento(m: any) {
    this.mantenimiento = { ...m };
  }
  guardarMantenimiento() {
    this.ejecutar(
      this.api.enviar('mantenimientos', this.mantenimiento),
      'Ficha preventiva guardada.',
    );
  }
  actualizarKm(v: any) {
    this.ejecutar(
      this.api.enviar(`vehiculos/${v.id}/km`, { km: this.kilometrajes[v.id] }, 'patch'),
      'Kilometraje actualizado.',
    );
  }
  guardarPreferencias() {
    this.ejecutar(
      this.api.enviar('preferencias', this.datos.preferencias, 'patch'),
      'Preferencias guardadas.',
    );
  }
  guardarPerfil() {
    this.ejecutar(
      this.api.enviar('perfil', this.datos.clientes[0], 'patch'),
      'Datos de contacto guardados.',
    );
  }
  leerAlerta(a: any) {
    this.ejecutar(
      this.api.enviar('alertas/leida', { clave: a.clave }),
      'Alerta marcada como leída.',
    );
  }
  leerRecordatorio(r: any) {
    this.ejecutar(this.api.enviar(`recordatorios/${r.id}`, {}, 'patch'), 'Notificación leída.');
  }
  crearRecordatorio() {
    this.ejecutar(
      this.api.enviar('recordatorios', {
        ...this.recordatorio,
        programado_at: new Date(this.recordatorio.programado_at).toISOString(),
      }),
      'Recordatorio programado.',
    );
  }
  generarRecordatorios() {
    this.ejecutar(
      this.api.enviar('recordatorios/generar', {}),
      'Recordatorios preventivos generados sin repetir los existentes.',
    );
  }
  procesarRecordatorios() {
    this.ejecutar(
      this.api.enviar('recordatorios/procesar', {}),
      'Cola procesada. Revisa los estados y errores en la tabla.',
    );
  }
  cambiarRecordatorio(r: any, estado: string) {
    this.ejecutar(
      this.api.enviar(`recordatorios/${r.id}`, { estado }, 'patch'),
      'Recordatorio actualizado.',
    );
  }
}

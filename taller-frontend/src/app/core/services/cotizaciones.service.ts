import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface ConceptoCotizacion {
  tipo: 'mano_obra' | 'repuesto';
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  repuesto_id: number | null;
}
export interface Cotizacion {
  id: number; codigo: string; token?: string; descripcion: string; items: ConceptoCotizacion[];
  subtotal: number; igv: number; total: number; estado: string; vence_at: string;
  aprobado_por?: string; respondido_at?: string; orden_id?: number;
  vehiculos?: { placa: string; marca: string; modelo: string; clientes: { nombre: string; apellido: string } };
}
@Injectable({ providedIn: 'root' })
export class CotizacionesService {
  private url = `${environment.apiUrl}/cotizaciones`;
  constructor(private http: HttpClient) {}
  listar() { return this.http.get<Cotizacion[]>(this.url); }
  crear(data: { vehiculo_id: number | null; descripcion: string; items: ConceptoCotizacion[] }) { return this.http.post<Cotizacion>(this.url, data); }
  consultar(token: string) { return this.http.get<Cotizacion>(`${this.url}/publica/${token}`); }
  responder(token: string, decision: string, nombre: string) { return this.http.post<Cotizacion>(`${this.url}/publica/${token}/respuesta`, { decision, nombre, consentimiento: true }); }
  convertir(id: number) { return this.http.post<{id: number; codigo: string}>(`${this.url}/${id}/convertir`, {}); }
  anular(id: number) { return this.http.post(`${this.url}/${id}/anular`, {}); }
}

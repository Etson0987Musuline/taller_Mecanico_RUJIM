import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FacturasService {
  private url = `${environment.apiUrl}/facturas`;
  constructor(private http: HttpClient) {}

  getAll()               { return this.http.get<any[]>(this.url); }
  getByOrden(id: number) { return this.http.get<any>(`${this.url}/orden/${id}`); }
  create(data: any)      { return this.http.post<any>(this.url, data); }
  registrarPago(id: number, data: any) { return this.http.post(`${this.url}/${id}/pago`, data); }
  buscarOrdenes(q: string) { return this.http.get<any[]>(`${this.url}/buscar?q=${q}`); }
}

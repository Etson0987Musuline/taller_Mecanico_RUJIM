import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class VehiculosService {
  private url = `${environment.apiUrl}/vehiculos`;
  constructor(private http: HttpClient) {}

  getAll()                      { return this.http.get<any[]>(this.url); }
  getByCliente(id: number)      { return this.http.get<any[]>(`${this.url}/cliente/${id}`); }
  getHistorialByPlaca(placa: string) { return this.http.get<any>(`${this.url}/placa/${placa}/historial`); }
  create(data: any)             { return this.http.post(this.url, data); }
  update(id: number, data: any) { return this.http.put(`${this.url}/${id}`, data); }
}

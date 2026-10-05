import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OrdenesService {
  private url = `${environment.apiUrl}/ordenes`;
  constructor(private http: HttpClient) {}

  getAll()              { return this.http.get<any[]>(this.url); }
  getById(id: number)   { return this.http.get<any>(`${this.url}/${id}`); }
  create(data: any)     { return this.http.post<any>(this.url, data); }
  update(id: number, data: any) { return this.http.put(`${this.url}/${id}`, data); }
  eliminar(id: number)  { return this.http.delete(`${this.url}/${id}`); }
  getEstadisticas()     { return this.http.get<any>(`${this.url}/estadisticas`); }

  updateEstado(id: number, estado: string, comentario: string) {
    return this.http.patch(`${this.url}/${id}/estado`, { estado, comentario });
  }
  updateManoObra(id: number, mano_obra: number) {
    return this.http.patch(`${this.url}/${id}/mano-obra`, { mano_obra });
  }
  agregarServicio(id: number, data: any)     { return this.http.post(`${this.url}/${id}/servicios`, data); }
  eliminarServicio(id: number, osId: number) { return this.http.delete(`${this.url}/${id}/servicios/${osId}`); }
  agregarRepuesto(id: number, data: any)     { return this.http.post(`${this.url}/${id}/repuestos`, data); }
  eliminarRepuesto(id: number, orId: number) { return this.http.delete(`${this.url}/${id}/repuestos/${orId}`); }
}

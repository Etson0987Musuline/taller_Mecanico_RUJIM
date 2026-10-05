import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class VentasService {
  private url = `${environment.apiUrl}/ventas`;
  private urlRep = `${environment.apiUrl}/repuestos`;
  constructor(private http: HttpClient) {}

  getAll()               { return this.http.get<any[]>(this.url); }
  getById(id: number)    { return this.http.get<any>(`${this.url}/${id}`); }
  create(data: any)      { return this.http.post<any>(this.url, data); }
  buscarPorCodigo(codigo: string) {
    return this.http.get<any>(`${this.url}/buscar/${codigo}`);
  }
  buscarRepuesto(q: string) {
    return this.http.get<any[]>(`${this.urlRep}?q=${q}`);
  }
}

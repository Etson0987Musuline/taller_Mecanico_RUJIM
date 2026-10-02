import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class SeguimientoService {
  private url = 'http://localhost:3000/api/seguimiento';
  constructor(private http: HttpClient) {}

  consultarPorNombre(nombre: string) {
    return this.http.get<any[]>(`${this.url}/nombre/${nombre}`);
  }
  consultarPorDni(dni: string) {
    return this.http.get<any[]>(`${this.url}/dni/${dni}`);
  }
  consultarPorPlaca(placa: string) {
    return this.http.get<any[]>(`${this.url}/placa/${placa}`);
  }
}

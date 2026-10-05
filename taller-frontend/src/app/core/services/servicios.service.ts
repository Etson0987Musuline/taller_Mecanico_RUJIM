import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ServiciosService {
  private url = `${environment.apiUrl}/servicios`;
  constructor(private http: HttpClient) {}

  getAll()                        { return this.http.get<any[]>(this.url); }
  create(data: any)               { return this.http.post(this.url, data); }
  update(id: number, data: any)   { return this.http.put(`${this.url}/${id}`, data); }
  toggleActivo(id: number)        { return this.http.patch(`${this.url}/${id}/toggle`, {}); }
}

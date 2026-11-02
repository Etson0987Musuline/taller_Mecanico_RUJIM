import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
@Injectable({ providedIn: 'root' })
export class ProgramaService {
  private url = `${environment.apiUrl}/programa`;
  constructor(private http: HttpClient) {}
  panel() {
    return this.http.get<any>(`${this.url}/panel`);
  }
  estadisticas(filtros: any) {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filtros))
      if (v !== '' && v != null) params = params.set(k, String(v));
    return this.http.get<any>(`${this.url}/estadisticas`, { params });
  }
  enviar(path: string, body: any, method: 'post' | 'put' | 'patch' = 'post') {
    return this.http.request<any>(method.toUpperCase(), `${this.url}/${path}`, { body });
  }
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ServiciosService {
  private url = `${environment.apiUrl}/servicios`;
  private supabaseUrl = 'https://momjaytehlpzwxysfphg.supabase.co/rest/v1/servicios';
  private supabaseHeaders = new HttpHeaders({
    'apikey': 'sb_publishable_HjFNAYh0wM8imgHrcI7sGw_4zzSLs12',
    'Authorization': 'Bearer sb_publishable_HjFNAYh0wM8imgHrcI7sGw_4zzSLs12'
  });

  constructor(private http: HttpClient) {}

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(this.url).pipe(
      catchError(() => {
        return this.http.get<any[]>(`${this.supabaseUrl}?select=*&order=nombre.asc`, { headers: this.supabaseHeaders });
      })
    );
  }

  getPublicos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.url}/publicos`).pipe(
      catchError(() => {
        return this.http.get<any[]>(`${this.supabaseUrl}?activo=eq.true&order=nombre.asc`, { headers: this.supabaseHeaders });
      })
    );
  }

  create(data: any)               { return this.http.post(this.url, data); }
  update(id: number, data: any)   { return this.http.put(`${this.url}/${id}`, data); }

  toggleActivo(id: number, nuevoEstado?: boolean) {
    return this.http.patch(`${this.url}/${id}/toggle`, {}).pipe(
      catchError((err) => {
        if (typeof nuevoEstado === 'boolean') {
          return this.http.patch(`${this.supabaseUrl}?id=eq.${id}`, { activo: nuevoEstado }, {
            headers: this.supabaseHeaders.set('Prefer', 'return=minimal')
          });
        }
        throw err;
      })
    );
  }
}

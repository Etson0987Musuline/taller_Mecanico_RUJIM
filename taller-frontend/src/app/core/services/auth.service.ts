import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
@Injectable({ providedIn: 'root' })
export class AuthService {
  private usuario: any = null;
  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}
  login(email: string, password: string) {
    return this.http.post<any>(`${environment.apiUrl}/auth/login`, { email, password });
  }
  async restaurar() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    try {
      const res = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/auth/me`));
      this.usuario = res.usuario;
    } catch {
      this.usuario = null;
    }
  }
  guardarSesion(usuario: any) {
    this.usuario = usuario;
  }
  getUsuario() {
    return this.usuario;
  }
  getRol(): string {
    return this.usuario?.rol || '';
  }
  isLoggedIn() {
    return !!this.usuario;
  }
  isTokenValido() {
    return this.isLoggedIn();
  }
  destino() {
    return this.getRol() === 'admin'
      ? '/dashboard/home'
      : this.getRol() === 'cliente'
        ? '/dashboard/mi-cuenta'
        : '/dashboard/mecanico';
  }
  logout() {
    this.http.post(`${environment.apiUrl}/auth/logout`, {}).subscribe({
      next: () => {
        this.usuario = null;
        this.router.navigate(['/login']);
      },
      error: () =>
        window.alert('No se pudo cerrar la sesión en el servidor. Inténtalo nuevamente.'),
    });
  }
}

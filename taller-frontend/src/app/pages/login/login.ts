import { Component, ChangeDetectorRef,OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink,ActivatedRoute } from '@angular/router';
import {environment} from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent implements OnInit {
  googleUrl=`${environment.apiUrl}/auth/google?tipo=admin`;
  registroUrl=`${environment.apiUrl}/auth/google?tipo=cliente`;
  mostrarRegistro = false;
  telefono = '';
  autorizaWhatsapp = false;
  confirmandoRegistro = false;
  private readonly borradorKey = 'rujim-registro-contacto';
  async ngOnInit() {
    this.error = this.route.snapshot.queryParamMap.get('error') || '';
    if (this.route.snapshot.queryParamMap.get('google') !== 'ok') return;
    if (!this.auth.isLoggedIn()) {
      this.error = 'No se pudo restaurar la sesión. Intenta iniciar sesión nuevamente.';
      return;
    }
    if (this.auth.getRol() === 'cliente') {
      try {
        const raw = sessionStorage.getItem(this.borradorKey);
        if (raw) {
          const datos = JSON.parse(raw);
          this.telefono = typeof datos.telefono === 'string' ? datos.telefono : '';
          this.autorizaWhatsapp = datos.whatsapp === true;
          this.mostrarRegistro = true;
          this.confirmandoRegistro = true;
          await this.guardarContacto();
          return;
        }
      } catch {
        this.error = 'No se pudieron recuperar tus datos de contacto. Completa el teléfono para continuar.';
        this.mostrarRegistro = true;
        this.confirmandoRegistro = true;
        this.cdr.detectChanges();
        return;
      }
    } else this.limpiarRegistro();
    this.router.navigateByUrl(this.auth.destino());
  }

  async registrarCliente() {
    if (this.cargando) return;
    const phone = this.telefono.replace(/[\s()-]/g, '');
    if (!/^9\d{8}$/.test(phone) && !/^\+[1-9]\d{7,14}$/.test(phone)) {
      this.error = 'Ingresa un celular peruano de 9 dígitos o un número internacional con + y código de país.';
      return;
    }
    this.error = '';
    if (this.confirmandoRegistro) { await this.guardarContacto(); return; }
    try {
      sessionStorage.setItem(this.borradorKey, JSON.stringify({ telefono: phone, whatsapp: this.autorizaWhatsapp }));
      window.location.assign(this.registroUrl);
    } catch {
      this.error = 'Habilita el almacenamiento de esta pestaña para continuar con el registro.';
    }
  }

  private async guardarContacto() {
    this.cargando = true;
    try {
      await firstValueFrom(this.http.patch(`${environment.apiUrl}/programa/registro-contacto`, {
        telefono: this.telefono, whatsapp: this.autorizaWhatsapp,
      }));
      this.limpiarRegistro();
      this.router.navigateByUrl(this.auth.destino());
    } catch (err: any) {
      this.error = err.error?.mensaje || 'Tu cuenta está creada, pero no se guardó el teléfono. Intenta guardar nuevamente.';
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  limpiarRegistro() {
    try { sessionStorage.removeItem(this.borradorKey); } catch {}
  }
  email    = '';
  password = '';
  error    = '';
  cargando = false;

  constructor(
    private auth: AuthService,
    private http: HttpClient,
    private route:ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  login() {
    if (!this.email || !this.password) {
      this.error = 'Por favor completa todos los campos';
      return;
    }
    this.cargando = true;
    this.error    = '';

    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.cargando = false;
        this.auth.guardarSesion(res.usuario);
        this.cdr.detectChanges();
        // Redirigir según rol
        this.router.navigateByUrl(this.auth.destino());
      },
      error: (err) => {
        this.error    = err.error?.mensaje || 'No se pudo conectar con el taller';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }
}

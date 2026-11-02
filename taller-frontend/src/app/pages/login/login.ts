import { Component, ChangeDetectorRef,OnInit } from '@angular/core';
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
  googleUrl=`${environment.apiUrl}/auth/google`;
  ngOnInit(){
    this.error=this.route.snapshot.queryParamMap.get('error')||'';
    if(this.route.snapshot.queryParamMap.get('google')==='ok'){
      if(this.auth.isLoggedIn())this.router.navigateByUrl(this.auth.destino());
      else this.error='No se pudo restaurar la sesión. Revisa la configuración de cookies e inténtalo de nuevo.';
    }
  }
  email    = '';
  password = '';
  error    = '';
  cargando = false;

  constructor(
    private auth: AuthService,
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

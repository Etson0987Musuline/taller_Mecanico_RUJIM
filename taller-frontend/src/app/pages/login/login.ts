import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  email    = '';
  password = '';
  error    = '';
  cargando = false;

  constructor(
    private auth: AuthService,
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
        this.auth.guardarSesion(res.token, res.usuario);
        this.cdr.detectChanges();
        // Redirigir según rol
        if (res.usuario.rol === 'admin') {
          this.router.navigate(['/dashboard/home']);
        } else {
          this.router.navigate(['/dashboard/mecanico']);
        }
      },
      error: () => {
        this.error    = 'Credenciales incorrectas';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }
}

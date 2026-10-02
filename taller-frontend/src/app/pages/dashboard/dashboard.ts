import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { RolService } from '../../core/services/rol.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent {
  menuAbierto = true;
  usuario: any;

  menuAdmin = [
    { path: 'home',      label: 'Inicio',      icono: 'bi-speedometer2' },
    { path: 'clientes',  label: 'Clientes',    icono: 'bi-people-fill' },
    { path: 'vehiculos', label: 'Vehículos',   icono: 'bi-car-front-fill' },
    { path: 'ordenes',   label: 'Órdenes',     icono: 'bi-clipboard2-check-fill' },
    { path: 'servicios', label: 'Servicios',   icono: 'bi-tools' },
    { path: 'repuestos', label: 'Repuestos',   icono: 'bi-box-seam-fill' },
    { path: 'ventas',    label: 'Ventas',      icono: 'bi-cart-fill' },
    { path: 'facturas',  label: 'Facturación', icono: 'bi-receipt-cutoff' },
    { path: 'usuarios',  label: 'Usuarios',    icono: 'bi-person-gear' },
  ];

  menuMecanico = [
    { path: 'mecanico',  label: 'Mi panel',    icono: 'bi-wrench-adjustable-circle-fill' },
    { path: 'ordenes',   label: 'Órdenes',     icono: 'bi-clipboard2-check-fill' },
    { path: 'clientes',  label: 'Clientes',    icono: 'bi-people-fill' },
    { path: 'vehiculos', label: 'Vehículos',   icono: 'bi-car-front-fill' },
    { path: 'servicios', label: 'Servicios',   icono: 'bi-tools' },
    { path: 'repuestos', label: 'Repuestos',   icono: 'bi-box-seam-fill' },
  ];

  constructor(
    private auth: AuthService,
    public rol: RolService,
    private router: Router
  ) {
    this.usuario = this.auth.getUsuario();
  }

  get menuItems() {
    return this.rol.isAdmin() ? this.menuAdmin : this.menuMecanico;
  }

  logout() { this.auth.logout(); }
}

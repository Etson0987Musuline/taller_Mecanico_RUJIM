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
    {path:'programa',label:'Servicios y fidelidad',icono:'bi-heart-fill'},
    { path: 'cotizaciones', label: 'Cotizaciones', icono: 'bi-file-earmark-text' },
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
    {path:'programa',label:'Mantenimiento y alertas',icono:'bi-bell-fill'},
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
    return this.rol.isAdmin() ? this.menuAdmin : this.rol.getRol()==='cliente' ? [{path:'mi-cuenta',label:'Mi cuenta y vehículos',icono:'bi-person-circle'}] : this.menuMecanico;
  }

  logout() { this.auth.logout(); }
}

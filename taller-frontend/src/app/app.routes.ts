import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import {panelGuard} from './core/guards/panel.guard';

export const routes: Routes = [
  { path: 'cotizacion/:token', loadComponent: () => import('./pages/cotizaciones/cotizacion-publica').then(m => m.CotizacionPublicaComponent) },
  { path: '', redirectTo: 'consulta', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'consulta',
    loadComponent: () => import('./pages/consulta-publica/consulta-publica').then(m => m.ConsultaPublicaComponent)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    canActivateChild:[panelGuard],
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.DashboardComponent),
    children: [
      {path:'programa',loadComponent:()=>import('./pages/programa/programa').then(m=>m.ProgramaComponent)},
      {path:'mi-cuenta',loadComponent:()=>import('./pages/programa/programa').then(m=>m.ProgramaComponent)},
      { path: 'cotizaciones', canActivate: [adminGuard], loadComponent: () => import('./pages/cotizaciones/cotizaciones').then(m => m.CotizacionesComponent) },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () => import('./pages/dashboard/home/home').then(m => m.HomeComponent)
      },
      {
        path: 'mecanico',
        loadComponent: () => import('./pages/mecanico/mecanico').then(m => m.MecanicoComponent)
      },
      {
        path: 'clientes',
        loadComponent: () => import('./pages/clientes/clientes').then(m => m.ClientesComponent)
      },
      {
        path: 'vehiculos',
        loadComponent: () => import('./pages/vehiculos/vehiculos').then(m => m.VehiculosComponent)
      },
      {
        path: 'ordenes',
        loadComponent: () => import('./pages/ordenes/ordenes').then(m => m.OrdenesComponent)
      },
      {
        path: 'servicios',
        loadComponent: () => import('./pages/servicios/servicios').then(m => m.ServiciosComponent)
      },
      {
        path: 'repuestos',
        loadComponent: () => import('./pages/repuestos/repuestos').then(m => m.RepuestosComponent)
      },
      {
        path: 'ventas',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/ventas/ventas').then(m => m.VentasComponent)
      },
      {
        path: 'facturas',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/facturas/facturas').then(m => m.FacturasComponent)
      },
      {
        path: 'usuarios',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/usuarios/usuarios').then(m => m.UsuariosComponent)
      },
    ]
  },
  { path: '**', redirectTo: 'consulta' }
];

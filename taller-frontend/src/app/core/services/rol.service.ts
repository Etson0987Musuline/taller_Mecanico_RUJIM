import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class RolService {
  constructor(private auth: AuthService) {}

  getRol(): string { return this.auth.getRol(); }
  isAdmin(): boolean { return this.getRol() === 'admin'; }
  isMecanico(): boolean { return this.getRol() === 'mecanico'; }

  // Módulos por rol
  puedeVerModulo(modulo: string): boolean {
    if(this.getRol()==='cliente')return modulo==='mi-cuenta';
    if (this.isAdmin()) return true;
    const modulosMecanico = ['mecanico', 'ordenes', 'clientes', 'vehiculos', 'servicios', 'repuestos'];
    return modulosMecanico.includes(modulo);
  }

  // Acciones por módulo y rol
  puedeEliminarOrden(): boolean    { return this.isAdmin(); }
  puedeEditarOrdenBasico(): boolean { return this.isAdmin(); }
  puedeCrearCliente(): boolean     { return this.isAdmin(); }
  puedeEditarCliente(): boolean    { return this.isAdmin(); }
  puedeCrearVehiculo(): boolean    { return this.isAdmin(); }
  puedeEditarVehiculo(): boolean   { return this.isAdmin(); }
  puedeGestionarUsuarios(): boolean { return this.isAdmin(); }
  puedeVerVentas(): boolean        { return this.isAdmin(); }
  puedeVerFacturacion(): boolean   { return this.isAdmin(); }
  puedeGestionarRepuestos(): boolean { return this.isAdmin(); }
  puedeGestionarServicios(): boolean { return this.isAdmin(); }
}

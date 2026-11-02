import { ApplicationConfig, provideZonelessChangeDetection,provideAppInitializer,inject } from '@angular/core';
import {AuthService} from './core/services/auth.service';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(()=>inject(AuthService).restaurar()),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};

import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Rutas que NO necesitan token
  const rutasPublicas = [
    '/auth/login',
    '/seguimiento/',
    '/consulta-doc/'
  ];

  const esPublica = rutasPublicas.some(r => req.url.includes(r));
  if (esPublica) return next(req);

  const token = localStorage.getItem('token');
  if (token) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(authReq);
  }
  return next(req);
};

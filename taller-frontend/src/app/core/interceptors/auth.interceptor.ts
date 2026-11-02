import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = environment.apiUrl;
  const propia = req.url === api || req.url.startsWith(api + '/');
  return next(propia ? req.clone({ withCredentials: true }) : req);
};

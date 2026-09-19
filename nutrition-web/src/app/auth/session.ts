import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, tap, throwError } from 'rxjs';

export interface Nutritionist { id: string; name: string; email: string }
export interface LoginResponse { accessToken: string; tokenType: string; expiresAt: string; nutritionist: Nutritionist }

// sessionStorage (cleared when the tab closes), never localStorage.
const STORAGE_KEY = 'nutrition.accessToken';

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly token = signal<string | null>(sessionStorage.getItem(STORAGE_KEY));
  readonly nutritionist = signal<Nutritionist | null>(null);

  authenticate(mode: 'login' | 'register', body: { email: string; password: string; name?: string }) {
    return this.http.post<LoginResponse>(`/api/auth/${mode}`, body).pipe(tap(response => {
      sessionStorage.setItem(STORAGE_KEY, response.accessToken);
      this.token.set(response.accessToken);
      this.nutritionist.set(response.nutritionist);
    }));
  }

  loadProfile() {
    return this.http.get<Nutritionist>('/api/auth/me').pipe(tap(profile => this.nutritionist.set(profile)));
  }

  /** The token is only discarded on the client; the API has no revocation. */
  logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    this.token.set(null);
    this.nutritionist.set(null);
    void this.router.navigateByUrl('/login');
  }
}

export const authenticated: CanActivateFn = () => {
  return inject(Session).token() ? true : inject(Router).createUrlTree(['/login']);
};

const PROTECTED_PATHS = ['/api/auth/me', '/api/patients', '/api/record-fields', '/api/record-templates', '/api/consultations'];

/** Only the protected API paths of this origin receive the token; calculator endpoints stay public. */
export function protectedApi(url: string): boolean {
  const parsed = new URL(url, window.location.origin);
  return parsed.origin === window.location.origin && PROTECTED_PATHS.some(path =>
    parsed.pathname === path || parsed.pathname.startsWith(path + '/'));
}

export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  if (!protectedApi(request.url)) return next(request);
  const session = inject(Session);
  const token = session.token();
  const authorized = token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
  return next(authorized).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) session.logout();
      return throwError(() => error);
    }),
  );
};

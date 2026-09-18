import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { sessionInterceptor } from './app/auth/session';
import { PlanningReuseStrategy } from './app/planning-reuse';
import { routes } from './app/routes';
import { Shell } from './app/shell';

registerLocaleData(localePt);
bootstrapApplication(Shell, {
  providers: [
    provideHttpClient(withInterceptors([sessionInterceptor])),
    provideRouter(routes),
    { provide: RouteReuseStrategy, useClass: PlanningReuseStrategy },
    provideZonelessChangeDetection(),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
  ],
}).catch(console.error);

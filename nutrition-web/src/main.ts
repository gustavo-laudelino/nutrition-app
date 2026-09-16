import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { provideHttpClient } from '@angular/common/http';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app';

registerLocaleData(localePt);
bootstrapApplication(AppComponent, {
  providers: [provideHttpClient(), provideZonelessChangeDetection(), { provide: LOCALE_ID, useValue: 'pt-BR' }],
}).catch(console.error);

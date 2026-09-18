import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { apiErrors } from '../api-errors';
import { PatientPage, PatientsApi } from './patients-api';

interface ListQuery { name: string; archived: boolean; page: number }

@Component({
  selector: 'app-patient-list',
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './patient-list.html',
  styleUrl: '../account.css',
})
export class PatientList {
  private readonly api = inject(PatientsApi);
  private readonly destroy = inject(DestroyRef);
  private readonly query = new BehaviorSubject<ListQuery>({ name: '', archived: false, page: 0 });
  readonly search = new FormControl('', { nonNullable: true });
  readonly archived = signal(false);
  readonly result = signal<PatientPage | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    // Search queries on each letter after a short pause; a new query cancels the previous request.
    this.search.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroy))
      .subscribe(name => this.query.next({ ...this.query.value, name, page: 0 }));
    this.query
      .pipe(switchMap(query => this.load(query)), takeUntilDestroyed(this.destroy))
      .subscribe(result => {
        this.result.set(result);
        this.loading.set(false);
      });
  }

  setArchived(archived: boolean) {
    this.archived.set(archived);
    this.query.next({ ...this.query.value, archived, page: 0 });
  }

  goTo(page: number) {
    if (page >= 0) this.query.next({ ...this.query.value, page });
  }

  private load(query: ListQuery) {
    this.loading.set(true);
    this.error.set('');
    this.result.set(null);
    return this.api.list(query.name, query.archived, query.page).pipe(catchError(error => {
      this.error.set(apiErrors(error).detail);
      return of(null);
    }));
  }
}

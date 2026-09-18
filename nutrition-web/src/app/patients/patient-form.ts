import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { apiErrors, ApiErrors, NO_ERRORS } from '../api-errors';
import { Patient, PatientInput, PatientsApi } from './patients-api';

const CONFLICT_MESSAGE = 'O paciente foi alterado em outra sessão. Recarregue.';

/** Create (/pacientes/novo) or edit (/pacientes/:id). Requests are sent only on save; validation is in the API. */
@Component({
  selector: 'app-patient-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './patient-form.html',
  styleUrl: '../account.css',
})
export class PatientForm {
  private readonly api = inject(PatientsApi);
  private readonly router = inject(Router);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  readonly patient = signal<Patient | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly confirmation = signal(false);
  readonly saved = signal(false);
  // After a 409 saving stays blocked until the patient is reloaded with its current version.
  readonly conflict = signal(false);
  readonly errors = signal<ApiErrors>(NO_ERRORS);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    birthDate: new FormControl<string | null>(null),
    sex: new FormControl<PatientInput['sex']>(null),
    phone: new FormControl<string | null>(null),
    email: new FormControl<string | null>(null),
    notes: new FormControl<string | null>(null),
    weightKg: new FormControl<number | null>(null),
    heightCm: new FormControl<number | null>(null),
    driActivity: new FormControl<PatientInput['driActivity']>(null),
    measuredAt: new FormControl<string | null>(null),
  });

  constructor() {
    if (this.id) this.load();
  }

  load() {
    if (!this.id || this.loading()) return;
    this.loading.set(true);
    this.errors.set(NO_ERRORS);
    this.api.get(this.id).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: patient => {
        this.setPatient(patient);
        this.conflict.set(false);
        this.saved.set(false);
      },
      error: error => this.errors.set(apiErrors(error)),
    });
  }

  save() {
    if (this.busy() || this.loading() || this.conflict() || (this.id && !this.patient())) return;
    this.busy.set(true);
    this.saved.set(false);
    this.errors.set(NO_ERRORS);
    const value = this.form.getRawValue();
    // Empty inputs are sent as null ("not informed").
    const input: PatientInput = {
      ...value,
      birthDate: value.birthDate || null,
      measuredAt: value.measuredAt || null,
      phone: value.phone || null,
      email: value.email || null,
      notes: value.notes || null,
    };
    if (this.id) input.version = this.patient()!.version;
    this.api.save(this.id, input).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: patient => {
        this.setPatient(patient);
        this.saved.set(true);
        if (!this.id) void this.router.navigateByUrl(`/pacientes/${patient.id}`);
      },
      error: error => this.failure(error),
    });
  }

  /** Archive or reactivate after confirmation; unsaved form changes are discarded. */
  changeArchive() {
    const patient = this.patient();
    if (!patient || !this.confirmation() || this.busy()) return;
    this.busy.set(true);
    this.errors.set(NO_ERRORS);
    this.saved.set(false);
    this.api.archive(patient.id, !patient.archived).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: updated => {
        this.setPatient(updated);
        this.confirmation.set(false);
        this.saved.set(true);
      },
      error: error => {
        this.confirmation.set(false);
        this.failure(error);
      },
    });
  }

  private setPatient(patient: Patient) {
    this.patient.set(patient);
    this.form.reset(patient);
  }

  private failure(error: HttpErrorResponse) {
    if (error.status === 409) {
      this.conflict.set(true);
      this.errors.set({ detail: CONFLICT_MESSAGE, fields: {} });
    } else {
      this.errors.set(apiErrors(error));
    }
  }
}

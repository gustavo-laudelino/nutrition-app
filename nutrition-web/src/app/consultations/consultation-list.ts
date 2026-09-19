import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { apiErrors, ApiErrors, NO_ERRORS } from '../api-errors';
import { Patient, PatientsApi } from '../patients/patients-api';
import { RecordsApi, RecordTemplateSummary } from '../records/records-api';
import { ConsultationsApi, ConsultationSummary, today } from './consultations-api';

/** A patient's consultations; a new one starts from a record template (the default one preselected). */
@Component({
  selector: 'app-consultation-list',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './consultation-list.html',
  styleUrls: ['../account.css', './consultations.css'],
})
export class ConsultationList implements OnInit {
  private readonly api = inject(ConsultationsApi);
  private readonly patients = inject(PatientsApi);
  private readonly records = inject(RecordsApi);
  private readonly router = inject(Router);
  readonly patientId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  readonly patient = signal<Patient | null>(null);
  readonly consultations = signal<ConsultationSummary[] | null>(null);
  readonly templates = signal<RecordTemplateSummary[]>([]);
  readonly error = signal('');
  readonly creating = signal(false);
  readonly busy = signal(false);
  readonly createErrors = signal<ApiErrors>(NO_ERRORS);
  readonly pendingDelete = signal<string | null>(null);
  readonly today = today();
  templateId = '';
  date = today();

  ngOnInit() {
    forkJoin({ patient: this.patients.get(this.patientId), templates: this.records.list() }).subscribe({
      next: ({ patient, templates }) => {
        this.patient.set(patient);
        this.templates.set(templates);
        this.load();
      },
      error: (error: HttpErrorResponse) => this.error.set(apiErrors(error).detail),
    });
  }

  load() {
    this.api.list(this.patientId).subscribe({
      next: consultations => this.consultations.set(consultations),
      error: (error: HttpErrorResponse) => this.error.set(apiErrors(error).detail),
    });
  }

  openCreate() {
    this.templateId = (this.templates().find(template => template.isDefault) ?? this.templates()[0])?.id ?? '';
    this.date = today();
    this.createErrors.set(NO_ERRORS);
    this.creating.set(true);
  }

  create() {
    this.busy.set(true);
    this.api.create(this.patientId, this.templateId, this.date).subscribe({
      next: consultation => void this.router.navigate(['/pacientes', this.patientId, 'consultas', consultation.id]),
      error: (error: HttpErrorResponse) => {
        this.busy.set(false);
        this.createErrors.set(apiErrors(error));
      },
    });
  }

  remove(id: string) {
    this.pendingDelete.set(null);
    this.busy.set(true);
    this.api.delete(id).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: (error: HttpErrorResponse) => { this.busy.set(false); this.error.set(apiErrors(error).detail); },
    });
  }
}

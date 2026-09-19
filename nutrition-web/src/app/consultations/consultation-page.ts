import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { apiErrors, ApiErrors, NO_ERRORS } from '../api-errors';
import { Patient, PatientsApi } from '../patients/patients-api';
import { FieldControl } from '../records/field-control';
import { Answers, Consultation, ConsultationsApi, today } from './consultations-api';

/**
 * Filling a consultation: the sections copied from the template as tabs, the fields in the template's widths.
 * A draft is saved explicitly; completing syncs weight/height with the patient (backend); a completed one is
 * read-only until reopened.
 */
@Component({
  selector: 'app-consultation-page',
  imports: [DatePipe, FieldControl, RouterLink],
  templateUrl: './consultation-page.html',
  styleUrls: ['../account.css', './consultations.css'],
  host: { '(window:beforeunload)': 'warnBeforeUnload($event)' },
})
export class ConsultationPage implements OnInit {
  private readonly api = inject(ConsultationsApi);
  private readonly patients = inject(PatientsApi);
  private readonly params = inject(ActivatedRoute).snapshot.paramMap;
  readonly patientId = this.params.get('id') ?? '';
  private readonly id = this.params.get('consultationId') ?? '';
  readonly today = today();

  readonly patient = signal<Patient | null>(null);
  readonly consultation = signal<Consultation | null>(null);
  readonly answers = signal<Answers>({});
  readonly date = signal('');
  private readonly saved = signal('');
  readonly activeIndex = signal(0);
  readonly busy = signal(false);
  readonly loadError = signal('');
  readonly errors = signal<ApiErrors>(NO_ERRORS);
  readonly errorCode = signal<string | null>(null);
  readonly conflict = signal(false);
  readonly notice = signal('');

  readonly completed = computed(() => this.consultation()?.status === 'COMPLETED');
  readonly dirty = computed(() => !!this.consultation() && this.snapshot() !== this.saved());
  readonly section = computed(() => this.consultation()?.sections[this.activeIndex()] ?? null);
  readonly errorMessages = computed(() => Object.values(this.errors().fields));

  ngOnInit() {
    forkJoin({ patient: this.patients.get(this.patientId), consultation: this.api.get(this.id) }).subscribe({
      next: ({ patient, consultation }) => {
        this.patient.set(patient);
        this.apply(consultation);
      },
      error: (error: HttpErrorResponse) => this.loadError.set(apiErrors(error).detail),
    });
  }

  private apply(consultation: Consultation) {
    this.consultation.set(consultation);
    this.answers.set({ ...consultation.answers });
    this.date.set(consultation.date);
    this.saved.set(this.snapshot());
  }

  private snapshot() {
    return JSON.stringify({ date: this.date(), answers: this.answers() });
  }

  answered(code: string) {
    const value = this.answers()[code];
    return value !== null && value !== undefined && value !== '';
  }

  answeredCount(sectionIndex: number) {
    return this.consultation()?.sections[sectionIndex].fields.filter(item => this.answered(item.field.code)).length ?? 0;
  }

  setAnswer(code: string, value: unknown) {
    this.answers.update(answers => ({ ...answers, [code]: value }));
    if (this.errorCode() === code) this.errorCode.set(null);
  }

  save() {
    const consultation = this.consultation();
    if (!consultation || this.busy()) return;
    this.start();
    this.api.save(consultation.id, this.date(), consultation.version, this.answers()).subscribe({
      next: saved => { this.apply(saved); this.busy.set(false); this.notice.set('Rascunho salvo.'); },
      error: error => this.fail(error),
    });
  }

  /** Unsaved answers are saved first, so what is completed is what is on screen. */
  complete() {
    const consultation = this.consultation();
    if (!consultation || this.busy()) return;
    this.start();
    const saved = this.dirty() ? this.api.save(consultation.id, this.date(), consultation.version, this.answers()) : of(consultation);
    saved.pipe(switchMap(current => this.api.complete(current.id, current.version))).subscribe({
      next: ({ consultation: done, patientUpdated }) => {
        this.apply(done);
        this.busy.set(false);
        this.notice.set(patientUpdated ? 'Consulta concluída. Peso e altura atualizados no cadastro do paciente.' : 'Consulta concluída.');
      },
      error: error => this.fail(error),
    });
  }

  reopen() {
    const consultation = this.consultation();
    if (!consultation || this.busy()) return;
    this.start();
    this.api.reopen(consultation.id, consultation.version).subscribe({
      next: reopened => { this.apply(reopened); this.busy.set(false); this.notice.set('Consulta reaberta para edição.'); },
      error: error => this.fail(error),
    });
  }

  /** After a 409: discards the edits on screen and loads the saved consultation. */
  reload() {
    this.start();
    this.api.get(this.id).subscribe({
      next: consultation => { this.apply(consultation); this.busy.set(false); },
      error: error => this.fail(error),
    });
  }

  warnBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.dirty()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  private start() {
    this.busy.set(true);
    this.notice.set('');
    this.conflict.set(false);
    this.errors.set(NO_ERRORS);
    this.errorCode.set(null);
  }

  /** A field error (answers.<code>…) opens its section and marks the field. */
  private fail(error: HttpErrorResponse) {
    this.busy.set(false);
    if (error.status === 409) { this.conflict.set(true); return; }
    const errors = apiErrors(error);
    this.errors.set(errors);
    const code = Object.keys(errors.fields).map(path => path.match(/^answers\.([a-z0-9_]+)/)?.[1]).find(Boolean);
    const index = this.consultation()?.sections.findIndex(section => section.fields.some(item => item.field.code === code)) ?? -1;
    if (code && index >= 0) {
      this.activeIndex.set(index);
      this.errorCode.set(code);
    }
  }
}

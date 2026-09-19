import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FieldWidth, RecordField } from '../records/records-api';

export type ConsultationStatus = 'DRAFT' | 'COMPLETED';
/** Answer by field code; the shape depends on the field type (see FieldControl). */
export type Answers = Record<string, unknown>;

/** Section copied from the template when the consultation was opened, with each field's definition. */
export interface ConsultationSection { name: string; fields: { width: FieldWidth; textRows: number | null; field: RecordField }[] }

interface ConsultationDates { firstCompletedAt: string | null; completedAt: string | null; reopenedAt: string | null; updatedAt: string }
export interface ConsultationSummary extends ConsultationDates { id: string; date: string; status: ConsultationStatus; templateName: string }
export interface Consultation extends ConsultationSummary {
  patientId: string; sections: ConsultationSection[]; answers: Answers; version: number;
}

@Injectable({ providedIn: 'root' })
export class ConsultationsApi {
  private readonly http = inject(HttpClient);

  list(patientId: string) {
    return this.http.get<ConsultationSummary[]>(`/api/patients/${patientId}/consultations`);
  }

  create(patientId: string, templateId: string, date: string) {
    return this.http.post<Consultation>(`/api/patients/${patientId}/consultations`, { templateId, date });
  }

  get(id: string) {
    return this.http.get<Consultation>(`/api/consultations/${id}`);
  }

  save(id: string, date: string, version: number, answers: Answers) {
    return this.http.put<Consultation>(`/api/consultations/${id}`, { date, version, answers });
  }

  complete(id: string, version: number) {
    return this.http.post<{ consultation: Consultation; patientUpdated: boolean }>(`/api/consultations/${id}/complete`, { version });
  }

  reopen(id: string, version: number) {
    return this.http.post<Consultation>(`/api/consultations/${id}/reopen`, { version });
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/consultations/${id}`);
  }
}

/** Today in the browser's time zone, as the API date format. */
export function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

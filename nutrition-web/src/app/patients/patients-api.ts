import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface PatientInput {
  name: string;
  birthDate: string | null;
  sex: 'FEMALE' | 'MALE' | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  weightKg: number | null;
  heightCm: number | null;
  driActivity: 'INACTIVE' | 'LOW_ACTIVE' | 'ACTIVE' | 'VERY_ACTIVE' | null;
  measuredAt: string | null;
  // Required on update (optimistic locking); absent on creation.
  version?: number;
}

export interface Patient extends PatientInput {
  id: string;
  ageYears: number | null;
  archived: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PatientPage { content: Patient[]; page: number; size: number; totalElements: number; totalPages: number }

@Injectable({ providedIn: 'root' })
export class PatientsApi {
  private readonly http = inject(HttpClient);

  list(name: string, archived: boolean, page: number) {
    return this.http.get<PatientPage>('/api/patients', { params: { name, archived, page, size: 20 } });
  }

  get(id: string) {
    return this.http.get<Patient>(`/api/patients/${id}`);
  }

  save(id: string | null, input: PatientInput) {
    return id ? this.http.put<Patient>(`/api/patients/${id}`, input) : this.http.post<Patient>('/api/patients', input);
  }

  archive(id: string, archived: boolean) {
    return this.http.post<Patient>(`/api/patients/${id}/${archived ? 'archive' : 'unarchive'}`, {});
  }
}

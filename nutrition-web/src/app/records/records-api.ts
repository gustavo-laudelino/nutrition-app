import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type FieldType = 'SHORT_TEXT' | 'LONG_TEXT' | 'NUMBER' | 'DATE' | 'YES_NO_DETAIL' | 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'SCALE' | 'TABLE';
export type FieldWidth = 'THIRD' | 'HALF' | 'TWO_THIRDS' | 'FULL';
export interface Choice { code: string; label: string }

/** Catalog field: only the settings of its type are present. */
export interface RecordField {
  code: string; label: string; help?: string; type: FieldType;
  maxLength?: number; unit?: string; min?: number; max?: number; decimals?: number;
  detailLabel?: string; options?: Choice[]; allowOther?: boolean;
  minLabel?: string; maxLabel?: string; columns?: Choice[];
  sync?: 'PATIENT_WEIGHT' | 'PATIENT_HEIGHT';
}
export interface RecordFieldCategory { code: string; name: string; fields: RecordField[] }

export interface TemplateField { code: string; width: FieldWidth; textRows: number | null }
export interface TemplateSection { name: string; fields: TemplateField[] }
export interface RecordTemplate {
  id: string; name: string; isDefault: boolean; version: number; updatedAt: string; sections: TemplateSection[];
}
export interface RecordTemplateSummary {
  id: string; name: string; isDefault: boolean; sectionCount: number; fieldCount: number; updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class RecordsApi {
  private readonly http = inject(HttpClient);

  fields() {
    return this.http.get<{ categories: RecordFieldCategory[] }>('/api/record-fields');
  }

  list() {
    return this.http.get<RecordTemplateSummary[]>('/api/record-templates');
  }

  get(id: string) {
    return this.http.get<RecordTemplate>(`/api/record-templates/${id}`);
  }

  create(name: string, source: 'BLANK' | 'STARTER') {
    return this.http.post<RecordTemplate>('/api/record-templates', { name, source });
  }

  save(id: string, name: string, version: number, sections: TemplateSection[]) {
    return this.http.put<RecordTemplate>(`/api/record-templates/${id}`, { name, version, sections });
  }

  duplicate(id: string) {
    return this.http.post<RecordTemplate>(`/api/record-templates/${id}/duplicate`, {});
  }

  makeDefault(id: string) {
    return this.http.post<RecordTemplate>(`/api/record-templates/${id}/default`, {});
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/record-templates/${id}`);
  }
}

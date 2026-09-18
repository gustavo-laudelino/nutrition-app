import { HttpErrorResponse } from '@angular/common/http';

/** ProblemDetail from the API: general message plus messages by field name. */
export interface ApiErrors { detail: string; fields: Record<string, string> }

export const NO_ERRORS: ApiErrors = { detail: '', fields: {} };

export function apiErrors(error: HttpErrorResponse): ApiErrors {
  const fields: Record<string, string> = {};
  for (const item of error.error?.errors ?? []) {
    if (item.field) fields[item.field] = item.message;
  }
  return { detail: error.error?.detail ?? 'Não foi possível concluir a solicitação. Tente novamente.', fields };
}

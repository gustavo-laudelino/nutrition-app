import { Component, computed, input, model } from '@angular/core';
import { RecordField } from './records-api';

/** Answer shapes by field type, as the API stores them (see docs/features/prontuario-consultas.md). */
export interface YesNoAnswer { answer?: boolean; detail?: string }
export interface SingleAnswer { option?: string; other?: string }
export interface MultiAnswer { options?: string[]; other?: string }
/** A table row by column code; an unanswered cell is absent. */
export type TableRow = Partial<Record<string, string>>;

/**
 * A catalog field drawn as it is filled in. "design" is the static card of the Oficina sheet; "fill" edits
 * {@link value} (the consultation answer, or a throwaway value in the Oficina preview). Read-only disables it.
 */
@Component({
  selector: 'app-field-control',
  templateUrl: './field-control.html',
  styleUrl: './field-control.css',
})
export class FieldControl {
  readonly field = input.required<RecordField>();
  readonly textRows = input<number | null>(null);
  readonly mode = input<'design' | 'fill'>('design');
  readonly readonly = input(false);
  /** Distinguishes the ids of the same field on the sheet, in the preview and in a consultation. */
  readonly idPrefix = input('field');
  readonly value = model<unknown>(null);

  readonly id = computed(() => `${this.idPrefix()}-${this.field().code}`);
  readonly disabled = computed(() => this.mode() === 'design' || this.readonly());
  readonly scale = computed(() => {
    const field = this.field();
    const values: number[] = [];
    for (let value = field.min ?? 0; value <= (field.max ?? 10); value++) values.push(value);
    return values;
  });
  readonly text = computed(() => typeof this.value() === 'string' ? this.value() as string : '');
  readonly yesNo = computed(() => (this.value() ?? {}) as YesNoAnswer);
  readonly single = computed(() => (this.value() ?? {}) as SingleAnswer);
  readonly multi = computed(() => (this.value() ?? {}) as MultiAnswer);
  /** At least one (empty) row is always shown. */
  readonly rows = computed(() => {
    const rows = Array.isArray(this.value()) ? this.value() as TableRow[] : [];
    return rows.length ? rows : [{}];
  });

  setText(text: string) {
    this.value.set(text === '' ? null : text);
  }

  setNumber(input: HTMLInputElement) {
    this.value.set(input.value === '' || Number.isNaN(input.valueAsNumber) ? null : input.valueAsNumber);
  }

  setYesNo(change: YesNoAnswer) {
    this.value.set({ ...this.yesNo(), ...change });
  }

  /** "other" switches to the free text; choosing an option drops it. */
  setSingle(code: string) {
    if (code === '') this.value.set(null);
    else this.value.set(code === 'other' ? { other: this.single().other ?? '' } : { option: code });
  }

  setSingleOther(text: string) {
    this.value.set({ other: text });
  }

  toggleMulti(code: string, checked: boolean) {
    const options = (this.multi().options ?? []).filter(option => option !== code);
    this.value.set({ ...this.multi(), options: checked ? [...options, code] : options });
  }

  toggleMultiOther(checked: boolean) {
    const { other, ...rest } = this.multi();
    this.value.set(checked ? { ...rest, other: other ?? '' } : rest);
  }

  setMultiOther(text: string) {
    this.value.set({ ...this.multi(), other: text });
  }

  setCell(index: number, column: string, text: string) {
    const rows = this.rows().map(row => ({ ...row }));
    rows[index][column] = text;
    this.value.set(rows);
  }

  addRow() {
    this.value.set([...this.rows().map(row => ({ ...row })), {}]);
  }

  removeRow(index: number) {
    const rows = this.rows().filter((_, i) => i !== index);
    this.value.set(rows.length ? rows : null);
  }

  step(decimals: number | undefined) {
    return decimals ? (1 / 10 ** decimals).toString() : '1';
  }

  hasOther(answer: SingleAnswer | MultiAnswer) {
    return answer.other !== undefined;
  }
}

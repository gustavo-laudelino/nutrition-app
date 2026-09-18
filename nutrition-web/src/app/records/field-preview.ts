import { Component, computed, input, signal } from '@angular/core';
import { RecordField } from './records-api';

/**
 * A catalog field drawn as it will be filled in. On the Oficina sheet the controls are disabled (the card is
 * dragged and selected, not filled); in the preview they work, but nothing is kept or sent.
 */
@Component({
  selector: 'app-field-preview',
  templateUrl: './field-preview.html',
  styleUrl: './field-preview.css',
})
export class FieldPreview {
  readonly field = input.required<RecordField>();
  readonly textRows = input<number | null>(null);
  readonly interactive = input(false);
  /** Distinguishes the ids of the same field on the sheet and in the preview. */
  readonly idPrefix = input('field');

  readonly id = computed(() => `${this.idPrefix()}-${this.field().code}`);
  readonly scale = computed(() => {
    const field = this.field();
    const values: number[] = [];
    for (let value = field.min ?? 0; value <= (field.max ?? 10); value++) values.push(value);
    return values;
  });
  // Preview-only state, so "Sim" reveals the detail and "Adicionar linha" works; discarded with the component.
  readonly answer = signal<string | null>(null);
  readonly rows = signal(1);

  step(decimals: number | undefined) {
    return decimals ? (1 / 10 ** decimals).toString() : '1';
  }

  rowIndexes() {
    return Array.from({ length: this.rows() }, (_, index) => index);
  }
}

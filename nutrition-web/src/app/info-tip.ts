import { Component, input } from '@angular/core';

@Component({
  selector: 'app-info-tip',
  standalone: true,
  template: `
    <button type="button" class="info-trigger" [attr.aria-label]="label()" [attr.aria-describedby]="tipId()"
      (keydown.escape)="dismissed = true" (blur)="dismissed = false" (mouseenter)="dismissed = false">
      <span aria-hidden="true">i</span>
    </button>
    <span class="info-bubble" role="tooltip" [id]="tipId()" [class.dismissed]="dismissed">{{ text() }}</span>
  `,
  styles: `
    :host { display: inline-flex; position: relative; vertical-align: middle; margin-left: 7px; }
    .info-trigger { display: grid; place-items: center; width: 20px; height: 20px; padding: 0;
      border: 1px solid #bacbc0; border-radius: 50%; background: #f4f8f3; color: #52735e;
      font: 600 12px Georgia, serif; cursor: help; }
    .info-bubble { display: none; position: absolute; z-index: 20; top: 100%; right: 0;
      width: min(250px, calc(100vw - 70px)); padding: 12px 14px; border-radius: 9px;
      background: #244c38; color: #fff; box-shadow: 0 5px 18px #17352426;
      font: 400 12px/1.6 Arial, sans-serif; text-align: left; white-space: normal; }
    :host(:hover) .info-bubble, :host(:focus-within) .info-bubble { display: block; }
    .info-bubble.dismissed { display: none !important; }
  `,
})
export class InfoTipComponent {
  readonly text = input.required<string>();
  readonly tipId = input.required<string>();
  readonly label = input('Mais informações');
  dismissed = false;
}

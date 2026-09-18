import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiErrors, ApiErrors, NO_ERRORS } from '../api-errors';
import { RecordsApi, RecordTemplateSummary } from './records-api';

/** The nutritionist's record templates; each one opens in the Oficina. */
@Component({
  selector: 'app-template-list',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './template-list.html',
  styleUrls: ['../account.css', './template-list.css'],
})
export class TemplateList implements OnInit {
  private readonly api = inject(RecordsApi);
  private readonly router = inject(Router);
  readonly templates = signal<RecordTemplateSummary[] | null>(null);
  readonly error = signal('');
  readonly creating = signal(false);
  readonly busy = signal(false);
  readonly createErrors = signal<ApiErrors>(NO_ERRORS);
  readonly pendingDelete = signal<string | null>(null);
  newName = '';
  newSource: 'STARTER' | 'BLANK' = 'STARTER';

  ngOnInit() {
    this.load();
  }

  load() {
    this.error.set('');
    this.api.list().subscribe({
      next: templates => this.templates.set(templates),
      error: (error: HttpErrorResponse) => this.error.set(apiErrors(error).detail),
    });
  }

  /** The starter template is the suggested start, preselected when there is no template yet. */
  openCreate(source: 'STARTER' | 'BLANK' = 'STARTER') {
    this.newName = source === 'STARTER' && !this.templates()?.length ? 'Primeira consulta' : '';
    this.newSource = source;
    this.createErrors.set(NO_ERRORS);
    this.creating.set(true);
  }

  create() {
    this.busy.set(true);
    this.api.create(this.newName, this.newSource).subscribe({
      next: template => void this.router.navigate(['/prontuario/modelos', template.id]),
      error: (error: HttpErrorResponse) => {
        this.busy.set(false);
        this.createErrors.set(apiErrors(error));
      },
    });
  }

  duplicate(id: string) {
    this.run(this.api.duplicate(id));
  }

  makeDefault(id: string) {
    this.run(this.api.makeDefault(id));
  }

  remove(id: string) {
    this.pendingDelete.set(null);
    this.run(this.api.delete(id));
  }

  /** Card actions reload the list; errors show above the cards. */
  private run(request: Observable<unknown>) {
    this.busy.set(true);
    this.error.set('');
    request.subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: (error: HttpErrorResponse) => { this.busy.set(false); this.error.set(apiErrors(error).detail); },
    });
  }
}

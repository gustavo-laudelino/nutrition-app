import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { apiErrors, ApiErrors, NO_ERRORS } from '../api-errors';
import { Session } from './session';

/** Login (/login) and nutritionist registration (/cadastro), chosen by route data. */
@Component({
  selector: 'app-auth-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth-page.html',
  styleUrl: '../account.css',
})
export class AuthPage {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  readonly registering = inject(ActivatedRoute).snapshot.data['registering'] === true;
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    email: new FormControl('', { nonNullable: true }),
    password: new FormControl('', { nonNullable: true }),
  });
  readonly busy = signal(false);
  readonly errors = signal<ApiErrors>(NO_ERRORS);

  submit() {
    if (this.busy()) return;
    this.busy.set(true);
    this.errors.set(NO_ERRORS);
    const { name, email, password } = this.form.getRawValue();
    const request = this.registering
      ? this.session.authenticate('register', { name, email, password })
      : this.session.authenticate('login', { email, password });
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        this.form.controls.password.reset();
        void this.router.navigateByUrl('/pacientes');
      },
      error: error => this.errors.set(apiErrors(error)),
    });
  }
}

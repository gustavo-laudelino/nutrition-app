import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Session } from '../auth/session';

/**
 * Frame of the nutritionist's screens: left sidebar with Perfil, Pacientes and Planejamento alimentar.
 * The sidebar appears only with a session; the planning still opens without login for now.
 */
@Component({
  selector: 'app-nutritionist-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './nutritionist-layout.html',
  styleUrl: './nutritionist-layout.css',
})
export class NutritionistLayout implements OnInit {
  readonly session = inject(Session);
  readonly profileError = signal(false);

  ngOnInit() {
    // After a reload only the token survives; the name comes from /api/auth/me.
    if (this.session.token() && !this.session.nutritionist()) this.loadProfile();
  }

  loadProfile() {
    this.profileError.set(false);
    this.session.loadProfile().subscribe({ error: () => this.profileError.set(true) });
  }
}

import { Component, inject } from '@angular/core';
import { Session } from '../auth/session';

/** Nutritionist's own account data (read-only: the API has no profile update yet). */
@Component({
  selector: 'app-profile-page',
  templateUrl: './profile-page.html',
  styleUrl: '../account.css',
})
export class ProfilePage {
  readonly session = inject(Session);
}

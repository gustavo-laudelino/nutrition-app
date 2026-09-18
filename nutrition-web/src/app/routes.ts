import { Routes } from '@angular/router';
import { AppComponent } from './app';
import { AuthPage } from './auth/auth-page';
import { authenticated } from './auth/session';
import { NutritionistLayout } from './layout/nutritionist-layout';
import { PatientForm } from './patients/patient-form';
import { PatientList } from './patients/patient-list';
import { ProfilePage } from './profile/profile-page';

// The nutritionist's screens share the sidebar layout. Planning stays public for now (the sidebar only shows with a
// session); in the future it becomes part of the nutritionist's access.
export const routes: Routes = [
  { path: 'login', component: AuthPage },
  { path: 'cadastro', component: AuthPage, data: { registering: true } },
  {
    path: '',
    component: NutritionistLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'planejamento' },
      { path: 'planejamento', component: AppComponent },
      { path: 'perfil', component: ProfilePage, canActivate: [authenticated] },
      {
        path: 'pacientes',
        canActivate: [authenticated],
        canActivateChild: [authenticated],
        children: [
          { path: '', component: PatientList },
          { path: 'novo', component: PatientForm },
          { path: ':id', component: PatientForm },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

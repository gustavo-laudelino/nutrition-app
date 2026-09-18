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
      {
        path: 'prontuario',
        canActivate: [authenticated],
        canActivateChild: [authenticated],
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'modelos' },
          // Loaded on demand: the Oficina is only for logged-in nutritionists and stays out of the initial bundle.
          { path: 'modelos', loadComponent: () => import('./records/template-list').then(module => module.TemplateList) },
          {
            path: 'modelos/:id',
            loadComponent: () => import('./records/oficina').then(module => module.Oficina),
            canDeactivate: [(component: { dirty(): boolean }) =>
              !component.dirty() || window.confirm('Sair da Oficina sem salvar as alterações do modelo?')],
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

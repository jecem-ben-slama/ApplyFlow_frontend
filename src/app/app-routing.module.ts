import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { authGuard } from './core/guards/auth.guard'; // Adjust this path to where your guard file is located

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
 
  {
    path: 'skills',
    loadComponent: () =>
      import('./components/skills/skills.component').then(
        (m) => m.SkillsComponent
      ),
    canActivate: [authGuard], // Protected from anonymous access
  },
  {
    path: 'templates',
    loadComponent: () =>
      import('./components/templates/templates.component').then(
        (m) => m.TemplatesComponent
      ),
    canActivate: [authGuard], // Protected from anonymous access
  },
  {
    path: 'cv-variants',
    loadComponent: () =>
      import('./components/cv-variants/cv-variants.component').then(
        (m) => m.CvVariantsComponent
      ),
    canActivate: [authGuard], // Protected from anonymous access
  },
  {
    path: '',
    redirectTo: 'skills',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'skills',
  },
];

import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
  },

  {
    path: 'legal',
    loadComponent: () =>
      import('./components/legal/legal.component').then(
        (m) => m.LegalComponent
      ),
  },
  {
    path: 'privacy-policy',
    redirectTo: 'legal',
    pathMatch: 'full',
  },
  {
    path: 'terms-of-service',
    redirectTo: 'legal',
    pathMatch: 'full',
  },

  {
    path: 'skills',
    loadComponent: () =>
      import('./components/skills/skills-vue/skills.component').then(
        (m) => m.SkillsComponent
      ),
    canActivate: [authGuard], // Protected from anonymous access
  },
  {
    path: 'templates',
    loadComponent: () =>
      import('./components/templates/templates-view/templates.component').then(
        (m) => m.TemplatesComponent
      ),
    canActivate: [authGuard], // Protected from anonymous access
  },
  {
    path: 'attatchements',
    loadComponent: () =>
      import('./components/CV/cv-variants/cv-variants.component').then(
        (m) => m.CvVariantsComponent
      ),
    canActivate: [authGuard], // Protected from anonymous access
  },
  {
    path: 'applications',
    loadComponent: () =>
      import(
        './components/Application/applications/applications.component'
      ).then((m) => m.ApplicationsComponent),
    canActivate: [authGuard], // Protected from anonymous access
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./components/Dashboard/analytics-dashboard.component').then(
        (m) => m.AnalyticsDashboardComponent
      ),
    canActivate: [authGuard], // Protected from anonymous access
  },
  {
    path:'profile',
    loadComponent:() =>
      import('./components/Profile/profile.component').then(  
(m) => m.ProfileComponent),
canActivate: [authGuard], // Protected from anonymous access},
      },
  {
    path: '',
    redirectTo: 'applications',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'applications',
  },
];

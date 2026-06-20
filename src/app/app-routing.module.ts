import { Routes } from '@angular/router';

export const routes: Routes = [
 
  {
    path: 'skills',
    loadComponent: () =>
      import('./components/skills/skills.component').then((m) => m.SkillsComponent),
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
];

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './components/sidebar/sidebar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <div class="min-h-screen bg-slate-950 flex font-sans antialiased">
      <app-sidebar></app-sidebar>

      <main class="flex-1 h-screen overflow-y-auto">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
})
export class AppComponent {}

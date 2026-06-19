import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatSliderModule } from '@angular/material/slider'; // Import a Material component
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MatSliderModule, MatButtonModule],
  template: `
    <div
      class="min-h-screen bg-slate-900 flex flex-col justify-center items-center gap-4 text-white"
    >
      <h1 class="text-3xl font-bold text-blue-500">
        ApplyFlow Frontend Active
      </h1>
      <p class="text-slate-400">
        Tailwind Utilities + Angular Material loaded successfully.
      </p>

      <button mat-raised-button color="primary" class="px-6 py-2">
        Material Button
      </button>
    </div>
  `,
})
export class AppComponent {}

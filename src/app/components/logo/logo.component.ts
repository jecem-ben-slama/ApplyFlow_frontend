import { Component } from '@angular/core';

let logoIdCounter = 0;

@Component({
  selector: 'app-logo',
  standalone: true,
  templateUrl: './logo.component.html',
})
export class LogoComponent {
  readonly gradientId = `applyflow-plane-${logoIdCounter++}`;
}

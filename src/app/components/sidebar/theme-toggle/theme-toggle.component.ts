import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './theme-toggle.component.html',
})
export class ThemeToggleComponent {
  @Input() isDark = false;
  @Output() toggle = new EventEmitter<void>();
}

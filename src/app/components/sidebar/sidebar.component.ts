import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router'; // <-- CRITICAL
import { MatIconModule } from '@angular/material/icon';
import { ThemeService } from '../../services/theme.service'; // <-- Adjust relative path to your service file

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  userName = 'Maya';
  userTier = 'Premium Operator';

  // Bind directly to the global theme reactive state
  isDarkMode$ = this.themeService.isDarkMode$;

  constructor(private themeService: ThemeService) {}

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

interface NavigationItem {
  label: string;
  icon: string;
  active: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  userName = 'Maya';
  userTier = 'Pro plan';

  navItems: NavigationItem[] = [
    { label: 'Dashboard', icon: 'dashboard', active: true },
    { label: 'Templates', icon: 'mail_outline', active: false },
    { label: 'Skills', icon: 'bolt', active: false },
    { label: 'Integrations', icon: 'settings_ethernet', active: false },
    { label: 'Analytics', icon: 'bar_chart', active: false },
  ];

  setActive(clickedItem: NavigationItem): void {
    this.navItems.forEach((item) => (item.active = item === clickedItem));
  }
}

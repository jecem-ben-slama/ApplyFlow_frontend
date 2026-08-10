import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SIDEBAR_NAV_ITEMS, SidebarNavItem } from '../nav-items';

@Component({
  selector: 'app-sidebar-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './sidebar-nav.component.html',
})
export class SidebarNavComponent {
  /** Icon-only rail mode (desktop collapsed state). */
  @Input() collapsed = false;
  /** Emitted whenever a link is activated — parents use this to close overlays. */
  @Output() navigate = new EventEmitter<void>();

  readonly items: SidebarNavItem[] = SIDEBAR_NAV_ITEMS;

  onNavigate(): void {
    this.navigate.emit();
  }
}

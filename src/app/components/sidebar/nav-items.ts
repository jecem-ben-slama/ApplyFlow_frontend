export interface SidebarNavItem {
  path: string;
  label: string;
  icon: string;
  /** Whether routerLinkActive should require an exact path match. */
  exact?: boolean;
}

/**
 * Single source of truth for primary navigation.
 * Used by both the desktop sidebar and the mobile bottom nav
 * so the two layouts can never drift out of sync.
 */
export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { path: '/templates', label: 'Templates', icon: 'auto_awesome_mosaic', exact: true },
  { path: '/cv-variants', label: 'Attachments', icon: 'description', exact: true },
  { path: '/skills', label: 'Skills', icon: 'psychology' },
  { path: '/applications', label: 'Applications', icon: 'send', exact: true },
  { path: '/dashboard', label: 'Dashboard', icon: 'bar_chart', exact: true },
];

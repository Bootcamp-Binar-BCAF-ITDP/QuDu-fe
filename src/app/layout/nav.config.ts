export type NavAction = 'logout';

export interface NavLeaf {
  label: string;
  route: string;
}

export interface NavItem {
  label: string;
  icon: string[];
  route?: string;
  children?: NavLeaf[];
  exact?: boolean;
  action?: NavAction;
}

export const ICONS = {
  bank: ['M3 21h18', 'M5 21V10', 'M19 21V10', 'M2 10l10-6 10 6', 'M9 21v-6h6v6'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v5h-7z', 'M14 12h7v9h-7z', 'M3 14h7v7H3z'],
  clipboard: [
    'M9 3h6a1 1 0 011 1v1H8V4a1 1 0 011-1z',
    'M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-2',
    'M8 11h8',
    'M8 15h5',
  ],
  layers: ['M12 3l9 5-9 5-9-5 9-5z', 'M3 12l9 5 9-5', 'M3 17l9 5 9-5'],
  history: ['M3 12a9 9 0 109-9 9 9 0 00-6.36 2.64L3 8', 'M3 3v5h5', 'M12 7v5l3 2'],
  chart: ['M3 21h18', 'M7 21V10', 'M12 21V4', 'M17 21v-7'],
  gear: [
    'M12 15a3 3 0 100-6 3 3 0 000 6z',
    'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
  ],
  bell: ['M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 01-3.46 0'],
  search: ['M11 18a7 7 0 100-14 7 7 0 000 14z', 'M20 20l-3.5-3.5'],
  chevronDown: ['M6 9l6 6 6-6'],
  logout: ['M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
} as const;

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', route: '/dashboard', icon: [...ICONS.grid] },
  { label: 'Applications', route: '/applications', icon: [...ICONS.clipboard] },
  {
    label: 'Master data',
    icon: [...ICONS.layers],
    children: [
      { label: 'Role', route: '/master/roles' },
      { label: 'Branch', route: '/master/branches' },
      { label: 'Menu', route: '/master/menus' },
      { label: 'User', route: '/master/users' },
    ],
  },
  { label: 'Bucket', route: '/bucket', icon: [...ICONS.bell] },
  { label: 'Approval history', route: '/approval-history', icon: [...ICONS.history] },
  { label: 'Reports', route: '/reports', icon: [...ICONS.chart] },
];

export const FOOTER_ITEMS: NavItem[] = [
  { label: 'Settings', route: '/settings', icon: [...ICONS.gear] },
  { label: 'Logout',action: 'logout', icon: [...ICONS.logout] },
];

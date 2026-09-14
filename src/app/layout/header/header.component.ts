import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LayoutSearchService } from '../layout-search.service';
import { ICONS } from '../nav.config';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  readonly search = inject(LayoutSearchService);
  readonly icons = ICONS;

  readonly openMenu = output<void>();

  readonly title = input('QuickDuit');
  readonly userName = input('Account');
  readonly userInitial = input('A');
}

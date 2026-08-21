import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-master-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './master-layout.component.html',
})
export class MasterLayoutComponent {
  masterMenuOpen = true;

  toggleMasterMenu(): void {
    this.masterMenuOpen = !this.masterMenuOpen;
  }
}

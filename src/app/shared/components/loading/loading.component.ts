import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading',
  standalone: true,
  templateUrl: './loading.component.html'
})
export class LoadingComponent {
  text = input<string | null>('Memuat data...');
  size = input<'sm' | 'md' | 'lg'>('md');
  fullScreen = input<boolean>(false);
}

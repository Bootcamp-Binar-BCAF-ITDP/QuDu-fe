import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './search.component.html'
})
export class SearchComponent {
  placeholder = input<string>('Search...');
  label = input<string>('Search');
  buttonText = input<string>('Search');
  loading = input<boolean>(false);

  inputId = input<string>('search-' + Math.random().toString(36).substring(2, 9));

  search = output<string>();
  clear = output<void>();

  searchInput = signal<string>('');
  appliedSearch = signal<string>('');

  submitSearch() {
    if (this.loading()) return;

    const currentSearch = this.searchInput().trim();
    this.appliedSearch.set(currentSearch);

    this.search.emit(currentSearch);
  }

  clearSearch() {
    this.searchInput.set('');
    this.appliedSearch.set('');

    this.clear.emit();
  }
}

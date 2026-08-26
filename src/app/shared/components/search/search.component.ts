import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './search.component.html'
})
export class SearchComponent {
  // Inputs to customize the component per usage
  placeholder = input<string>('Search...');
  label = input<string>('Search');
  buttonText = input<string>('Search');
  loading = input<boolean>(false);

  // Unique ID so multiple search bars don't conflict with their labels
  inputId = input<string>('search-' + Math.random().toString(36).substring(2, 9));

  // Outputs to send data back to the parent
  search = output<string>();
  clear = output<void>();

  // Internal State
  searchInput = signal<string>('');
  appliedSearch = signal<string>('');

  submitSearch() {
    if (this.loading()) return;

    const currentSearch = this.searchInput().trim();
    this.appliedSearch.set(currentSearch);

    // Emit the search term to the parent
    this.search.emit(currentSearch);
  }

  clearSearch() {
    this.searchInput.set('');
    this.appliedSearch.set('');

    // Emit clear event so parent can reset its data list
    this.clear.emit();
  }
}

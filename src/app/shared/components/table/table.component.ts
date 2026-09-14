import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableColumn {
  key: string;
  label: string;
  type?: 'text' | 'badge' | 'status';
  sortable?: boolean;
  sortKey?: string;
}

export interface SortEvent {
  sortBy: string;
  sortDir: 'asc' | 'desc';
}

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './table.component.html',
})
export class TableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];

  @Input() loading = false;
  @Input() emptyMessage = 'No data available';

  @Input() showPagination = true;
  @Input() currentPage = 1;
  @Input() totalItems = 0;
  @Input() pageSize = 5;
  @Input() pageSizeOptions: number[] = [5, 10, 25, 50];
  @Input() itemLabel = 'items';

  @Input() sortBy = '';
  @Input() sortDir: 'asc' | 'desc' = 'asc';

  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<any>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();
  @Output() sortChange = new EventEmitter<SortEvent>();

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get visiblePages(): number[] {
    const windowSize = 5;
    const total = this.totalPages;

    let start = Math.max(1, this.currentPage - Math.floor(windowSize / 2));
    const end = Math.min(total, start + windowSize - 1);

    start = Math.max(1, end - windowSize + 1);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  get showingFrom(): number {
    if (this.totalItems === 0) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get showingTo(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalItems);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }

    this.pageChange.emit(page);
  }

  onPageSizeChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);

    this.pageSizeChange.emit(value);
  }

  sortKeyOf(column: TableColumn): string {
    return column.sortKey ?? column.key;
  }

  isSortedBy(column: TableColumn): boolean {
    return this.sortBy === this.sortKeyOf(column);
  }

  toggleSort(column: TableColumn): void {
    if (!column.sortable) {
      return;
    }

    const key = this.sortKeyOf(column);

    const nextDir: 'asc' | 'desc' =
      this.isSortedBy(column) && this.sortDir === 'asc' ? 'desc' : 'asc';

    this.sortChange.emit({ sortBy: key, sortDir: nextDir });
  }

  sortIcon(column: TableColumn): string {
    if (!column.sortable) {
      return '';
    }

    if (!this.isSortedBy(column)) {
      return '↕';
    }

    return this.sortDir === 'asc' ? '↑' : '↓';
  }

  getValue(row: any, key: string): any {
    return key.split('.').reduce((object, property) => object?.[property], row);
  }

  onEdit(row: any): void {
    this.edit.emit(row);
  }

  onDelete(row: any): void {
    this.delete.emit(row);
  }
}

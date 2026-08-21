import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-delete-confirm-modal',
  standalone: true,
  templateUrl: './delete-confirm-modal.component.html',
})
export class DeleteConfirmModalComponent {
  @Input() isOpen = false;
  @Input() title = 'Delete Data';
  @Input() message = 'Are you sure you want to delete this data?';
  @Input() itemName = '';
  @Input() loading = false;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  closeModal(): void {
    if (!this.loading) {
      this.close.emit();
    }
  }

  confirmDelete(): void {
    this.confirm.emit();
  }
}

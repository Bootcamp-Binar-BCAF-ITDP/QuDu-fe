import { DeleteConfirmModalComponent } from './delete-confirm-modal.component';

describe('DeleteConfirmModalComponent', () => {
  let modal: DeleteConfirmModalComponent;
  let closed: number;
  let confirmed: number;

  beforeEach(() => {
    modal = new DeleteConfirmModalComponent();

    closed = 0;
    confirmed = 0;
    modal.close.subscribe(() => (closed += 1));
    modal.confirm.subscribe(() => (confirmed += 1));
  });

  it('starts closed, so a page that forgets to bind it shows nothing', () => {
    expect(modal.isOpen).toBe(false);
  });

  it('carries wording a page can use without setting anything', () => {
    expect(modal.title).toBe('Delete Data');
    expect(modal.message).toContain('Are you sure');
  });

  it('closes when asked', () => {
    modal.closeModal();
    expect(closed).toBe(1);
  });

  it('refuses to close while the delete is in flight, so the row cannot vanish mid-request', () => {
    modal.loading = true;
    modal.closeModal();

    expect(closed).toBe(0);
  });

  it('closes again once the request has finished', () => {
    modal.loading = true;
    modal.closeModal();

    modal.loading = false;
    modal.closeModal();

    expect(closed).toBe(1);
  });

  it('confirms when asked', () => {
    modal.confirmDelete();
    expect(confirmed).toBe(1);
  });

  it('does not guard confirm on loading, which is why the page must disable the button', () => {
    modal.loading = true;
    modal.confirmDelete();

    expect(confirmed).toBe(1);
  });

  it('emits confirm without closing, leaving the page to close it after the request', () => {
    modal.confirmDelete();

    expect(confirmed).toBe(1);
    expect(closed).toBe(0);
  });

  it('names the item so the message can say what is being deleted', () => {
    modal.itemName = 'Jakarta Pusat';
    expect(modal.itemName).toBe('Jakarta Pusat');
  });
});

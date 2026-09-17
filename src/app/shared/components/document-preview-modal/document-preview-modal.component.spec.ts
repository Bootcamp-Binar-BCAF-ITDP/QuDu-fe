import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, throwError } from 'rxjs';

import { DocumentPreviewService } from '../../../core/services/document/document-preview.service';
import { DocumentPreviewModalComponent } from './document-preview-modal.component';

describe('DocumentPreviewModalComponent', () => {
  let fixture: ComponentFixture<DocumentPreviewModalComponent>;
  let modal: DocumentPreviewModalComponent;

  let content$: Subject<Blob>;
  let requestedUrls: string[];
  let failRequest = false;

  let created: string[];
  let revoked: string[];

  const build = () => {
    TestBed.resetTestingModule();

    content$ = new Subject<Blob>();
    requestedUrls = [];
    failRequest = false;

    created = [];
    revoked = [];

    let counter = 0;
    URL.createObjectURL = vi.fn(() => {
      const url = `blob:stub-${++counter}`;
      created.push(url);
      return url;
    }) as unknown as typeof URL.createObjectURL;

    URL.revokeObjectURL = vi.fn((url: string) => {
      revoked.push(url);
    }) as unknown as typeof URL.revokeObjectURL;

    TestBed.configureTestingModule({
      imports: [DocumentPreviewModalComponent],
      providers: [
        {
          provide: DocumentPreviewService,
          useValue: {
            contentAt: (url: string) => {
              requestedUrls.push(url);
              return failRequest ? throwError(() => new Error('gone')) : content$.asObservable();
            },
            isImage: (d: { fileName?: string } | null) => !!d?.fileName?.endsWith('.png'),
            isPdf: (d: { fileName?: string } | null) => !!d?.fileName?.endsWith('.pdf'),
            label: (d: { documentType?: string } | null) => d?.documentType ?? 'Document',
          },
        },
      ],
    });

    TestBed.overrideComponent(DocumentPreviewModalComponent, {
      set: { template: '', imports: [] },
    });

    fixture = TestBed.createComponent(DocumentPreviewModalComponent);
    modal = fixture.componentInstance;
  };

  const open = (
    document: Record<string, unknown> | null,
    contentUrl: string | null = 'https://api.test/doc/1/content',
  ) => {
    modal.document = document as never;
    modal.contentUrl = contentUrl;
    modal.ngOnChanges();
  };

  beforeEach(() => build());

  describe('opening', () => {
    it('fetches the content for the document it was given', () => {
      open({ documentId: 1, fileName: 'ktp.png', documentType: 'KTP' });

      expect(requestedUrls).toEqual(['https://api.test/doc/1/content']);
      expect(modal.loading()).toBe(true);
    });

    it('fetches nothing when there is no document', () => {
      open(null);

      expect(requestedUrls).toEqual([]);
      expect(modal.loading()).toBe(false);
    });

    it('fetches nothing when there is no url to fetch from', () => {
      open({ documentId: 1, fileName: 'ktp.png' }, null);

      expect(requestedUrls).toEqual([]);
    });

    it('turns the blob into an object url once it arrives', () => {
      open({ documentId: 1, fileName: 'ktp.png' });
      content$.next(new Blob(['x']));

      expect(modal.objectUrl()).toBe('blob:stub-1');
      expect(modal.loading()).toBe(false);
    });

    it('wraps the url so an iframe will accept it', () => {
      open({ documentId: 1, fileName: 'x.pdf' });
      content$.next(new Blob(['x']));

      expect(modal.frameUrl()).not.toBeNull();
    });

    it('explains the failure instead of showing a blank frame', () => {
      failRequest = true;
      open({ documentId: 1, fileName: 'ktp.png' });

      expect(modal.error()).toContain('could not be loaded');
      expect(modal.loading()).toBe(false);
    });

    it('clears an earlier error when a new document is opened', () => {
      failRequest = true;
      open({ documentId: 1, fileName: 'a.png' });
      expect(modal.error()).not.toBeNull();

      failRequest = false;
      open({ documentId: 2, fileName: 'b.png' });

      expect(modal.error()).toBeNull();
    });
  });

  describe('what it says about the document', () => {
    it('asks the service whether to render an image or a frame', () => {
      open({ documentId: 1, fileName: 'ktp.png', documentType: 'KTP' });

      expect(modal.isImage).toBe(true);
      expect(modal.isPdf).toBe(false);
    });

    it('recognises a pdf', () => {
      open({ documentId: 1, fileName: 'slip.pdf', documentType: 'SALARY_SLIP' });

      expect(modal.isPdf).toBe(true);
      expect(modal.isImage).toBe(false);
    });

    it('titles the modal from the document type', () => {
      open({ documentId: 1, fileName: 'ktp.png', documentType: 'KTP' });

      expect(modal.title).toBe('KTP');
    });

    it('names the file for the download link', () => {
      open({ documentId: 1, fileName: 'ktp.png' });

      expect(modal.fileName).toBe('ktp.png');
    });

    it('falls back to a generic file name when the document has none', () => {
      open({ documentId: 1 });

      expect(modal.fileName).toBe('document');
    });
  });

  describe('releasing the object url', () => {
    it('revokes it on close, rather than leaking it for the life of the tab', () => {
      open({ documentId: 1, fileName: 'ktp.png' });
      content$.next(new Blob(['x']));

      modal.closeModal();

      expect(revoked).toEqual(['blob:stub-1']);
      expect(modal.objectUrl()).toBeNull();
      expect(modal.frameUrl()).toBeNull();
    });

    it('tells the page it was closed', () => {
      let closed = 0;
      modal.close.subscribe(() => (closed += 1));

      modal.closeModal();

      expect(closed).toBe(1);
    });

    it('revokes the previous url when a second document is opened', () => {
      open({ documentId: 1, fileName: 'a.png' });
      content$.next(new Blob(['a']));

      content$ = new Subject<Blob>();
      open({ documentId: 2, fileName: 'b.png' });

      expect(revoked).toEqual(['blob:stub-1']);
    });

    it('revokes on destroy, so navigating away does not leak', () => {
      open({ documentId: 1, fileName: 'ktp.png' });
      content$.next(new Blob(['x']));

      modal.ngOnDestroy();

      expect(revoked).toEqual(['blob:stub-1']);
    });

    it('revokes nothing when nothing was ever loaded', () => {
      modal.closeModal();
      expect(revoked).toEqual([]);
    });
  });
});

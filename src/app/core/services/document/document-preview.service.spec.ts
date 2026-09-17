import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { REQUIRES_AUTH } from '../../context/auth-context';
import { DocumentPreviewService } from './document-preview.service';

const API = environment.apiOrigin;

describe('DocumentPreviewService', () => {
  let service: DocumentPreviewService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    backend = TestBed.inject(HttpTestingController);
    service = TestBed.inject(DocumentPreviewService);
  });

  afterEach(() => backend.verify());

  describe('the content urls', () => {
    it('builds the loan document url', () => {
      expect(service.loanDocumentUrl('APP-1', 12)).toBe(
        `${API}/api/loan-applications/APP-1/documents/12/content`,
      );
    });

    it('builds the plafond request document url from a different prefix', () => {
      expect(service.plafondDocumentUrl('R-1', 12)).toBe(
        `${API}/api/bm/plafond-requests/R-1/documents/12/content`,
      );
    });

    it('keeps the two apart, since they are guarded by different roles', () => {
      expect(service.loanDocumentUrl('X', 1)).not.toBe(service.plafondDocumentUrl('X', 1));
    });
  });

  describe('contentAt', () => {
    it('fetches as a blob, so binary is not mangled into a string', () => {
      service.contentAt(`${API}/api/whatever`).subscribe();

      const req = backend.expectOne(`${API}/api/whatever`);
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['x']));
    });

    it('sends a token, or the preview downloads a 401 page instead of the file', () => {
      service.contentAt(`${API}/api/whatever`).subscribe();

      const req = backend.expectOne(`${API}/api/whatever`);
      expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
      req.flush(new Blob(['x']));
    });
  });

  describe('extension', () => {
    it('reads the extension off the file name', () => {
      expect(service.extension({ fileName: 'ktp.png' })).toBe('png');
    });

    it('lowercases it, so PNG and png are one thing', () => {
      expect(service.extension({ fileName: 'KTP.PNG' })).toBe('png');
    });

    it('takes the last extension when the name has several dots', () => {
      expect(service.extension({ fileName: 'scan.2026.01.pdf' })).toBe('pdf');
    });

    it('gives an empty string for a name with no extension', () => {
      expect(service.extension({ fileName: 'noextension' })).toBe('');
    });

    it('gives an empty string for null, undefined and a missing name', () => {
      expect(service.extension(null)).toBe('');
      expect(service.extension(undefined)).toBe('');
      expect(service.extension({})).toBe('');
      expect(service.extension({ fileName: null })).toBe('');
    });

    it('ignores a dot that ends the name', () => {
      expect(service.extension({ fileName: 'trailing.' })).toBe('');
    });
  });

  describe('isImage', () => {
    it('accepts every format the service lists', () => {
      for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic']) {
        expect(service.isImage({ fileName: `x.${ext}` })).toBe(true);
      }
    });

    it('accepts heic, which iPhone cameras produce by default', () => {
      expect(service.isImage({ fileName: 'ktp.HEIC' })).toBe(true);
    });

    it('rejects a pdf', () => {
      expect(service.isImage({ fileName: 'x.pdf' })).toBe(false);
    });

    it('rejects a document with no name', () => {
      expect(service.isImage(null)).toBe(false);
    });
  });

  describe('isPdf', () => {
    it('accepts a pdf in any case', () => {
      expect(service.isPdf({ fileName: 'x.pdf' })).toBe(true);
      expect(service.isPdf({ fileName: 'x.PDF' })).toBe(true);
    });

    it('rejects an image', () => {
      expect(service.isPdf({ fileName: 'x.png' })).toBe(false);
    });

    it('agrees with isImage on nothing, so the viewer never has to choose', () => {
      for (const name of ['x.pdf', 'x.png', 'x.heic', 'x.txt', 'x']) {
        const doc = { fileName: name };
        expect(service.isPdf(doc) && service.isImage(doc)).toBe(false);
      }
    });
  });

  describe('label', () => {
    it('turns a snake case type into words', () => {
      expect(service.label({ documentType: 'SALARY_SLIP' })).toBe('Salary Slip');
    });

    it('keeps known acronyms upper case', () => {
      expect(service.label({ documentType: 'KTP' })).toBe('KTP');
      expect(service.label({ documentType: 'KK' })).toBe('KK');
      expect(service.label({ documentType: 'NPWP' })).toBe('NPWP');
    });

    it('mixes acronyms and words in one label', () => {
      expect(service.label({ documentType: 'KTP_SCAN' })).toBe('KTP Scan');
    });

    it('drops empty segments from a doubled underscore', () => {
      expect(service.label({ documentType: 'A__B' })).toBe('A B');
    });

    it('falls back to Document when there is nothing to label', () => {
      expect(service.label({ documentType: '' })).toBe('Document');
      expect(service.label({})).toBe('Document');
      expect(service.label(null)).toBe('Document');
      expect(service.label(undefined)).toBe('Document');
    });

    it('normalises a type that arrived already lower case', () => {
      expect(service.label({ documentType: 'salary_slip' })).toBe('Salary Slip');
    });

    it('recognises an acronym written in lower case', () => {
      expect(service.label({ documentType: 'ktp' })).toBe('KTP');
    });
  });
});

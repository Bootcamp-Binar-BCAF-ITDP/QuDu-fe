import { HttpContext } from '@angular/common/http';

import { REQUIRES_AUTH } from './auth-context';

describe('REQUIRES_AUTH', () => {
  it('defaults to false, so a request only carries a token when it opts in', () => {
    expect(new HttpContext().get(REQUIRES_AUTH)).toBe(false);
  });

  it('reads back true once a caller sets it', () => {
    const context = new HttpContext().set(REQUIRES_AUTH, true);
    expect(context.get(REQUIRES_AUTH)).toBe(true);
  });

  it('can be turned off again on the same context', () => {
    const context = new HttpContext().set(REQUIRES_AUTH, true).set(REQUIRES_AUTH, false);
    expect(context.get(REQUIRES_AUTH)).toBe(false);
  });

  it('is one shared token, so the interceptor and the helpers agree on the key', () => {
    const context = new HttpContext().set(REQUIRES_AUTH, true);
    expect(context.has(REQUIRES_AUTH)).toBe(true);
  });

  it('keeps contexts independent of one another', () => {
    const marked = new HttpContext().set(REQUIRES_AUTH, true);
    const plain = new HttpContext();

    expect(marked.get(REQUIRES_AUTH)).toBe(true);
    expect(plain.get(REQUIRES_AUTH)).toBe(false);
  });
});

import { apiErrorMessage, humaniseApiMessage } from './api-message.util';

describe('humaniseApiMessage', () => {
  const fallback = 'That did not save. Try again.';

  it('rewrites the message the user reported, with no field name left in it', () => {
    expect(humaniseApiMessage('reviewNote: reviewNote must not be null', fallback)).toBe(
      'Review note must be filled',
    );
  });

  it('rewrites the same complaint for the call note and the decision note', () => {
    expect(humaniseApiMessage('verificationNote: verificationNote is required', fallback)).toBe(
      'Call note must be filled',
    );
    expect(humaniseApiMessage('decisionNote: decisionNote must not be blank', fallback)).toBe(
      'Decision note must be filled',
    );
  });

  it('covers every way the backend says a field is empty', () => {
    for (const complaint of [
      'must not be null',
      'must not be blank',
      'must not be empty',
      'is required',
      'may not be null',
    ]) {
      expect(humaniseApiMessage(`note: ${complaint}`, fallback)).toBe('Note must be filled');
    }
  });

  it('ignores the case the complaint arrived in', () => {
    expect(humaniseApiMessage('note: MUST NOT BE NULL', fallback)).toBe('Note must be filled');
  });

  it('spells an unmapped field out of its camel case name', () => {
    expect(humaniseApiMessage('bankAccountNumber: must not be blank', fallback)).toBe(
      'Bank account number must be filled',
    );
  });

  it('prefers the friendly label where one is declared', () => {
    expect(humaniseApiMessage('usernameOrEmail: is required', fallback)).toBe(
      'Username or email must be filled',
    );
  });

  it('keeps a complaint that says something other than empty', () => {
    expect(humaniseApiMessage('tenor: must be at least 6', fallback)).toBe(
      'Tenor must be at least 6',
    );
  });

  it('does not repeat the field name when the backend already put it in the complaint', () => {
    expect(humaniseApiMessage('roleName: roleName must be at most 50 characters', fallback)).toBe(
      'Role name must be at most 50 characters',
    );
  });

  it('humanises every part of a multi-field complaint', () => {
    expect(
      humaniseApiMessage('reviewNote: is required; recommendation: must not be null', fallback),
    ).toBe('Review note must be filled; Recommendation must be filled');
  });

  it('reads a nested or indexed field path down to its last segment', () => {
    expect(humaniseApiMessage('request.reviewNote: must not be null', fallback)).toBe(
      'Review note must be filled',
    );
    expect(humaniseApiMessage('items[0].adminFee: is required', fallback)).toBe(
      'Admin fee must be filled',
    );
  });

  it('leaves a message that names no field exactly as the server wrote it', () => {
    expect(humaniseApiMessage('This application already moved on.', fallback)).toBe(
      'This application already moved on.',
    );
  });

  it('does not mistake a sentence with a colon for a field error', () => {
    const sentence = 'Rejected: the income on file is too low.';
    expect(humaniseApiMessage(sentence, fallback)).toBe(sentence);
  });

  it('falls back when the server sent nothing usable', () => {
    expect(humaniseApiMessage(null, fallback)).toBe(fallback);
    expect(humaniseApiMessage(undefined, fallback)).toBe(fallback);
    expect(humaniseApiMessage('', fallback)).toBe(fallback);
    expect(humaniseApiMessage('   ', fallback)).toBe(fallback);
  });

  it('never returns a string still carrying a raw camelCase field name', () => {
    const humanised = humaniseApiMessage(
      'reviewNote: reviewNote must not be null; verificationNote: verificationNote is required',
      fallback,
    );

    expect(humanised).not.toContain('reviewNote');
    expect(humanised).not.toContain('verificationNote');
    expect(humanised).not.toContain('must not be null');
  });
});

describe('apiErrorMessage', () => {
  const fallback = 'Failed to save.';

  it('digs the message out of an HttpErrorResponse shaped object', () => {
    expect(
      apiErrorMessage({ status: 400, error: { message: 'note: is required' } }, fallback),
    ).toBe('Note must be filled');
  });

  it('falls back when the error carries no message', () => {
    expect(apiErrorMessage({ status: 500 }, fallback)).toBe(fallback);
    expect(apiErrorMessage({ status: 0, error: null }, fallback)).toBe(fallback);
    expect(apiErrorMessage(null, fallback)).toBe(fallback);
    expect(apiErrorMessage(undefined, fallback)).toBe(fallback);
  });
});

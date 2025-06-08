const path = require('path');

function loadAuth(data) {
  jest.resetModules();
  process.env.OAUTH_CLIENT_ID = 'CID123';
  global.UrlFetchApp = { fetch: jest.fn(() => ({ getContentText: () => JSON.stringify(data) })) };
  global.getCacheValue_ = jest.fn(() => null);
  global.putCacheValue_ = jest.fn();
  return require('../src/Auth.gs').verifyGoogleToken;
}

afterEach(() => {
  delete global.UrlFetchApp;
  delete global.getCacheValue_;
  delete global.putCacheValue_;
  delete process.env.OAUTH_CLIENT_ID;
  jest.resetModules();
});

test('verifyGoogleToken returns user info', () => {
  const future = Math.floor(Date.now() / 1000) + 3600;
  const data = { aud: 'CID123', iss: 'https://accounts.google.com', exp: future, email: 'u@example.com', name: 'U', sub: '123' };
  const verifyGoogleToken = loadAuth(data);
  const info = verifyGoogleToken('tok');
  expect(info).toEqual({ email: 'u@example.com', name: 'U', sub: '123' });
  expect(global.UrlFetchApp.fetch).toHaveBeenCalledWith('https://oauth2.googleapis.com/tokeninfo?id_token=tok');
  expect(global.putCacheValue_).toHaveBeenCalledWith('gidTok_tok', info, 300);
});

test('verifyGoogleToken rejects mismatched aud', () => {
  const data = { aud: 'BAD', iss: 'https://accounts.google.com', exp: Math.floor(Date.now()/1000)+60 };
  const verifyGoogleToken = loadAuth(data);
  expect(() => verifyGoogleToken('tok')).toThrow('OAuth client ID mismatch');
});

test('verifyGoogleToken rejects invalid issuer', () => {
  const data = { aud: 'CID123', iss: 'bad', exp: Math.floor(Date.now()/1000)+60 };
  const verifyGoogleToken = loadAuth(data);
  expect(() => verifyGoogleToken('tok')).toThrow('Invalid token issuer');
});

test('verifyGoogleToken rejects expired token', () => {
  const data = { aud: 'CID123', iss: 'https://accounts.google.com', exp: Math.floor(Date.now()/1000)-10 };
  const verifyGoogleToken = loadAuth(data);
  expect(() => verifyGoogleToken('tok')).toThrow('Token expired');
});

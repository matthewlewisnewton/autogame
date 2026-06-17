import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  SESSION_COOKIE_NAME,
  parseCookies,
  getSessionTokenFromRequest,
  setSessionCookie,
  clearSessionCookie,
} = require('../cookies.js');

function mockRes() {
  const setCookies = [];
  return {
    append(name, value) {
      if (name === 'Set-Cookie') {
        setCookies.push(value);
      }
    },
    setCookies,
  };
}

describe('cookies module', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  describe('parseCookies', () => {
    it('returns an empty object for missing or empty headers', () => {
      expect(parseCookies()).toEqual({});
      expect(parseCookies(null)).toEqual({});
      expect(parseCookies('')).toEqual({});
      expect(parseCookies('   ')).toEqual({});
    });

    it('parses a single cookie', () => {
      expect(parseCookies('foo=bar')).toEqual({ foo: 'bar' });
    });

    it('parses multiple cookies separated by semicolons', () => {
      expect(parseCookies('foo=bar; baz=qux; other=1')).toEqual({
        foo: 'bar',
        baz: 'qux',
        other: '1',
      });
    });

    it('trims whitespace around names and values', () => {
      expect(parseCookies('  foo = bar ; baz = qux  ')).toEqual({
        foo: 'bar',
        baz: 'qux',
      });
    });

    it('URL-decodes cookie values', () => {
      expect(parseCookies('msg=hello%20world')).toEqual({ msg: 'hello world' });
      expect(parseCookies('token=abc%2Bdef%3D')).toEqual({ token: 'abc+def=' });
    });
  });

  describe('getSessionTokenFromRequest', () => {
    it('reads the configured session cookie from req.headers.cookie', () => {
      const token = 'opaque-session-token';
      const req = {
        headers: {
          cookie: `other=value; ${SESSION_COOKIE_NAME}=${token}; another=1`,
        },
      };
      expect(getSessionTokenFromRequest(req)).toBe(token);
    });

    it('returns undefined when the session cookie is absent', () => {
      expect(getSessionTokenFromRequest({ headers: { cookie: 'other=value' } })).toBeUndefined();
      expect(getSessionTokenFromRequest({ headers: {} })).toBeUndefined();
      expect(getSessionTokenFromRequest({})).toBeUndefined();
    });
  });

  describe('setSessionCookie and clearSessionCookie', () => {
    it('appends Set-Cookie without Secure outside production', () => {
      process.env.NODE_ENV = 'test';
      const res = mockRes();
      setSessionCookie(res, 'session-token-123');

      expect(res.setCookies).toHaveLength(1);
      expect(res.setCookies[0]).toBe(
        `${SESSION_COOKIE_NAME}=session-token-123; Path=/; HttpOnly; SameSite=Lax`,
      );
      expect(res.setCookies[0]).not.toContain('Secure');
    });

    it('appends Set-Cookie with Secure in production', () => {
      process.env.NODE_ENV = 'production';
      const res = mockRes();
      setSessionCookie(res, 'prod-token');

      expect(res.setCookies).toHaveLength(1);
      expect(res.setCookies[0]).toBe(
        `${SESSION_COOKIE_NAME}=prod-token; Path=/; HttpOnly; SameSite=Lax; Secure`,
      );
    });

    it('clears the session cookie with matching attributes outside production', () => {
      process.env.NODE_ENV = 'test';
      const res = mockRes();
      clearSessionCookie(res);

      expect(res.setCookies).toHaveLength(1);
      expect(res.setCookies[0]).toBe(
        `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
      );
      expect(res.setCookies[0]).not.toContain('Secure');
    });

    it('clears the session cookie with Secure in production', () => {
      process.env.NODE_ENV = 'production';
      const res = mockRes();
      clearSessionCookie(res);

      expect(res.setCookies).toHaveLength(1);
      expect(res.setCookies[0]).toBe(
        `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`,
      );
    });

    it('uses res.append so multiple Set-Cookie headers can coexist', () => {
      process.env.NODE_ENV = 'test';
      const res = mockRes();
      setSessionCookie(res, 'one');
      res.append('Set-Cookie', 'other=value; Path=/');
      setSessionCookie(res, 'two');

      expect(res.setCookies).toEqual([
        `${SESSION_COOKIE_NAME}=one; Path=/; HttpOnly; SameSite=Lax`,
        'other=value; Path=/',
        `${SESSION_COOKIE_NAME}=two; Path=/; HttpOnly; SameSite=Lax`,
      ]);
    });
  });
});

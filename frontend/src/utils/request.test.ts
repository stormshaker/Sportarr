import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequestUrl, getImageUrl } from './request';

type SportarrGlobal = Window['Sportarr'];

// The code under test only reads urlBase, so the fixtures set just that
// rather than inventing an apiRoot, apiKey and version nothing looks at.
// The delete needs the property seen as optional, which the global
// declaration in api/client.ts does not make it.
function setSportarrGlobal(value: Partial<SportarrGlobal> | undefined): void {
  if (value === undefined) {
    delete (window as Partial<Window>).Sportarr;
  } else {
    window.Sportarr = value as SportarrGlobal;
  }
}

describe('Request URL Builder (UrlBase Support)', () => {
  let originalWindow: SportarrGlobal | undefined;

  beforeEach(() => {
    // Store original window.Sportarr
    originalWindow = window.Sportarr;
  });

  afterEach(() => {
    // Restore original window.Sportarr
    if (originalWindow) {
      setSportarrGlobal(originalWindow);
    } else {
      setSportarrGlobal(undefined);
    }
  });

  describe('createRequestUrl', () => {
    it('should return path as-is when UrlBase is empty', () => {
      setSportarrGlobal({ urlBase: '' });
      expect(createRequestUrl('/api/leagues')).toBe('/api/leagues');
      expect(createRequestUrl('/initialize.json')).toBe('/initialize.json');
    });

    it('should prepend UrlBase when configured', () => {
      setSportarrGlobal({ urlBase: '/sportarr' });
      expect(createRequestUrl('/api/leagues')).toBe('/sportarr/api/leagues');
      expect(createRequestUrl('/initialize.json')).toBe('/sportarr/initialize.json');
    });

    it('should handle paths without leading slash', () => {
      setSportarrGlobal({ urlBase: '/my-subpath' });
      expect(createRequestUrl('api/test')).toBe('/my-subpath/api/test');
      expect(createRequestUrl('logo.png')).toBe('/my-subpath/logo.png');
    });

    it('should gracefully handle missing window.Sportarr', () => {
      setSportarrGlobal(undefined);
      expect(createRequestUrl('/api/leagues')).toBe('/api/leagues');
    });

    it('should work with complex paths', () => {
      setSportarrGlobal({ urlBase: '/sportarr' });
      expect(createRequestUrl('/api/system/backup/upload')).toBe('/sportarr/api/system/backup/upload');
      expect(createRequestUrl('/api/leagues/123')).toBe('/sportarr/api/leagues/123');
    });
  });

  describe('getImageUrl', () => {
    it('should prepend / and UrlBase for image filenames', () => {
      setSportarrGlobal({ urlBase: '/sportarr' });
      expect(getImageUrl('logo-64.png')).toBe('/sportarr/logo-64.png');
      expect(getImageUrl('error.png')).toBe('/sportarr/error.png');
      expect(getImageUrl('404.png')).toBe('/sportarr/404.png');
    });

    it('should return root path for images when UrlBase is empty', () => {
      setSportarrGlobal({ urlBase: '' });
      expect(getImageUrl('logo-64.png')).toBe('/logo-64.png');
    });

    it('should handle missing window.Sportarr', () => {
      setSportarrGlobal(undefined);
      expect(getImageUrl('error.png')).toBe('/error.png');
    });
  });
});

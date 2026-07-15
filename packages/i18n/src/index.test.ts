import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { en, fr, resolveLocale, translate } from './index.js';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix.length > 0 ? `${prefix}.${key}` : key),
  );
}

describe('i18n', () => {
  it('falls back to English for unsupported locales', () => {
    assert.equal(resolveLocale('de'), 'en');
    assert.equal(resolveLocale('fr-CA'), 'fr');
  });

  it('interpolates translated values', () => {
    assert.match(translate('fr', 'commands.ping.latency', { latency: 42 }), /42/);
  });

  it('keeps English and French translation keys in parity', () => {
    assert.deepEqual(flattenKeys(fr.translation).sort(), flattenKeys(en.translation).sort());
  });
});

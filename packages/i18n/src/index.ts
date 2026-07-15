import i18next, { type TOptions } from 'i18next';
import { en } from './locales/en.js';
import { fr } from './locales/fr.js';

export const SUPPORTED_LOCALES = ['en', 'fr'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const resources = { en, fr } as const;
const instance = i18next.createInstance();

await instance.init({
  resources,
  fallbackLng: 'en',
  supportedLngs: [...SUPPORTED_LOCALES],
  defaultNS: 'translation',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function resolveLocale(locale: string | null | undefined): SupportedLocale {
  return locale?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function translate(
  locale: string | null | undefined,
  key: string,
  options?: TOptions,
): string {
  return instance.t(key, { ...options, lng: resolveLocale(locale) });
}

export { en, fr };

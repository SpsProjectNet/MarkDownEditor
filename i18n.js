// Minimal internationalisation helper used by the main process.
// Locale files live in ./locales/<code>.json as flat key/value maps.
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, 'locales');
const SUPPORTED = ['en', 'it', 'es', 'fr', 'de', 'pt'];
const DEFAULT_LOCALE = 'en';

let currentLocale = DEFAULT_LOCALE;
let currentStrings = {};
const localeCache = {};

// Load and cache the strings for a locale, returning {} when unavailable.
function loadStrings(locale) {
  if (localeCache[locale]) return localeCache[locale];
  try {
    const file = path.join(LOCALES_DIR, locale + '.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    localeCache[locale] = data;
    return data;
  } catch (error) {
    return {};
  }
}

// Set the active locale. Missing keys fall back to English.
function setLocale(locale) {
  currentLocale = SUPPORTED.includes(locale) ? locale : DEFAULT_LOCALE;
  currentStrings =
    currentLocale === DEFAULT_LOCALE
      ? loadStrings(DEFAULT_LOCALE)
      : Object.assign({}, loadStrings(DEFAULT_LOCALE), loadStrings(currentLocale));
  return currentLocale;
}

// Translate a key, replacing {placeholders} with the given params.
function t(key, params) {
  let text = currentStrings[key] != null ? currentStrings[key] : key;
  if (params) {
    Object.keys(params).forEach((name) => {
      text = text.split('{' + name + '}').join(params[name]);
    });
  }
  return text;
}

// Map a system locale such as "it-IT" to one of the supported codes.
function normalizeLocale(systemLocale) {
  const short = String(systemLocale || '').slice(0, 2).toLowerCase();
  return SUPPORTED.includes(short) ? short : DEFAULT_LOCALE;
}

// List supported locales with their native display name.
function getSupported() {
  return SUPPORTED.map((code) => ({
    code,
    name: loadStrings(code)['lang.name'] || code
  }));
}

function getLocale() {
  return currentLocale;
}

function getStrings() {
  return currentStrings;
}

module.exports = {
  setLocale,
  t,
  normalizeLocale,
  getSupported,
  getLocale,
  getStrings,
  SUPPORTED,
  DEFAULT_LOCALE
};

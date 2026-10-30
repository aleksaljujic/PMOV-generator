// sr + en messages of src/interchange (contract C13). Serbian is Latin script.
import type { Locale } from '../lang/diagnostics';

export interface InterchangeStrings {
  prefix: string;
  notJson: string;
  /** Top-level value that is not an object (field ''). */
  notPmov: string;
  missingField: (field: string) => string;
  wrongFormat: (value: string) => string;
  /** Full sentence, used without the prefix. */
  newerVersion: (version: number) => string;
  badField: (path: string) => string;
  badModel: (path: string) => string;
  tooLarge: string;
  readError: string;
}

const sr: InterchangeStrings = {
  prefix: 'Uvoz nije uspeo',
  notJson: 'datoteka nije ispravan JSON',
  notPmov: 'datoteka nije ispravan PMOV JSON',
  missingField: (field) => `datoteka nije ispravan PMOV JSON (nedostaje polje „${field}”)`,
  wrongFormat: (value) => `nepoznat format „${value}”`,
  newerVersion: (version) => `Datoteka je iz novije verzije aplikacije (verzija ${version}).`,
  badField: (path) => `neispravno polje ${path}`,
  badModel: (path) => `neispravan model na putanji ${path}`,
  tooLarge: 'datoteka je veća od 5 MB',
  readError: 'datoteka ne može da se pročita',
};

const en: InterchangeStrings = {
  prefix: 'Import failed',
  notJson: 'the file is not valid JSON',
  notPmov: 'the file is not a valid PMOV JSON',
  missingField: (field) => `the file is not a valid PMOV JSON (missing field "${field}")`,
  wrongFormat: (value) => `unknown format "${value}"`,
  newerVersion: (version) => `The file comes from a newer version of the app (version ${version}).`,
  badField: (path) => `invalid field ${path}`,
  badModel: (path) => `invalid model at ${path}`,
  tooLarge: 'the file is larger than 5 MB',
  readError: 'the file cannot be read',
};

export function interchangeStrings(locale: Locale): InterchangeStrings {
  return locale === 'en' ? en : sr;
}

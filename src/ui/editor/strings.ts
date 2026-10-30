import type { Locale } from '../../lang';

/** CodeMirror phrases (search panel, go-to-line) per UI language. English is CodeMirror's own default. */
export const PHRASES: Record<Locale, Record<string, string>> = {
  sr: {
    Find: 'Pronađi',
    Replace: 'Zameni',
    next: 'sledeće',
    previous: 'prethodno',
    all: 'sve',
    'match case': 'velika/mala slova',
    regexp: 'regularni izraz',
    'by word': 'cela reč',
    replace: 'zameni',
    'replace all': 'zameni sve',
    close: 'zatvori',
    'current match': 'trenutno poklapanje',
    'replaced $ matches': 'zamenjeno poklapanja: $',
    'replaced match on line $': 'zamenjeno poklapanje u liniji $',
    'on line': 'u liniji',
    'Go to line': 'Idi na liniju',
    go: 'idi',
  },
  en: {},
};

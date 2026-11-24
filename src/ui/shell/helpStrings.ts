// Syntax help panel (T51). Serbian and English text; the code snippets use the keywords of the UI language.
import type { Locale } from '../../lang';

export interface HelpSection {
  title: string;
  /** Short explanation shown above the snippet. */
  text?: string;
  /** DSL snippet (monospace). */
  code?: string;
  /** Two-column table rows: [left, right]. */
  rows?: ReadonlyArray<readonly [string, string]>;
}

export interface HelpStrings {
  button: string;
  buttonTitle: string;
  title: string;
  close: string;
  intro: string;
  sections: readonly HelpSection[];
  footer: string;
}

export const HELP_STRINGS: Record<Locale, HelpStrings> = {
  sr: {
    button: '? Pomoć',
    buttonTitle: 'Pomoć za sintaksu (F1)',
    title: 'Pomoć za sintaksu',
    close: 'Zatvori pomoć',
    intro: 'Model je niz blokova: ključna reč, ime i redovi između { i }.',
    sections: [
      {
        title: 'Blok',
        code: '<vrsta> <Ime> {\n  <red>\n  <red>\n}',
        rows: [
          ['objekat', 'samo atributi; bar jedan # identifikator'],
          ['veza', 'tačno 2 učesnika sa kardinalnostima; ime _ = bez imena'],
          ['slab', 'jedan nadređeni X (DG,GG) + atributi sa #'],
          ['agregacija', 'bar 2 učesnika, atributi po želji'],
          ['specijalizacija', 'jedan nadtip X (DG,GG), bar 2 podtip Y'],
        ],
      },
      {
        title: 'Atribut',
        text: 'Ime[#] [: domen [ograničenje]] — # označava identifikator.',
        code: 'objekat Radnik {\n  Mlb#    : long NotNull\n  ImeR    : string\n  Starost : short Between 15,65\n}\n\nobjekat Student { BrojInd#, Ime, Smer }',
      },
      {
        title: 'Učesnik i kardinalnost',
        text: '[uloga] Objekat (DG,GG) [ImePreslikavanja]. DG je 0 ili 1, GG je 1 ili M. Kardinalnost pripada objektu u istom redu.',
        code: 'veza Zapošljavanje {\n  Radnik    (1,1) Radi\n  Odeljenje (0,M) Zapošljava\n}',
      },
      {
        title: 'Slab objekat',
        code: 'slab Isplata {\n  nadređeni Radnik (0,M)\n  Datum# : date\n  Iznos  : long\n}',
      },
      {
        title: 'Agregacija',
        code: 'agregacija Prijava {\n  Student (0,M)\n  Predmet (0,M)\n  Ocena : short Between 5,10\n}',
      },
      {
        title: 'Specijalizacija',
        code: 'specijalizacija Vrsta {\n  nadtip Građanin (0,M)\n  podtip Student\n  podtip Radnik\n}',
      },
      {
        title: 'Domeni i ograničenja',
        code: 'domen Naziv : string(40)\n\nograničenje RadnikUOdeljenju {\n  Radnik(SifOd) -> Odeljenje\n  Odeljenje : update cascades, delete restricted\n}',
      },
      {
        title: 'Ostalo',
        rows: [
          ['long short string date', 'ugrađeni domeni'],
          ['// tekst', 'komentar do kraja reda'],
          ['"Ime sa razmakom"', 'ime sa razmacima'],
          ['Ctrl+B', 'prikaži / sakrij tekst'],
          ['Ctrl+F', 'pretraga u editoru'],
          ['Ctrl+Z / Ctrl+Shift+Z', 'poništi / ponovi'],
        ],
      },
      {
        title: 'Ključne reči na engleskom',
        text: 'Mogu se mešati sa srpskim.',
        rows: [
          ['objekat', 'object'],
          ['veza', 'relationship'],
          ['slab', 'weak'],
          ['agregacija', 'aggregation'],
          ['specijalizacija', 'specialization'],
          ['nadređeni / nadredjeni', 'owner'],
          ['nadtip / podtip', 'supertype / subtype'],
          ['domen', 'domain'],
          ['ograničenje', 'constraint'],
          ['uslov', 'condition'],
        ],
      },
    ],
    footer: 'Gotovi modeli su u meniju „Primeri“.',
  },
  en: {
    button: '? Help',
    buttonTitle: 'Syntax help (F1)',
    title: 'Syntax help',
    close: 'Close help',
    intro: 'A model is a list of blocks: a keyword, a name and lines between { and }.',
    sections: [
      {
        title: 'Block',
        code: '<kind> <Name> {\n  <line>\n  <line>\n}',
        rows: [
          ['object', 'attributes only; at least one # identifier'],
          ['relationship', 'exactly 2 participants with cardinalities; name _ = unnamed'],
          ['weak', 'one owner X (DG,GG) + attributes with #'],
          ['aggregation', 'at least 2 participants, optional attributes'],
          ['specialization', 'one supertype X (DG,GG), at least 2 subtype Y'],
        ],
      },
      {
        title: 'Attribute',
        text: 'Name[#] [: domain [constraint]] — # marks an identifier.',
        code: 'object Employee {\n  Id#  : long NotNull\n  Name : string\n  Age  : short Between 15,65\n}\n\nobject Student { IndexNo#, Name, Major }',
      },
      {
        title: 'Participant and cardinality',
        text: '[role] Object (DG,GG) [MappingName]. DG is 0 or 1, GG is 1 or M. The cardinality belongs to the object on the same line.',
        code: 'relationship Employment {\n  Employee   (1,1) WorksIn\n  Department (0,M) Employs\n}',
      },
      {
        title: 'Weak object',
        code: 'weak Payment {\n  owner Employee (0,M)\n  Date#  : date\n  Amount : long\n}',
      },
      {
        title: 'Aggregation',
        code: 'aggregation Exam {\n  Student (0,M)\n  Course  (0,M)\n  Grade : short Between 5,10\n}',
      },
      {
        title: 'Specialization',
        code: 'specialization Kind {\n  supertype Person (0,M)\n  subtype Student\n  subtype Employee\n}',
      },
      {
        title: 'Domains and constraints',
        code: 'domain Title : string(40)\n\nconstraint EmployeeInDept {\n  Employee(DeptId) -> Department\n  Department : update cascades, delete restricted\n}',
      },
      {
        title: 'Other',
        rows: [
          ['long short string date', 'built-in domains'],
          ['// text', 'comment to the end of the line'],
          ['"Name with spaces"', 'name with spaces'],
          ['Ctrl+B', 'show / hide text'],
          ['Ctrl+F', 'search in the editor'],
          ['Ctrl+Z / Ctrl+Shift+Z', 'undo / redo'],
        ],
      },
      {
        title: 'Serbian keywords',
        text: 'Both can be mixed in one model.',
        rows: [
          ['object', 'objekat'],
          ['relationship', 'veza'],
          ['weak', 'slab'],
          ['aggregation', 'agregacija'],
          ['specialization', 'specijalizacija'],
          ['owner', 'nadređeni / nadredjeni'],
          ['supertype / subtype', 'nadtip / podtip'],
          ['domain', 'domen'],
          ['constraint', 'ograničenje'],
          ['condition', 'uslov'],
        ],
      },
    ],
    footer: 'Ready-made models are in the "Examples" menu.',
  },
};

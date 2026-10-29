// Owned by T02. Contract C08 §Examples: one minimal source per E/W code. Tests only.
import type { DiagnosticCode } from '../diagnostics';

const AB = `objekat A { Id# : long }
objekat B { Id# : long }
`;

export const ERROR_FIXTURES: { code: DiagnosticCode; title: string; source: string }[] = [
  {
    code: 'E01',
    title: 'Duplirano ime',
    source: `objekat A { Id# : long }
objekat A { Id# : long }
`,
  },
  {
    code: 'E02',
    title: 'Nedeklarisan učesnik',
    source: `${AB}veza V {
  A (0,M) a
  Nepostojeci (0,M) b
}
`,
  },
  {
    code: 'E03',
    title: 'Neispravna kardinalnost',
    source: `${AB}veza V {
  A (2,M) a
  B (0,M) b
}
`,
  },
  {
    code: 'E04',
    title: 'Veza sa 3 učesnika',
    source: `${AB}objekat C { Id# : long }
veza V {
  A (0,M) a
  B (0,M) b
  C (0,M) c
}
`,
  },
  {
    code: 'E05',
    title: 'Veza sa atributom',
    source: `${AB}veza V {
  A (0,M) a
  B (0,M) b
  Datum : date
}
`,
  },
  {
    code: 'E06',
    title: 'Slab bez nadređenog',
    source: `${AB}slab S {
  Br# : long
}
veza V {
  A (0,M) a
  B (0,M) b
}
`,
  },
  {
    code: 'E07',
    title: 'Specijalizacija sa jednim podtipom',
    source: `objekat A { Id# : long }
objekat B { X : long }
specijalizacija S {
  nadtip A (0,M)
  podtip B
}
`,
  },
  {
    code: 'E08',
    title: 'Agregacija sa jednom komponentom',
    source: `${AB}agregacija G {
  A (0,M)
  Datum : date
}
veza V {
  G (0,M) g
  B (0,M) b
}
`,
  },
  {
    code: 'E09',
    title: 'Ciklična specijalizacija',
    source: `objekat A { IdA# : long }
objekat B { IdB# : long }
objekat C { X : long }
specijalizacija S1 {
  nadtip A (0,M)
  podtip B
  podtip C
}
specijalizacija S2 {
  nadtip B (0,M)
  podtip A
  podtip C
}
`,
  },
  {
    code: 'E10',
    title: 'Objekat bez identifikatora',
    source: `objekat A { Id# : long }
objekat B { Naziv : string }
veza V {
  A (0,M) a
  B (0,M) b
}
`,
  },
  {
    code: 'E11',
    title: 'Podtip ponavlja identifikator',
    source: `objekat A { Id# : long }
objekat B { Id : long }
objekat C { X : long }
specijalizacija S {
  nadtip A (0,M)
  podtip B
  podtip C
}
`,
  },
  {
    code: 'E12',
    title: 'Učesnik u objektu',
    source: `objekat A {
  Id# : long
  B (0,M)
}
objekat B { Id# : long }
`,
  },
  {
    code: 'W01',
    title: 'Rekurzivna veza bez naziva preslikavanja',
    source: `objekat A { Id# : long }
veza V {
  A (0,M)
  A (0,M)
}
`,
  },
  {
    code: 'W02',
    title: 'Atribut bez domena',
    source: `objekat A { Id# }
`,
  },
  {
    code: 'W03',
    title: 'Objekat koji ne učestvuje u vezi',
    source: `objekat A { Id# : long }
`,
  },
  {
    code: 'W04',
    title: 'Dupliran atribut',
    source: `objekat A {
  Id# : long
  X : long
  X : long
}
`,
  },
];

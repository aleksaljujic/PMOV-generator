// FROZEN (T00). Example sources copied verbatim from spec/requrement.md — see contract C08 §Examples.

export interface Example {
  id: string;
  title: string;
  source: string;
}

export const EXAMPLES: Example[] = [
  {
    id: 'osnovni',
    title: 'Osnovni primer',
    source: `// ---------- objekti ----------
objekat Radnik {
  Mlb#    : long NotNull
  ImeR    : string
  Adresa  : string
  Starost : short Between 15,65
}

objekat Odeljenje {
  SifOd# : short Moduo_11
  Naziv  : string
}

objekat Student   { BrojInd#, Ime, Smer }
objekat Predmet   { SifPred#, NazivPred }
objekat Nastavnik { ŠifraNast#, ImeNast, Zvanje }

// ---------- veze ----------
veza Zapošljavanje {
  Radnik    (1,1) Radi
  Odeljenje (0,M) Zapošljava
}

veza Rukovođenje {
  Radnik    (0,1) Rukovodi
  Odeljenje (1,1) Rukovođeno
}

// ---------- slab objekat ----------
slab Isplata {
  nadređeni Radnik (0,M)
  Datum# : date
  Iznos  : long
}

// ---------- agregacija ----------
agregacija Prijava {
  Student (0,M)
  Predmet (0,M)
  DatumPol : date
  Ocena    : short Between 5,10
}

veza Overe {
  Prijava   (1,1)
  Nastavnik (0,M)
}
`,
  },
  {
    id: 'specijalizacija',
    title: 'Specijalizacija i rekurzivna veza',
    source: `objekat Građanin  { Mlb# : long, Ime : string, Starost : short }
objekat Student   { BrojInd : string, Semestar : short }
objekat Radnik    { Plata : long }
objekat Dete      { Dodatak : long }
objekat Penzioner { Penzija : long }
objekat Proizvod  { SifProizvoda#, NazivProizvoda }

specijalizacija Vrsta {
  nadtip Građanin (0,M)
  podtip Student
  podtip Radnik
  podtip Dete
  podtip Penzioner
}

veza Struktura {
  Proizvod (0,M) Sastavljen
  Proizvod (0,M) Ugrađen
}
`,
  },
];

export const DEFAULT_EXAMPLE_ID = 'osnovni';

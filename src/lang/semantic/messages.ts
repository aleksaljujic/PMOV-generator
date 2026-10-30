// Per-locale message templates for E01–E12 and W01–W04. Owned by T16. Contract C01 §English messages.
// `sr` text must stay byte-identical to the original Serbian messages.
import type { Locale } from '../diagnostics';

export interface Messages {
  locale: Locale;
  aboutCard: string;
  e01(name: string, line: number): string;
  e02(name: string): string;
  e03Invalid(min: string, max: string): string;
  e03Missing(name: string): string;
  e04Count(name: string, n: number): string;
  e04Role(role: string): string;
  e05(rel: string, attr: string): string;
  w01(name: string): string;
  e06Owner(name: string): string;
  e06Id(name: string): string;
  e07Base(name: string): string;
  e07Line(base: string, line: string): string;
  e07SubCard(base: string, name: string): string;
  e07Attr(base: string, name: string): string;
  e08Count(name: string, n: number): string;
  e08Card(comp: string, agg: string): string;
  e12(line: string, kind: 'objekat' | 'agregacija'): string;
  e09(path: string[]): string;
  w02(attr: string): string;
  w04(attr: string, block: string): string;
  e10(name: string): string;
  w03(name: string): string;
  e11(sub: string, attr: string, sup: string): string;
  // C10 (T23)
  e13(name: string): string;
  e14Dup(name: string, line: number): string;
  e14Builtin(name: string): string;
  e14Length(): string;
  e15(chain: string[]): string;
  e16(name: string): string;
  w05(name: string): string;
  e17NoHeader(c: string): string;
  e17ManyHeaders(c: string): string;
  e17EmptyCondition(c: string): string;
  e17NoRules(c: string): string;
  e17UnknownOp(c: string, op: string): string;
  e17BadAction(c: string, action: string | null): string;
  e17ChildDelete(c: string, rel: string): string;
  e17ParentInsert(c: string, rel: string): string;
  e17ActionNotAllowed(c: string, action: string, op: string, rel: string): string;
  e17DupOp(c: string, op: string, rel: string): string;
  e17ForeignRelation(c: string, rel: string): string;
  e17GeneralAction(c: string, action: string): string;
  e17DupName(c: string, line: number): string;
}

const sr: Messages = {
  locale: 'sr',
  aboutCard: 'DG mora biti 0 ili 1, GG mora biti 1 ili M, i DG ≤ GG.',
  e01: (name, line) => `ime '${name}' je već deklarisano u redu ${line}.`,
  e02: (name) => `'${name}' nije deklarisan objekat, slab objekat ni agregacija.`,
  e03Invalid: (min, max) => `neispravna kardinalnost (${min},${max}): ${sr.aboutCard}`,
  e03Missing: (name) => `nedostaje kardinalnost (DG,GG) uz '${name}': ${sr.aboutCard}`,
  e04Count: (name, n) => `veza '${name}' ima ${n} učesnika, a veza mora imati tačno 2. Za vezu više objekata koristi 'agregacija'.`,
  e04Role: (role) => `učesnik veze ne sme imati ulogu '${role}'.`,
  e05: (rel, attr) => `veza '${rel}' ne može imati atribut '${attr}'. Ako je to učesnik, dodaj kardinalnost (DG,GG); za vezu sa atributima koristi 'agregacija'.`,
  w01: (name) => `rekurzivna veza '${name}' treba da ima nazive preslikavanja za oba učesnika.`,
  e06Owner: (name) => `slab objekat '${name}' mora imati tačno jednog učesnika 'nadređeni X (DG,GG)'.`,
  e06Id: (name) => `slab objekat '${name}' mora imati bar jedan parcijalni identifikator (#).`,
  e07Base: (name) => `specijalizacija '${name}' mora imati tačno jedan 'nadtip X (DG,GG)' i bar dva 'podtip Y' (bez kardinalnosti), i ne sme imati atribute.`,
  e07Line: (base, line) => `${base} Red '${line}' nema ulogu nadtip ni podtip.`,
  e07SubCard: (base, name) => `${base} Podtip '${name}' ne sme imati kardinalnost.`,
  e07Attr: (base, name) => `${base} Atribut '${name}' nije dozvoljen.`,
  e08Count: (name, n) => `agregacija '${name}' ima ${n} komponenti, a mora imati bar 2.`,
  e08Card: (comp, agg) => `komponenta '${comp}' agregacije '${agg}' nema kardinalnost (DG,GG).`,
  e12: (line, kind) => `red '${line}' nije dozvoljen u bloku '${kind === 'objekat' ? 'objekat' : 'agregacija'}'.`,
  e09: (path) => `ciklična specijalizacija: ${path.join(' → ')}.`,
  w02: (attr) => `atribut '${attr}' nema domen.`,
  w04: (attr, block) => `atribut '${attr}' je već naveden u bloku '${block}'.`,
  e10: (name) => `objekat '${name}' nema identifikator (#). Svaki objekat koji nije podtip mora imati identifikator.`,
  w03: (name) => `objekat '${name}' ne učestvuje ni u jednoj vezi.`,
  e11: (sub, attr, sup) => `podtip '${sub}' ponavlja identifikator '${attr}' nadtipa '${sup}' — podtip ga nasleđuje.`,
  e13: (name) => `domen '${name}' nije deklarisan.`,
  e14Dup: (name, line) => `domen '${name}' je već deklarisan (red ${line}).`,
  e14Builtin: (name) => `domen se ne može zvati '${name}' jer je to ugrađeni tip.`,
  e14Length: () => `dužina je dozvoljena samo za tip 'string'.`,
  e15: (chain) => `domeni ${chain.map((c) => `'${c}'`).join(' → ')} čine ciklus.`,
  e16: (name) => `relacija '${name}' ne postoji.`,
  w05: (name) => `domen '${name}' se ne koristi.`,
  e17NoHeader: (c) => `ograničenje '${c}': nedostaje zaglavlje ('Dete -> Roditelj') ili red 'uslov:'.`,
  e17ManyHeaders: (c) => `ograničenje '${c}': dozvoljeno je tačno jedno zaglavlje, referencijalno ili opšte.`,
  e17EmptyCondition: (c) => `ograničenje '${c}': uslov je prazan.`,
  e17NoRules: (c) => `ograničenje '${c}': opšte ograničenje mora imati bar jedan red sa pravilom.`,
  e17UnknownOp: (c, op) => `ograničenje '${c}': nepoznata operacija '${op}' (INSERT, UPDATE ili DELETE).`,
  e17BadAction: (c, a) => a === null
    ? `ograničenje '${c}': nedostaje akcija (RESTRICTED, CASCADES, NULLIFIES ili DEFAULT).`
    : `ograničenje '${c}': nepoznata akcija '${a}' (RESTRICTED, CASCADES, NULLIFIES ili DEFAULT).`,
  e17ChildDelete: (c, r) => `ograničenje '${c}': DELETE nije dozvoljen za relaciju-dete '${r}'.`,
  e17ParentInsert: (c, r) => `ograničenje '${c}': INSERT nije dozvoljen za relaciju-roditelj '${r}'.`,
  e17ActionNotAllowed: (c, a, op, r) => `ograničenje '${c}': akcija ${a.toUpperCase()} nije dozvoljena za ${op.toUpperCase()} nad relacijom '${r}'.`,
  e17DupOp: (c, op, r) => `ograničenje '${c}': operacija ${op.toUpperCase()} za relaciju '${r}' je već navedena.`,
  e17ForeignRelation: (c, r) => `ograničenje '${c}': relacija '${r}' nije ni dete ni roditelj iz zaglavlja.`,
  e17GeneralAction: (c, a) => `ograničenje '${c}': opšte ograničenje dozvoljava samo akciju RESTRICTED, a ne ${a.toUpperCase()}.`,
  e17DupName: (c, line) => `ograničenje '${c}' je već deklarisano (red ${line}).`,
};

const en: Messages = {
  locale: 'en',
  aboutCard: 'min must be 0 or 1, max must be 1 or M, and min ≤ max.',
  e01: (name, line) => `name '${name}' is already declared on line ${line}.`,
  e02: (name) => `'${name}' is not a declared object, weak object or aggregation.`,
  e03Invalid: (min, max) => `invalid cardinality (${min},${max}): ${en.aboutCard}`,
  e03Missing: (name) => `missing cardinality (min,max) for '${name}': ${en.aboutCard}`,
  e04Count: (name, n) => `relationship '${name}' has ${n} participants, but a relationship must have exactly 2. Use 'aggregation' to connect more objects.`,
  e04Role: (role) => `a relationship participant must not have the role '${role}'.`,
  e05: (rel, attr) => `relationship '${rel}' cannot have the attribute '${attr}'. If it is a participant, add a cardinality (min,max); for a relationship with attributes use 'aggregation'.`,
  w01: (name) => `recursive relationship '${name}' should have mapping names for both participants.`,
  e06Owner: (name) => `weak object '${name}' must have exactly one participant 'owner X (min,max)'.`,
  e06Id: (name) => `weak object '${name}' must have at least one partial identifier (#).`,
  e07Base: (name) => `specialization '${name}' must have exactly one 'supertype X (min,max)' and at least two 'subtype Y' (without cardinality), and must not have attributes.`,
  e07Line: (base, line) => `${base} Line '${line}' has neither the supertype nor the subtype role.`,
  e07SubCard: (base, name) => `${base} Subtype '${name}' must not have a cardinality.`,
  e07Attr: (base, name) => `${base} Attribute '${name}' is not allowed.`,
  e08Count: (name, n) => `aggregation '${name}' has ${n} components, but must have at least 2.`,
  e08Card: (comp, agg) => `component '${comp}' of aggregation '${agg}' has no cardinality (min,max).`,
  e12: (line, kind) => `line '${line}' is not allowed in an '${kind === 'objekat' ? 'object' : 'aggregation'}' block.`,
  e09: (path) => `cyclic specialization: ${path.join(' → ')}.`,
  w02: (attr) => `attribute '${attr}' has no domain.`,
  w04: (attr, block) => `attribute '${attr}' is already listed in block '${block}'.`,
  e10: (name) => `object '${name}' has no identifier (#). Every object that is not a subtype must have an identifier.`,
  w03: (name) => `object '${name}' does not take part in any relationship.`,
  e11: (sub, attr, sup) => `subtype '${sub}' repeats the identifier '${attr}' of supertype '${sup}' — a subtype inherits it.`,
  e13: (name) => `domain '${name}' is not declared.`,
  e14Dup: (name, line) => `domain '${name}' is already declared (line ${line}).`,
  e14Builtin: (name) => `a domain cannot be named '${name}' because it is a built-in type.`,
  e14Length: () => `a length is allowed only for type 'string'.`,
  e15: (chain) => `domains ${chain.map((c) => `'${c}'`).join(' → ')} form a cycle.`,
  e16: (name) => `relation '${name}' does not exist.`,
  w05: (name) => `domain '${name}' is not used.`,
  e17NoHeader: (c) => `constraint '${c}': missing header ('Child -> Parent') or 'condition:' line.`,
  e17ManyHeaders: (c) => `constraint '${c}': exactly one header, referential or general, is allowed.`,
  e17EmptyCondition: (c) => `constraint '${c}': the condition is empty.`,
  e17NoRules: (c) => `constraint '${c}': a general constraint needs at least one rule line.`,
  e17UnknownOp: (c, op) => `constraint '${c}': unknown operation '${op}' (INSERT, UPDATE or DELETE).`,
  e17BadAction: (c, a) => a === null
    ? `constraint '${c}': missing action (RESTRICTED, CASCADES, NULLIFIES or DEFAULT).`
    : `constraint '${c}': unknown action '${a}' (RESTRICTED, CASCADES, NULLIFIES or DEFAULT).`,
  e17ChildDelete: (c, r) => `constraint '${c}': DELETE is not allowed for the child relation '${r}'.`,
  e17ParentInsert: (c, r) => `constraint '${c}': INSERT is not allowed for the parent relation '${r}'.`,
  e17ActionNotAllowed: (c, a, op, r) => `constraint '${c}': action ${a.toUpperCase()} is not allowed for ${op.toUpperCase()} on relation '${r}'.`,
  e17DupOp: (c, op, r) => `constraint '${c}': operation ${op.toUpperCase()} for relation '${r}' is already given.`,
  e17ForeignRelation: (c, r) => `constraint '${c}': relation '${r}' is neither the child nor the parent of the header.`,
  e17GeneralAction: (c, a) => `constraint '${c}': a general constraint allows only the action RESTRICTED, not ${a.toUpperCase()}.`,
  e17DupName: (c, line) => `constraint '${c}' is already declared (line ${line}).`,
};

const TABLES: Record<Locale, Messages> = { sr, en };

export function messagesFor(locale: Locale | undefined): Messages {
  return TABLES[locale ?? 'sr'] ?? sr;
}

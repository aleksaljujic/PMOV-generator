// FROZEN (T00). Example sources copied verbatim from spec/requrement.md — see contract C08 §Examples.
// English versions (`titleEn`, `sourceEn`) added for spec/fix_editor.md (CHANGELOG 2026-10-30): same model,
// English keywords and names.
// Fifth example `domeni` added for spec/feature_domain_strucutre.md (contract C10, CHANGELOG 2026-10-30).

export interface Example {
  id: string;
  title: string;
  source: string;
  /** English title for the "Examples" menu (EN UI). */
  titleEn?: string;
  /** Same model with English keywords and names; loaded when the UI language is EN. */
  sourceEn?: string;
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
    titleEn: 'Basic example',
    sourceEn: `// ---------- objects ----------
object Employee {
  EmpNo#  : long NotNull
  EmpName : string
  Address : string
  Age     : short Between 15,65
}

object Department {
  DeptNo#  : short Mod_11
  DeptName : string
}

object Student { IndexNo#, Name, Major }
object Course  { CourseNo#, CourseName }
object Teacher { TeacherNo#, TeacherName, Title }

// ---------- relationships ----------
relationship Employment {
  Employee   (1,1) WorksIn
  Department (0,M) Employs
}

relationship Management {
  Employee   (0,1) Manages
  Department (1,1) ManagedBy
}

// ---------- weak object ----------
weak Payment {
  owner Employee (0,M)
  Date#  : date
  Amount : long
}

// ---------- aggregation ----------
aggregation ExamRegistration {
  Student (0,M)
  Course  (0,M)
  ExamDate : date
  Grade    : short Between 5,10
}

relationship Certifies {
  ExamRegistration (1,1)
  Teacher          (0,M)
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
    titleEn: 'Specialization and recursive relationship',
    sourceEn: `object Citizen   { CitizenNo# : long, Name : string, Age : short }
object Student   { IndexNo : string, Semester : short }
object Employee  { Salary : long }
object Child     { Allowance : long }
object Pensioner { Pension : long }
object Product   { ProductNo#, ProductName }

specialization Kind {
  supertype Citizen (0,M)
  subtype Student
  subtype Employee
  subtype Child
  subtype Pensioner
}

relationship Structure {
  Product (0,M) ConsistsOf
  Product (0,M) PartOf
}
`,
  },
  {
    id: 'biblioteka',
    title: 'Biblioteka',
    source: `// ---------- objekti ----------
objekat Član {
  BrojČlanske#    : long NotNull
  Ime             : string
  Adresa          : string
  DatumUčlanjenja : date
}

objekat Knjiga {
  ISBN#         : string
  Naslov        : string
  GodinaIzdanja : short Between 1450,2100
}

objekat Autor    { ŠifraAutora# : long, ImeAutora : string }
objekat Izdavač  { ŠifraIzdavača# : short, Naziv : string }

objekat Zaposleni {
  JMBG# : long Moduo_11
  ImeZ  : string
  Plata : long
}

// podtipovi nemaju identifikator, nasleđuju JMBG
objekat Bibliotekar   { Smena : short In(1, 2, 3) }
objekat Administrator { Nivo : short }

// ---------- specijalizacija ----------
specijalizacija VrstaZaposlenog {
  nadtip Zaposleni (0,1)
  podtip Bibliotekar
  podtip Administrator
}

// ---------- slab objekat ----------
slab Primerak {
  nadređeni Knjiga (1,M)
  InventarniBroj# : long
  Stanje          : string In(Nov, Dobar, Oštećen)
}

// ---------- veze ----------
veza Izdaje {
  Izdavač (0,M) Izdaje
  Knjiga  (1,1) IzdataOd
}

// rekurzivna veza
veza Preporuka {
  Član (0,M) Preporučuje
  Član (0,1) PreporučenOd
}

// ---------- agregacije ----------
agregacija Autorstvo {
  Autor  (1,M)
  Knjiga (1,M)
  RedniBroj : short
}

agregacija Pozajmica {
  Član     (0,M)
  Primerak (0,M)
  DatumPozajmice# : date
  DatumVraćanja   : date
}

// agregacija kao učesnik veze
veza Odobrava {
  Pozajmica   (1,1) OdobrenaOd
  Bibliotekar (0,M) Odobrio
}
`,
    titleEn: 'Library',
    sourceEn: `// ---------- objects ----------
object Member {
  MemberNo# : long NotNull
  Name      : string
  Address   : string
  JoinDate  : date
}

object Book {
  ISBN#          : string
  BookTitle      : string
  PublishingYear : short Between 1450,2100
}

object Author    { AuthorNo# : long, AuthorName : string }
object Publisher { PublisherNo# : short, PublisherName : string }

object Staff {
  PersonalID# : long Mod_11
  StaffName   : string
  Salary      : long
}

// subtypes have no identifier, they inherit PersonalID
object Librarian     { Shift : short In(1, 2, 3) }
object Administrator { Level : short }

// ---------- specialization ----------
specialization StaffKind {
  supertype Staff (0,1)
  subtype Librarian
  subtype Administrator
}

// ---------- weak object ----------
weak Copy {
  owner Book (1,M)
  InventoryNo# : long
  Condition    : string In(New, Good, Damaged)
}

// ---------- relationships ----------
relationship Publishing {
  Publisher (0,M) Publishes
  Book      (1,1) PublishedBy
}

// recursive relationship
relationship Recommendation {
  Member (0,M) Recommends
  Member (0,1) RecommendedBy
}

// ---------- aggregations ----------
aggregation Authorship {
  Author (1,M)
  Book   (1,M)
  OrdinalNo : short
}

aggregation Loan {
  Member (0,M)
  Copy   (0,M)
  LoanDate#  : date
  ReturnDate : date
}

// aggregation as a participant of a relationship
relationship Approval {
  Loan      (1,1) ApprovedBy
  Librarian (0,M) Approved
}
`,
  },
  {
    id: 'proizvodnja',
    title: 'Proizvodnja po porudžbini',
    source: `// Proizvodnja po porudžbini kupca — od komercijalnog naloga do računa.
// Konceptualni model fizičke šeme: tabela ProcesPracenje, «denorm» kolone,
// trigeri i indeksi su fizički nivo i ovde se ne modeluju. decimal → long.

// ---------- šifarnici ----------
objekat Artikal {
  Šifra#     : string
  Naziv      : string
  Tip        : string In(proizvod, materijal)
  JM         : string
  NetoTežina : long
  EAN        : string
}

objekat Radnik  { RadnikID# : long, ImePrezime : string, Funkcija : string }
objekat Mesto   { MestoID# : long, NazivMesta : string, PoštanskiBroj : string, Država : string }

objekat Partner {
  PartnerID#  : long
  NazivPartnera : string
  Adresa      : string
  PIB         : string
  MatičniBroj : string
}

veza Lokacija {
  Partner (1,1) NalaziSeU
  Mesto   (0,M) MestoPartnera
}

// ---------- 1 prodaja ----------
objekat KomercijalniNalog {
  BrojKN#         : string
  DatumKN         : date
  RokIsporuke     : date
  KoličinaKN      : long
  Cena            : long
  PorudžbinaKupca : string
  Batch           : string
  KomPoKutiji     : long
  KutijaPoPaleti  : long
  MaxVisinaPalete : long
  StatusKN        : string
}

veza Narudžbina {
  Partner           (0,M) Naručuje
  KomercijalniNalog (1,1) NaručenOd
}

veza NaručeniArtikal {
  Artikal           (0,M) Naručen
  KomercijalniNalog (1,1) ZaArtikal
}

// ---------- 2 proizvodnja ----------
objekat RadniNalog {
  BrojRN#        : string
  KoličinaRN     : long
  DatumOtvaranja : date
  RokZavršetka   : date
  PlanPoSmeni    : long
  StatusRN       : string
  Napomena       : string
}

veza Realizacija {
  KomercijalniNalog (0,M) RealizujeSe
  RadniNalog        (1,1) Realizuje
}

// rekurzivna veza
veza Uzorak {
  RadniNalog (0,M) JeUzorakZa
  RadniNalog (0,1) PoUzorku
}

veza Otvaranje {
  Radnik     (0,M) Otvorio
  RadniNalog (1,1) OtvorenOd
}

veza Odobravanje {
  Radnik     (0,M) Odobrio
  RadniNalog (0,1) OdobrenOd
}

veza Puštanje {
  Radnik     (0,M) Pustio
  RadniNalog (0,1) PuštenOd
}

// ukupno trebovanje materijala po radnom nalogu
agregacija Normativ {
  RadniNalog (1,M)
  Artikal    (0,M)
  PlaniranaKoličina : long
}

objekat Trebovanje {
  TrebovanjeID#      : long
  TipTrebovanja      : string In(trebovanje, povratnica)
  DatumTrebovanja    : date
  Šarža              : string
  KoličinaTrebovanja : long
}

veza TrebovanjeNaloga {
  RadniNalog (0,M) Trebuje
  Trebovanje (1,1) ZaNalog
}

veza TrebovaniMaterijal {
  Artikal    (0,M) Trebovan
  Trebovanje (1,1) ZaMaterijal
}

veza Izdavanje {
  Radnik     (0,M) Izdao
  Trebovanje (1,1) IzdaoRadnik
}

veza Primanje {
  Radnik     (0,M) Primio
  Trebovanje (0,1) PrimioRadnik
}

// ---------- 3 magacin ----------
objekat SerijaGotovih {
  SerijskiBroj#   : string
  DatumPrijema    : date
  KoličinaSerije  : long
}

veza PrijemNaStanje {
  RadniNalog    (0,M) Proizveo
  SerijaGotovih (1,1) IzNaloga
}

// ---------- 4 isporuka ----------
objekat Otpremnica {
  BrojOtpremnice# : string
  DatumOtpreme    : date
  RegBrojVozila   : string
}

veza Otprema {
  Partner    (0,M) Prima
  Otpremnica (1,1) Kupcu
}

veza Istovar {
  Partner    (0,M) MestoIstovara
  Otpremnica (0,1) IstovarU
}

veza OdgovornaOsoba {
  Radnik     (0,M) OdgovaraZa
  Otpremnica (1,1) Odgovorni
}

slab OtpStavka {
  nadređeni Otpremnica (1,M)
  RbOtp#        : short
  KoličinaOtp   : long
  BrojPaleta    : short
}

veza OtpremaSerije {
  SerijaGotovih (0,M) Otpremljena
  OtpStavka     (1,1) OtpSerija
}

// ---------- 5 fakturisanje ----------
objekat Račun {
  BrojRačuna#     : string
  DatumRačuna     : date
  ValutaPlaćanja  : date
  OznakaValute    : string
  Kurs            : long
  Paritet         : string
  StatusRačuna    : string In(placen, neplacen)
}

veza Fakturisanje {
  Otpremnica (0,1) Fakturisana
  Račun      (1,1) ZaOtpremnicu
}

veza KupacRačuna {
  Partner (0,M) Plaća
  Račun   (1,1) Kupac
}

slab RačunStavka {
  nadređeni Račun (1,M)
  RbRačuna#      : short
  KoličinaRačuna : long
  CenaStavke     : long
  RabatProc      : short
  StopaPDV       : short
}

veza FakturisanjeSerije {
  SerijaGotovih (0,M) Fakturisana
  RačunStavka   (1,1) FakturisanaSerija
}
`,
    titleEn: 'Make-to-order production',
    sourceEn: `// Make-to-order production — from the sales order to the invoice.
// Conceptual model of the physical schema: the ProcessTracking table, «denorm» columns,
// triggers and indexes belong to the physical level and are not modelled here. decimal → long.

// ---------- code lists ----------
object Item {
  Code#     : string
  ItemName  : string
  Type      : string In(product, material)
  UoM       : string
  NetWeight : long
  EAN       : string
}

object Worker { WorkerID# : long, FullName : string, Position : string }
object Place  { PlaceID# : long, PlaceName : string, PostalCode : string, Country : string }

object Partner {
  PartnerID#  : long
  PartnerName : string
  Address     : string
  TaxID       : string
  RegNo       : string
}

relationship Location {
  Partner (1,1) LocatedIn
  Place   (0,M) PartnerPlace
}

// ---------- 1 sales ----------
object SalesOrder {
  SONo#           : string
  SODate          : date
  DeliveryDue     : date
  SOQuantity      : long
  Price           : long
  CustomerPO      : string
  Batch           : string
  PcsPerBox       : long
  BoxesPerPallet  : long
  MaxPalletHeight : long
  SOStatus        : string
}

relationship Ordering {
  Partner    (0,M) Orders
  SalesOrder (1,1) OrderedBy
}

relationship OrderedItem {
  Item       (0,M) Ordered
  SalesOrder (1,1) ForItem
}

// ---------- 2 production ----------
object WorkOrder {
  WONo#        : string
  WOQuantity   : long
  OpenDate     : date
  DueDate      : date
  PlanPerShift : long
  WOStatus     : string
  Note         : string
}

relationship Fulfilment {
  SalesOrder (0,M) FulfilledBy
  WorkOrder  (1,1) Fulfils
}

// recursive relationship
relationship Sample {
  WorkOrder (0,M) IsSampleFor
  WorkOrder (0,1) BySample
}

relationship Opening {
  Worker    (0,M) Opened
  WorkOrder (1,1) OpenedBy
}

relationship Approval {
  Worker    (0,M) Approved
  WorkOrder (0,1) ApprovedBy
}

relationship Release {
  Worker    (0,M) Released
  WorkOrder (0,1) ReleasedBy
}

// total material requirement per work order
aggregation BillOfMaterials {
  WorkOrder (1,M)
  Item      (0,M)
  PlannedQuantity : long
}

object Requisition {
  RequisitionID#  : long
  RequisitionType : string In(requisition, return)
  RequisitionDate : date
  Lot             : string
  RequisitionQty  : long
}

relationship OrderRequisition {
  WorkOrder   (0,M) Requires
  Requisition (1,1) ForOrder
}

relationship RequisitionedMaterial {
  Item        (0,M) Requisitioned
  Requisition (1,1) ForMaterial
}

relationship Issuing {
  Worker      (0,M) Issued
  Requisition (1,1) IssuedBy
}

relationship Receiving {
  Worker      (0,M) Received
  Requisition (0,1) ReceivedBy
}

// ---------- 3 warehouse ----------
object FinishedLot {
  SerialNo#   : string
  ReceiptDate : date
  LotQuantity : long
}

relationship StockReceipt {
  WorkOrder   (0,M) Produced
  FinishedLot (1,1) FromOrder
}

// ---------- 4 delivery ----------
object DeliveryNote {
  DeliveryNoteNo# : string
  ShipDate        : date
  VehicleRegNo    : string
}

relationship Shipment {
  Partner      (0,M) Receives
  DeliveryNote (1,1) ToCustomer
}

relationship Unloading {
  Partner      (0,M) UnloadingPlace
  DeliveryNote (0,1) UnloadedAt
}

relationship ResponsiblePerson {
  Worker       (0,M) ResponsibleFor
  DeliveryNote (1,1) Responsible
}

weak DeliveryLine {
  owner DeliveryNote (1,M)
  DlLineNo#   : short
  DlQuantity  : long
  PalletCount : short
}

relationship LotShipment {
  FinishedLot  (0,M) Shipped
  DeliveryLine (1,1) ShippedLot
}

// ---------- 5 invoicing ----------
object Invoice {
  InvoiceNo#    : string
  InvoiceDate   : date
  PaymentDue    : date
  CurrencyCode  : string
  ExchangeRate  : long
  Incoterm      : string
  InvoiceStatus : string In(paid, unpaid)
}

relationship Invoicing {
  DeliveryNote (0,1) Invoiced
  Invoice      (1,1) ForDeliveryNote
}

relationship InvoiceCustomer {
  Partner (0,M) Pays
  Invoice (1,1) Customer
}

weak InvoiceLine {
  owner Invoice (1,M)
  InvLineNo#  : short
  InvQuantity : long
  LinePrice   : long
  DiscountPct : short
  VatRate     : short
}

relationship LotInvoicing {
  FinishedLot (0,M) Invoiced
  InvoiceLine (1,1) InvoicedLot
}
`,
  },
  {
    id: 'domeni',
    title: 'Domeni i ograničenja',
    source: `// ---------- domeni ----------
domen Šifra   : short Moduo_11
domen Naziv   : string(40)
domen Starost : short Between 15,65
domen Iznos   : long >= 0
domen Ocena   : short Between 5,10

// ---------- objekti ----------
objekat Radnik {
  Mlb#    : long NotNull
  ImeR    : Naziv
  Adresa  : string
  Starost : Starost
  Plata   : Iznos NotNull
}

objekat Odeljenje {
  SifOd# : Šifra
  Naziv  : Naziv
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

slab Isplata {
  nadređeni Radnik (0,M)
  Datum# : date
  Iznos  : Iznos
}

agregacija Prijava {
  Student (0,M)
  Predmet (0,M)
  DatumPol : date
  Ocena    : Ocena
}

veza Overe {
  Prijava   (1,1)
  Nastavnik (0,M)
}

// ---------- ograničenja ----------
ograničenje RadnikUOdeljenju {
  Radnik(SifOd) -> Odeljenje
  Odeljenje : update cascades, delete restricted
}

ograničenje IsplateRadnika {
  Isplata -> Radnik
  Radnik : delete restricted
}

ograničenje IsplataDoPlate {
  uslov: Isplata.Iznos <= Radnik.Plata
  Isplata : insert restricted, update restricted
  Radnik  : update restricted
}
`,
    titleEn: 'Domains and constraints',
    sourceEn: `// ---------- domains ----------
domain Code   : short Mod_11
domain Title  : string(40)
domain Age    : short Between 15,65
domain Amount : long >= 0
domain Grade  : short Between 5,10

// ---------- objects ----------
object Employee {
  EmpNo#  : long NotNull
  EmpName : Title
  Address : string
  Age     : Age
  Salary  : Amount NotNull
}

object Department {
  DeptNo#  : Code
  DeptName : Title
}

object Student { IndexNo#, Name, Major }
object Course  { CourseNo#, CourseName }
object Teacher { TeacherNo#, TeacherName, Title }

// ---------- relationships ----------
relationship Employment {
  Employee   (1,1) WorksIn
  Department (0,M) Employs
}

relationship Management {
  Employee   (0,1) Manages
  Department (1,1) ManagedBy
}

weak Payment {
  owner Employee (0,M)
  Date#  : date
  Amount : Amount
}

aggregation ExamRegistration {
  Student (0,M)
  Course  (0,M)
  ExamDate : date
  Grade    : Grade
}

relationship Certifies {
  ExamRegistration (1,1)
  Teacher          (0,M)
}

// ---------- constraints ----------
constraint EmployeeInDepartment {
  Employee(DeptNo) -> Department
  Department : update cascades, delete restricted
}

constraint EmployeePayments {
  Payment -> Employee
  Employee : delete restricted
}

constraint PaymentUpToSalary {
  condition: Payment.Amount <= Employee.Salary
  Payment  : insert restricted, update restricted
  Employee : update restricted
}
`,
  },
];

export const DEFAULT_EXAMPLE_ID = 'osnovni';

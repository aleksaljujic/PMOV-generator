// UI strings of the interactive builder overlay, per locale. Both tables must have the same keys.
import type { Locale } from '../../lang';

export interface BuilderStrings {
  add: string;
  addAttribute: string;
  needsIdHint: string;
  newObject: string;
  existingElement: string;
  deleteLabel: string;
  addSubtype: string;
  menuObject: string;
  menuRelationship: string;
  menuWeak: string;
  menuAggregation: string;
  menuSpecialization: string;
  addComponent: string;
  nameAria: string;
  badName: string;
  attributeAria: string;
  attrName: string;
  attrIdentifier: string;
  attrDomain: string;
  attrConstraint: string;
  cancel: string;
  save: string;
  edgeAria: string;
  cardinalityAria: string;
  mapping: string;
  specName: string;
  pickStatus: string;
  confirmAria: string;
  unnamed: string;
  kindObject: string;
  kindWeak: string;
  kindRelationship: string;
  kindAggregation: string;
  kindSpecialization: string;
  // C10
  attrLength: string;
  userDomains: string;
  newDomain: string;
  domainFormAria: string;
  domainName: string;
  domainBase: string;
  domainLength: string;
  domainConstraint: string;
  constraintLabel: string;
}

export const BUILDER_STRINGS: Record<Locale, BuilderStrings> = {
  sr: {
    add: 'Dodaj',
    addAttribute: '+ atribut',
    needsIdHint: 'Dodaj identifikator (#)',
    newObject: 'Novi objekat',
    existingElement: 'Postojeći element…',
    deleteLabel: 'Obriši',
    addSubtype: 'Dodaj podtip',
    menuObject: 'Objekat',
    menuRelationship: 'Veza',
    menuWeak: 'Slab objekat',
    menuAggregation: 'Agregacija',
    menuSpecialization: 'Specijalizacija',
    addComponent: 'Dodaj komponentu',
    nameAria: 'Ime',
    badName: 'Neispravno ime.',
    attributeAria: 'Atribut',
    attrName: 'Naziv',
    attrIdentifier: 'Identifikator (#)',
    attrDomain: 'Domen',
    attrConstraint: 'Ograničenje',
    cancel: 'Otkaži',
    save: 'Sačuvaj',
    edgeAria: 'Veza',
    cardinalityAria: 'Kardinalnost',
    mapping: 'Preslikavanje',
    specName: 'Ime',
    pickStatus: 'Izaberite element (Esc za otkazivanje)',
    confirmAria: 'Potvrda',
    unnamed: '(bez imena)',
    kindObject: 'objekat',
    kindWeak: 'slab',
    kindRelationship: 'veza',
    kindAggregation: 'agregacija',
    kindSpecialization: 'specijalizacija',
    attrLength: 'Dužina',
    userDomains: 'Korisnički domeni',
    newDomain: 'Novi domen…',
    domainFormAria: 'Novi domen',
    domainName: 'Naziv domena',
    domainBase: 'Tip / nadređeni domen',
    domainLength: 'Dužina',
    domainConstraint: 'Ograničenje domena',
    constraintLabel: 'Ograničenja',
  },
  en: {
    add: 'Add',
    addAttribute: '+ attribute',
    needsIdHint: 'Add an identifier (#)',
    newObject: 'New object',
    existingElement: 'Existing element…',
    deleteLabel: 'Delete',
    addSubtype: 'Add subtype',
    menuObject: 'Object',
    menuRelationship: 'Relationship',
    menuWeak: 'Weak object',
    menuAggregation: 'Aggregation',
    menuSpecialization: 'Specialization',
    addComponent: 'Add component',
    nameAria: 'Name',
    badName: 'Invalid name.',
    attributeAria: 'Attribute',
    attrName: 'Name',
    attrIdentifier: 'Identifier (#)',
    attrDomain: 'Domain',
    attrConstraint: 'Constraint',
    cancel: 'Cancel',
    save: 'Save',
    edgeAria: 'Relationship',
    cardinalityAria: 'Cardinality',
    mapping: 'Mapping',
    specName: 'Name',
    pickStatus: 'Pick an element (Esc to cancel)',
    confirmAria: 'Confirmation',
    unnamed: '(unnamed)',
    kindObject: 'object',
    kindWeak: 'weak',
    kindRelationship: 'relationship',
    kindAggregation: 'aggregation',
    kindSpecialization: 'specialization',
    attrLength: 'Length',
    userDomains: 'User domains',
    newDomain: 'New domain…',
    domainFormAria: 'New domain',
    domainName: 'Domain name',
    domainBase: 'Type / parent domain',
    domainLength: 'Length',
    domainConstraint: 'Domain constraint',
    constraintLabel: 'Constraints',
  },
};

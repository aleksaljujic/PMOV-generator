// Public entry of src/rm — owned by T03. Contract C04.
export * from './types';
export { generateRelationalModel, dg0ToggleableVezas } from './model';
export { formatRelation, formatModelText } from './format';
export { generateSql } from './sql';
export { buildDomainTable } from './domain';

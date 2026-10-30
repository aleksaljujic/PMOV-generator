// Owned by T19. UI strings of the shell, Serbian (today's exact text) and English. Same keys in both tables.
import type { Locale } from '../../lang';

export interface ShellStrings {
  examples: string;
  showText: string;
  hideText: string;
  newDiagram: string;
  undo: string;
  redo: string;
  relayout: string;
  exportSvg: string;
  exportPng: string;
  language: string;
  tabDiagram: string;
  tabDomains: string;
  tabRm: string;
  tabConstraints: string;
  tabSql: string;
  errorsTitle: string;
  noErrors: string;
  sourceText: string;
  resizeEditor: string;
  confirmNew: string;
  confirmExample: string;
  exportFailed: string;
  exportJson: string;
  importJson: string;
  confirmImport: string;
  importedFromModel: string;
  syntaxBanner: string;
  openText: string;
}

export const SHELL_STRINGS: Record<Locale, ShellStrings> = {
  sr: {
    examples: 'Primeri',
    showText: 'Prikaži tekst (Ctrl+B)',
    hideText: 'Sakrij tekst (Ctrl+B)',
    newDiagram: 'Novi dijagram',
    undo: 'Poništi',
    redo: 'Ponovi',
    relayout: 'Ponovo rasporedi',
    exportSvg: 'Izvezi SVG',
    exportPng: 'Izvezi PNG',
    language: 'Jezik',
    tabDiagram: 'Dijagram',
    tabDomains: 'Domeni',
    tabRm: 'Relacioni model',
    tabConstraints: 'Ograničenja',
    tabSql: 'SQL',
    errorsTitle: 'Greške i upozorenja',
    noErrors: 'Nema grešaka.',
    sourceText: 'Izvorni tekst',
    resizeEditor: 'Promeni širinu editora',
    confirmNew: 'Trenutni dijagram će biti zamenjen. Nastaviti?',
    confirmExample: 'Izmenjeni tekst će biti zamenjen primerom. Nastaviti?',
    exportFailed: 'Izvoz nije uspeo',
    exportJson: 'Izvezi JSON',
    importJson: 'Uvezi JSON',
    confirmImport: 'Trenutni dijagram će biti zamenjen uvezenim. Nastaviti?',
    importedFromModel: 'Dijagram je uvezen iz modela; DSL tekst je generisan.',
    syntaxBanner: 'Dijagram ima sintaksne greške. Ispravite ih u tekstualnom režimu.',
    openText: 'Otvori tekst',
  },
  en: {
    examples: 'Examples',
    showText: 'Show text (Ctrl+B)',
    hideText: 'Hide text (Ctrl+B)',
    newDiagram: 'New diagram',
    undo: 'Undo',
    redo: 'Redo',
    relayout: 'Re-layout',
    exportSvg: 'Export SVG',
    exportPng: 'Export PNG',
    language: 'Language',
    tabDiagram: 'Diagram',
    tabDomains: 'Domains',
    tabRm: 'Relational model',
    tabConstraints: 'Constraints',
    tabSql: 'SQL',
    errorsTitle: 'Errors and warnings',
    noErrors: 'No errors.',
    sourceText: 'Source text',
    resizeEditor: 'Resize editor',
    confirmNew: 'The current diagram will be replaced. Continue?',
    confirmExample: 'The edited text will be replaced by the example. Continue?',
    exportFailed: 'Export failed',
    exportJson: 'Export JSON',
    importJson: 'Import JSON',
    confirmImport: 'The current diagram will be replaced by the imported one. Continue?',
    importedFromModel: 'The diagram was imported from the model; the DSL text was generated.',
    syntaxBanner: 'The diagram has syntax errors. Fix them in text mode.',
    openText: 'Open text',
  },
};

// Shared searchable dropdown (CHANGELOG 2026-10-30, C00 `src/ui/common/`): a text input that filters a listbox.
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Locale } from '../../lang';
import './combobox.css';

export interface ComboOption {
  value: string;
  label: string;
  /** Options with the same group are listed under one heading (consecutive options only). */
  group?: string;
  disabled?: boolean;
  title?: string;
  /** Always listed, whatever is typed (e.g. "New domain…"). */
  pinned?: boolean;
}

export interface ComboboxProps {
  options: readonly ComboOption[];
  value: string;
  onChange(value: string): void;
  'aria-label'?: string;
  className?: string;
  placeholder?: string;
  locale?: Locale;
}

const STRINGS: Record<Locale, { noMatches: string }> = {
  sr: { noMatches: 'Nema rezultata' },
  en: { noMatches: 'No matches' },
};

const MAX_LIST_HEIGHT = 260;

/** Lowercase without diacritics, so `sifra` finds `Šifra` and `dj`/`d` find `đ`. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase();
}

export function filterOptions(options: readonly ComboOption[], query: string): ComboOption[] {
  const q = fold(query.trim());
  return q === '' ? [...options] : options.filter((o) => o.pinned || fold(o.label).includes(q));
}

export function Combobox(props: ComboboxProps): JSX.Element {
  const { options, value, onChange, locale = 'sr' } = props;
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  /** Typed text; null while the user has not typed since opening (then every option is listed). */
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<React.CSSProperties | null>(null);

  const selected = options.find((o) => o.value === value);
  const shown = query === null ? [...options] : filterOptions(options, query);
  const pickable = (i: number) => shown[i] !== undefined && !shown[i]!.disabled;

  const firstFor = (opts: ComboOption[], q: string | null): number => {
    if (q !== null) {
      const exact = opts.findIndex((o) => !o.disabled && fold(o.label) === fold(q.trim()));
      if (exact >= 0) return exact;
      const hit = opts.findIndex((o) => !o.disabled && !o.pinned);
      if (hit >= 0) return hit;
    }
    const cur = opts.findIndex((o) => o.value === value && !o.disabled);
    return cur >= 0 ? cur : opts.findIndex((o) => !o.disabled);
  };

  const show = (q: string | null) => {
    setQuery(q);
    setActive(firstFor(q === null ? [...options] : filterOptions(options, q), q));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setQuery(null);
  };
  const pick = (o: ComboOption | undefined) => {
    if (!o || o.disabled) return;
    close();
    onChange(o.value); // also when unchanged: picking the same example reloads it
  };
  const move = (step: 1 | -1) => {
    if (!open) return show(null);
    for (let i = active + step, n = 0; n < shown.length; i += step, n++) {
      const j = (i + shown.length) % shown.length;
      if (pickable(j)) return setActive(j);
    }
  };

  // The list is portalled to <body> (builder popups clip and transform their content), so follow the input.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = input.current?.getBoundingClientRect();
      if (!r) return;
      // Open downwards unless the input sits near the bottom of the window (builder popups often do).
      const below = window.innerHeight - r.bottom - 8;
      const above = r.top - 8;
      const down = below >= MAX_LIST_HEIGHT || below >= above;
      setPos({
        left: r.left,
        minWidth: r.width,
        maxHeight: Math.max(80, Math.min(MAX_LIST_HEIGHT, down ? below : above)),
        ...(down ? { top: r.bottom + 2 } : { bottom: window.innerHeight - r.top + 2 }),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, listId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (e.key === 'ArrowDown') {
      handled();
      move(1);
    } else if (e.key === 'ArrowUp') {
      handled();
      move(-1);
    } else if (e.key === 'Enter' && open) {
      // Enter on a closed list falls through (submits the surrounding form).
      handled();
      pick(shown[active]);
    } else if (e.key === 'Escape' && open) {
      handled();
      close();
    } else if (e.key === 'Tab') {
      close();
    }
  };

  // Option ids use the index in `shown`; group headings are extra <li>s between them.
  let lastGroup: string | undefined;
  const items: JSX.Element[] = [];
  shown.forEach((o, i) => {
    if (o.group !== lastGroup && o.group !== undefined)
      items.push(<li key={`g:${o.group}:${i}`} className="pmov-combo-group" role="presentation">{o.group}</li>);
    lastGroup = o.group;
    items.push(
      <li
        key={o.value}
        id={`${listId}-${i}`}
        role="option"
        data-value={o.value}
        aria-selected={o.value === value}
        aria-disabled={o.disabled || undefined}
        title={o.title}
        className={'pmov-combo-option' + (i === active ? ' is-active' : '') + (o.disabled ? ' is-disabled' : '')}
        onMouseDown={(e) => {
          e.preventDefault(); // keep focus in the input
          e.stopPropagation();
        }}
        onMouseEnter={() => pickable(i) && setActive(i)}
        onClick={(e) => {
          e.stopPropagation();
          pick(o);
        }}
      >
        {o.label}
      </li>,
    );
  });

  return (
    <span className="pmov-combo">
      <input
        ref={input}
        type="text"
        role="combobox"
        aria-label={props['aria-label']}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        className={props.className}
        placeholder={props.placeholder}
        data-value={value}
        value={open && query !== null ? query : (selected?.label ?? '')}
        onChange={(e) => show(e.target.value)}
        onMouseDown={() => !open && show(null)}
        onFocus={(e) => {
          e.target.select();
          if (!open) show(null);
        }}
        onBlur={close}
        onKeyDown={onKeyDown}
      />
      {open &&
        createPortal(
          <ul
            id={listId}
            role="listbox"
            aria-label={props['aria-label']}
            className="pmov-combo-list"
            style={pos ?? undefined}
          >
            {items.length > 0 ? items : <li className="pmov-combo-empty">{STRINGS[locale].noMatches}</li>}
          </ul>,
          document.body,
        )}
    </span>
  );
}

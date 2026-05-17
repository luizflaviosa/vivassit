'use client';

// Renderiza formulario dinamico a partir de form_fields declarativos do template.
// Cobre: text, textarea, date, time, number, select, radio, checkbox, tag-list,
// cid-search, tuss-search, array (subforms), group (visual grouping).
//
// Usado por NovoDocView (criar doc) e DocDetailView (editar draft).

import { useEffect, useState } from 'react';
import { Plus, Trash2, Search, X, Loader2, Calculator, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { FormField } from '@/lib/docs-templates';

interface Props {
  fields: FormField[];
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

const INPUT_CLASS =
  'w-full h-11 px-3 bg-white text-[14px] rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400';
const TEXTAREA_CLASS =
  'w-full px-3 py-2.5 bg-white text-[14px] rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 resize-y';
const LABEL_CLASS = 'block text-[13px] font-medium text-zinc-700 mb-1.5';
const HINT_CLASS = 'block text-[11px] text-zinc-500 mt-1';

export function DynamicDocForm({ fields, value, onChange }: Props) {
  function set(name: string, v: unknown) {
    onChange({ ...value, [name]: v });
  }

  return (
    <div className="space-y-5">
      {fields.map((f, i) => (
        <FieldRenderer key={('name' in f ? f.name : `g${i}`) + i} field={f} value={value} setField={set} parent={value} />
      ))}
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  setField,
  parent,
}: {
  field: FormField;
  value: Record<string, unknown>;
  setField: (name: string, v: unknown) => void;
  parent: Record<string, unknown>;
}) {
  if (field.type === 'group') {
    if (field.show && !field.show(parent)) return null;
    return (
      <div className="space-y-3 p-4 rounded-xl bg-zinc-50/60 border border-black/[0.04]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">{field.label}</p>
        {field.fields.map((sub, i) => (
          <FieldRenderer
            key={('name' in sub ? sub.name : `s${i}`) + i}
            field={sub}
            value={value}
            setField={setField}
            parent={parent}
          />
        ))}
      </div>
    );
  }

  // Conditional show
  if (field.show && !field.show(parent)) return null;

  // Derived é um badge calculado, não tem input/required/value — handle antes.
  if (field.type === 'derived') {
    const text = field.compute(parent);
    if (!text) return null;
    const tone = field.tone ?? 'neutral';
    const styles = {
      neutral: { bg: 'bg-zinc-50', border: 'border-zinc-200', text: 'text-zinc-700', icon: <Calculator className="w-3.5 h-3.5" /> },
      info:    { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-900', icon: <Info className="w-3.5 h-3.5" /> },
      warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
      success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    }[tone];
    return (
      <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${styles.bg} ${styles.border} ${styles.text}`}>
        <span className="mt-0.5 flex-shrink-0">{styles.icon}</span>
        <div className="flex-1 text-[12px] leading-snug">
          <span className="block font-semibold mb-0.5">{field.label}</span>
          <span>{text}</span>
        </div>
      </div>
    );
  }

  const v = value[field.name];
  const label = (
    <>
      <label className={LABEL_CLASS}>
        {field.label}
        {field.required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {field.hint && <span className={HINT_CLASS}>{field.hint}</span>}
    </>
  );

  switch (field.type) {
    case 'text':
      return (
        <div>
          {label}
          <input
            type="text"
            value={(v as string) ?? ''}
            placeholder={field.placeholder}
            onChange={(e) => setField(field.name, e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      );

    case 'textarea':
      return (
        <div>
          {label}
          <textarea
            value={(v as string) ?? ''}
            placeholder={field.placeholder}
            rows={field.rows ?? 3}
            onChange={(e) => setField(field.name, e.target.value)}
            className={TEXTAREA_CLASS}
          />
        </div>
      );

    case 'date':
      return (
        <div>
          {label}
          <input
            type="date"
            value={(v as string) ?? ''}
            onChange={(e) => setField(field.name, e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      );

    case 'time':
      return (
        <div>
          {label}
          <input
            type="time"
            value={(v as string) ?? ''}
            onChange={(e) => setField(field.name, e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      );

    case 'number':
      return (
        <div>
          {label}
          <input
            type="number"
            value={(v as number | string | null | undefined) ?? ''}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(e) => setField(field.name, e.target.value === '' ? null : Number(e.target.value))}
            className={INPUT_CLASS}
          />
        </div>
      );

    case 'select':
      return (
        <div>
          {label}
          <select
            value={(v as string) ?? ''}
            onChange={(e) => setField(field.name, e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Selecionar...</option>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );

    case 'radio':
      return (
        <div>
          {label}
          <div className={field.orientation === 'horizontal' ? 'flex flex-wrap gap-2' : 'space-y-1.5'}>
            {field.options.map((o) => {
              const selected = v === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setField(field.name, o.value)}
                  className={`px-4 py-2.5 rounded-lg text-[13px] font-medium text-left transition-all ${
                    selected
                      ? 'bg-violet-100 text-violet-800 border border-violet-300'
                      : 'bg-zinc-100 text-zinc-700 border border-transparent hover:bg-zinc-200'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      );

    case 'checkbox':
      return (
        <label className="flex items-start gap-2.5 cursor-pointer p-2 -mx-2 rounded hover:bg-zinc-50">
          <input
            type="checkbox"
            checked={!!v}
            onChange={(e) => setField(field.name, e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-zinc-300"
          />
          <span className="text-[14px] text-zinc-700 leading-tight">
            {field.label}
            {field.hint && <span className={HINT_CLASS}>{field.hint}</span>}
          </span>
        </label>
      );

    case 'tag-list':
      return (
        <div>
          {label}
          <TagListInput
            value={(v as string[]) ?? []}
            options={field.options}
            allowCustom={field.allowCustom}
            onChange={(next) => setField(field.name, next)}
          />
        </div>
      );

    case 'cid-search':
      return (
        <div>
          {label}
          <LookupSearch
            kind="cid10"
            value={(v as string) ?? ''}
            descriptionValue={(value[field.descriptionField] as string) ?? ''}
            onSelect={(code, description) => {
              const next = { ...value, [field.name]: code, [field.descriptionField]: description };
              // forçar onChange via setField (que internamente faz spread)
              setField(field.name, code);
              setTimeout(() => setField(field.descriptionField, description), 0);
              void next;
            }}
          />
        </div>
      );

    case 'tuss-search':
      return (
        <div>
          {label}
          <LookupSearch
            kind="tuss"
            value={(v as string) ?? ''}
            descriptionValue={(value[field.descriptionField] as string) ?? ''}
            onSelect={(code, description) => {
              setField(field.name, code);
              setTimeout(() => setField(field.descriptionField, description), 0);
            }}
          />
        </div>
      );

    case 'array':
      return (
        <ArrayFieldInput
          field={field}
          value={(v as Array<Record<string, unknown>>) ?? []}
          onChange={(next) => setField(field.name, next)}
        />
      );

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────
// TagListInput — array de strings com sugestões + custom
// ─────────────────────────────────────────────────────────

function TagListInput({
  value,
  options,
  allowCustom,
  onChange,
}: {
  value: string[];
  options: ReadonlyArray<string>;
  allowCustom?: boolean;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  function add(s: string) {
    const t = s.trim();
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
    setDraft('');
  }
  function remove(s: string) {
    onChange(value.filter((x) => x !== s));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-100 text-violet-800 text-[12px] rounded-md"
          >
            {tag}
            <button type="button" onClick={() => remove(tag)} className="hover:bg-violet-200 rounded p-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options
          .filter((o) => !value.includes(o))
          .map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => add(o)}
              className="px-2.5 py-1 bg-zinc-100 text-zinc-700 text-[12px] rounded-md hover:bg-zinc-200"
            >
              + {o}
            </button>
          ))}
      </div>
      {allowCustom && (
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add(draft);
              }
            }}
            placeholder="Adicionar item personalizado..."
            className="flex-1 h-9 px-3 text-[13px] rounded-md border border-black/10 focus:outline-none focus:border-violet-400"
          />
          <button
            type="button"
            onClick={() => add(draft)}
            disabled={!draft.trim()}
            className="h-9 px-3 text-[13px] rounded-md bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40"
          >
            Adicionar
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// LookupSearch — autocomplete via /api/painel/lookup/cid10|tuss
// ─────────────────────────────────────────────────────────

function LookupSearch({
  kind,
  value,
  descriptionValue,
  onSelect,
}: {
  kind: 'cid10' | 'tuss';
  value: string;
  descriptionValue: string;
  onSelect: (code: string, description: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ code: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    const ctl = new AbortController();
    setLoading(true);
    fetch(`/api/painel/lookup/${kind}?q=${encodeURIComponent(query)}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.results)) setResults(j.results);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctl.abort();
  }, [query, kind]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={kind === 'cid10' ? 'Buscar CID-10 (código ou descrição)' : 'Buscar TUSS (código ou descrição)'}
            className="w-full h-10 pl-9 pr-3 bg-white text-[13px] rounded-lg border border-black/10 focus:outline-none focus:border-violet-400"
          />
          {loading && <Loader2 className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />}
        </div>
      </div>
      {value && (
        <div className="px-3 py-2 bg-violet-50 border border-violet-200 rounded-md text-[12px] text-violet-900">
          <strong>{value}</strong> — {descriptionValue || '(sem descrição)'}
        </div>
      )}
      {open && results.length > 0 && (
        <div className="max-h-48 overflow-y-auto border border-black/10 rounded-lg divide-y divide-black/[0.04] bg-white">
          {results.slice(0, 10).map((r) => (
            <button
              key={r.code}
              type="button"
              onClick={() => {
                onSelect(r.code, r.name);
                setOpen(false);
                setQuery('');
              }}
              className="w-full text-left px-3 py-2 hover:bg-zinc-50"
            >
              <div className="text-[12px] font-semibold text-zinc-900">{r.code}</div>
              <div className="text-[12px] text-zinc-600">{r.name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ArrayFieldInput — lista de subforms (ex: medications LME)
// ─────────────────────────────────────────────────────────

function ArrayFieldInput({
  field,
  value,
  onChange,
}: {
  field: Extract<FormField, { type: 'array' }>;
  value: Array<Record<string, unknown>>;
  onChange: (next: Array<Record<string, unknown>>) => void;
}) {
  const items = value ?? [];
  const min = field.minItems ?? 0;
  const max = field.maxItems ?? 99;

  function updateItem(idx: number, patch: Record<string, unknown>) {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  }

  function addItem() {
    if (items.length >= max) return;
    onChange([...items, { ...field.itemDefault }]);
  }

  function removeItem(idx: number) {
    if (items.length <= min) return;
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={LABEL_CLASS}>
          {field.label}
          {field.required && <span className="text-rose-500 ml-1">*</span>}
        </label>
        {items.length < max && (
          <button
            type="button"
            onClick={addItem}
            className="text-[12px] inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-violet-50 text-violet-700 hover:bg-violet-100"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar {field.itemLabel.toLowerCase()}
          </button>
        )}
      </div>
      {field.hint && <span className={HINT_CLASS}>{field.hint}</span>}
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="p-3 rounded-xl border border-black/[0.06] bg-white space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500">
                {field.itemLabel} {idx + 1}
              </p>
              {items.length > min && (
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-zinc-400 hover:text-rose-600 p-1"
                  title="Remover"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <DynamicDocForm
              fields={field.itemFields}
              value={item}
              onChange={(next) => updateItem(idx, next)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

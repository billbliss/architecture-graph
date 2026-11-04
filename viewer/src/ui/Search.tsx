// Jump to any node, relationship or module by name or ID (⌘K / Ctrl-K).
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { KINDS } from '../model/kinds';
import type { Model } from '../model/model';
import { Glyph } from './common';
import { useViewer } from './context';

export interface Hit {
  type: 'node' | 'relationship' | 'module';
  id: string;
  label: string;
  detail: string;
  kind?: keyof typeof KINDS;
}

const LIMIT = 60;

export function search(model: Model, query: string): Hit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { hit: Hit; score: number }[] = [];
  const score = (name: string, id: string): number => {
    const n = name.toLowerCase();
    const i = id.toLowerCase();
    if (n === q || i === q) return 0;
    if (n.startsWith(q) || i.startsWith(q) || i.split(':')[1]?.startsWith(q)) return 1;
    if (n.includes(q) || i.includes(q)) return 2;
    return -1;
  };
  for (const module of model.modules.values()) {
    const s = score(module.name, module.id);
    if (s >= 0) scored.push({ score: s, hit: { type: 'module', id: module.id, label: module.name, detail: module.id } });
  }
  for (const node of model.nodes.values()) {
    const s = score(node.name, node.id);
    if (s >= 0) scored.push({ score: s, hit: { type: 'node', id: node.id, label: node.name, detail: node.id, kind: node.kind } });
  }
  for (const rel of model.relationships.values()) {
    const from = model.node(rel.from)?.name ?? rel.from;
    const to = model.node(rel.to)?.name ?? rel.to;
    const label = `${from} ${rel.kind} ${to}`;
    const s = score(label, rel.id);
    if (s >= 0) scored.push({ score: s + 0.5, hit: { type: 'relationship', id: rel.id, label, detail: rel.id } });
  }
  return scored.sort((a, b) => a.score - b.score || a.hit.label.localeCompare(b.hit.label)).slice(0, LIMIT).map(item => item.hit);
}

export function Search({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { model, actions } = useViewer();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const hits = useMemo(() => search(model, query), [model, query]);
  const list = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      setQuery('');
      setActive(0);
      element.showModal();
    } else if (!open && element.open) element.close();
  }, [open]);

  const choose = (hit: Hit | undefined): void => {
    if (!hit) return;
    onClose();
    if (hit.type === 'module') actions.openModule(hit.id);
    else if (hit.type === 'node') actions.selectNode(hit.id);
    else actions.selectRel(hit.id);
  };

  return (
    <dialog ref={dialog} className="search" onClose={onClose} onClick={event => { if (event.target === dialog.current) onClose(); }} aria-label="Jump to a node, relationship or module">
      <input
        autoFocus
        value={query}
        placeholder="Jump to a node, relationship or module…"
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-controls={list}
        aria-activedescendant={hits[active] ? `${list}-${active}` : undefined}
        onChange={event => { setQuery(event.target.value); setActive(0); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => Math.min(hits.length - 1, index + 1)); }
          else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
          else if (event.key === 'Enter') { event.preventDefault(); choose(hits[active]); }
        }}
      />
      <ul id={list} role="listbox" aria-label="Results">
        {hits.map((hit, index) => (
          <li key={`${hit.type}:${hit.id}`} id={`${list}-${index}`} role="option" aria-selected={index === active} onMouseEnter={() => setActive(index)} onClick={() => choose(hit)}>
            {hit.kind ? <Glyph kind={hit.kind} /> : <span className="glyph muted" aria-hidden="true">{hit.type === 'module' ? '▢' : '→'}</span>}
            <span>{hit.label}</span>
            <span className="id">{hit.type === 'node' && hit.kind ? KINDS[hit.kind].label : hit.type} · {hit.detail}</span>
          </li>
        ))}
      </ul>
      {query.trim() && !hits.length && <div className="empty">Nothing matches “{query.trim()}”.</div>}
    </dialog>
  );
}

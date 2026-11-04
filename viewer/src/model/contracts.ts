// What the Contracts view lists: every contract, plus data objects and artifacts that carry a schema
// or example sidecar, grouped by module in declaration order.
import type { GraphNode } from '@billbliss/architecture-graph/core';
import { byKindThenName, type Model } from './model';

export function isContractRecord(node: GraphNode): boolean {
  if (node.kind === 'contract') return true;
  return (node.kind === 'data_object' || node.kind === 'artifact')
    && node.references.some(ref => ref.kind === 'schema' || ref.kind === 'example');
}

export interface ContractGroup {
  /** Module id, or '' for records without a module. */
  id: string;
  title: string;
  records: GraphNode[];
}

export function contractGroups(model: Model): ContractGroup[] {
  const groups: ContractGroup[] = [];
  for (const module of model.modules.values()) {
    const records = model.nodesIn(module.id).filter(isContractRecord);
    if (records.length) groups.push({ id: module.id, title: module.name, records });
  }
  const loose = (model.hasModules ? model.nodesIn('') : [...model.nodes.values()].sort(byKindThenName)).filter(isContractRecord);
  if (loose.length) groups.push({ id: '', title: model.hasModules ? 'No module' : 'All contracts', records: loose });
  return groups;
}

export const contractRecords = (model: Model): GraphNode[] => contractGroups(model).flatMap(group => group.records);

/** Open decisions (unresolved affects, or affects from unresolved nodes) bearing on a record. */
export function openDecisionCount(model: Model, id: string): number {
  return (model.incoming.get(id) ?? []).filter(rel => rel.kind === 'affects'
    && (rel.status === 'unresolved' || model.node(rel.from)?.status === 'unresolved')).length;
}

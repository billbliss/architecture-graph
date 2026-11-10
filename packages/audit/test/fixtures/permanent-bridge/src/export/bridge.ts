import { exportRows } from './exporter.js';
// Temporary: wide exports still go through the legacy exporter until the cutover.
import { legacyExport } from '../legacy/exporter.js';

export function exportReport(rows: string[]): string {
  return rows.length > 1000 ? legacyExport(rows) : exportRows(rows);
}

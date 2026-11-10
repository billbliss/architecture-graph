import { exportReport } from '../export/bridge.js';

export const handleExport = (rows: string[]): string => exportReport(rows);

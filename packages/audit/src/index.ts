// Public entry point of @billbliss/architecture-graph-audit. Core's `ag audit` imports it dynamically;
// it reads source code so that core never has to, and its findings are advisory, not proof.
export { runAudit, runChecks, formatReport, SUPPORTED_PROTOCOLS, VERSION, AUDIT_LIMIT } from './run.js';
export type { AuditContext } from './run.js';
export { loadAudit, AuditInputError } from './load.js';
export type { Audit, LoadedCheck } from './load.js';
export { CheckFileSchema, CheckSchema, AuditConfigSchema, BaselineSchema, ReportSchema } from './formats.js';
export type { Check, CheckFile, AuditConfig, Baseline, Report, Finding, FindingKind } from './formats.js';

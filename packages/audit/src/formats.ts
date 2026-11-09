import { z } from 'zod';

const text = z.string().min(1).regex(/\S/, 'Must contain non-whitespace text');
/** A graph module ID (it contains a colon, which paths cannot) or a repository-relative glob. */
const selector = text;
const selectors = z.array(selector).min(1);

export const CheckIdSchema = z.string().regex(/^check:[a-z0-9][a-z0-9._-]*$/, 'Check IDs look like check:stable-slug');
const common = {
  id: CheckIdSchema,
  mode: z.enum(['tripwire', 'audited']),
  description: text,
};
export const ForbiddenDependencySchema = z.strictObject({
  ...common, kind: z.literal('forbidden_dependency'), from: selectors, to: selectors,
});
export const ForbiddenReachabilitySchema = z.strictObject({
  ...common, kind: z.literal('forbidden_reachability'),
  entries: z.array(text).min(1), forbidden: z.array(selector).default([]),
  forbiddenPackages: z.array(text).default([]),
});
export const CheckSchema = z.discriminatedUnion('kind', [ForbiddenDependencySchema, ForbiddenReachabilitySchema]);
export const CheckFileSchema = z.strictObject({ checkVersion: z.literal('1'), checks: z.array(CheckSchema).min(1) });

export const AuditConfigSchema = z.strictObject({
  auditVersion: z.literal('1'),
  baseline: text,
  typescript: z.array(z.strictObject({ paths: z.array(text).min(1), tsconfig: text })).min(1),
  modules: z.record(z.string(), z.array(text).min(1)).default({}),
});

export const FindingKeySchema = z.string().regex(/^check:[^|]+\|(dep|reach|unresolved)\|/, 'Finding keys start with the check ID and kind');
export const BaselineSchema = z.strictObject({
  baselineVersion: z.literal('1'),
  findings: z.array(z.strictObject({
    key: FindingKeySchema, reason: text,
    added: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date'),
  })),
});

export const FindingKindSchema = z.enum(['forbidden_dependency', 'forbidden_reachability', 'unresolved_import']);
const evidence = z.strictObject({
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
  specifier: z.string().optional(),
  reason: z.string().optional(),
  path: z.array(z.string()).optional(),
});
export const ReportSchema = z.strictObject({
  reportVersion: z.literal('1'),
  limitation: text,
  tool: z.strictObject({ name: text, version: text, protocol: z.number().int() }),
  checks: z.array(z.strictObject({ id: CheckIdSchema, kind: z.enum(['forbidden_dependency', 'forbidden_reachability']), mode: z.enum(['tripwire', 'audited']), file: text, guardrails: z.array(text) })),
  findings: z.array(z.strictObject({
    key: z.string(), kind: FindingKindSchema, check: CheckIdSchema,
    classification: z.enum(['new', 'baselined', 'resolved']),
    message: text, evidence: evidence.optional(), reason: z.string().optional(),
  })),
  baselineGrowth: z.array(z.string()),
  coverage: z.strictObject({
    filesParsed: z.number().int().nonnegative(),
    externalTerminals: z.array(z.string()),
    unresolvedImports: z.number().int().nonnegative(),
  }),
  summary: z.strictObject({
    new: z.number().int().nonnegative(), baselined: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative(), baselineGrowth: z.number().int().nonnegative(),
    exitCode: z.union([z.literal(0), z.literal(3)]),
  }),
});

export type Check = z.infer<typeof CheckSchema>;
export type CheckFile = z.infer<typeof CheckFileSchema>;
export type AuditConfig = z.infer<typeof AuditConfigSchema>;
export type Baseline = z.infer<typeof BaselineSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type Finding = Report['findings'][number];
export type FindingKind = z.infer<typeof FindingKindSchema>;

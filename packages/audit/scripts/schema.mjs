import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { CheckFileSchema, AuditConfigSchema, BaselineSchema, ReportSchema } from '../lib/formats.js';
for (const [name, schema] of [['check', CheckFileSchema], ['audit-config', AuditConfigSchema], ['baseline', BaselineSchema], ['report', ReportSchema]]) {
  writeFileSync(new URL(`../schema/${name}.schema.json`, import.meta.url), JSON.stringify(z.toJSONSchema(schema, { io: 'input' }), null, 2) + '\n');
}

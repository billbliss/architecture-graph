import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { GraphSchema, ConfigSchema } from '../lib/schema.js';
for (const [name, schema] of [['graph', GraphSchema], ['config', ConfigSchema]]) {
  writeFileSync(new URL(`../schema/${name}.schema.json`, import.meta.url), JSON.stringify(z.toJSONSchema(schema), null, 2) + '\n');
}

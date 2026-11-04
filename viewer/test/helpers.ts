// Opens bundled examples and lays out views in Node, with ELK running directly instead of in a worker.
import ELK from 'elkjs/lib/elk.bundled.js';
import { EXAMPLES, loadExample } from '../src/load/examples';
import { Model, type Project } from '../src/model/model';

export const elk = new ELK();

export async function example(name: string): Promise<Model> {
  const project = await loadExample(name);
  if (!project || 'problem' in project && project.problem !== undefined) throw new Error(`Cannot open ${name}`);
  return new Model(project as Project);
}

export const exampleNames = EXAMPLES.map(item => item.name);

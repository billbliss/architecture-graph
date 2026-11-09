export interface FeatureCompiler { name: string; compile(input: number[]): number[] }
const compilers = new Map<string, FeatureCompiler>();
export function compilerFor(name: string): FeatureCompiler | undefined { return compilers.get(name); }

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Script, createContext } from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/** Execute the actual client module with isolated browser globals and SDK boundaries.
 * This keeps synthetic key tests offline without changing the production API.
 */
export function loadClientModule<T>(
  filename: string,
  imports: Record<string, unknown> = {},
  globals: Record<string, unknown> = {},
) {
  const url = new URL(`../../app/${filename}.ts`, import.meta.url);
  const require = createRequire(url);
  const exports = {};
  const context = createContext({
    exports,
    process: { env: {} },
    require: (name: string) => name in imports ? imports[name] : require(name),
    ...globals,
  });
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: fileURLToPath(url),
  }).outputText;
  new Script(compiled, { filename: fileURLToPath(url) }).runInContext(context);
  return { module: exports as T, context };
}

export class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

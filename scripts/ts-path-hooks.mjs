import { pathToFileURL } from "node:url";
import { resolve as pathResolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = pathResolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const abs = pathResolve(root, specifier.slice(2));
    const candidates = [abs, `${abs}.ts`, `${abs}.tsx`];
    for (const candidate of candidates) {
      try {
        return await nextResolve(pathToFileURL(candidate).href, context);
      } catch {
        /* try next */
      }
    }
  }
  return nextResolve(specifier, context);
}

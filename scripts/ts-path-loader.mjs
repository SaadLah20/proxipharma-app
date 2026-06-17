import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve as pathResolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const hooks = pathResolve(dirname(fileURLToPath(import.meta.url)), "ts-path-hooks.mjs");
register(pathToFileURL(hooks).href, import.meta.url);

import { asyncLocalStorage } from "@/shared/infrastructure/withContext.js";

type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Journalisation rattachée à l'invocation en cours.
 *
 * `withContext` / `withContextMessage` posent l'`InvocationContext` Azure dans
 * l'`AsyncLocalStorage` : écrire par lui corrèle la ligne à l'invocation
 * (identifiant, fonction) dans Application Insights, là où `console.*` produit
 * une ligne orpheline. Hors invocation (démarrage, scripts, tests) on retombe
 * sur `console`, jamais sur le silence.
 */
function write(level: LogLevel, args: unknown[]): void {
  const context = asyncLocalStorage.getStore()?.context;

  if (context) {
    switch (level) {
      case "debug":
        context.debug(...args);
        return;
      case "info":
        context.log(...args);
        return;
      case "warn":
        context.warn(...args);
        return;
      case "error":
        context.error(...args);
        return;
    }
  }

  switch (level) {
    case "debug":
      console.debug(...args);
      return;
    case "info":
      console.log(...args);
      return;
    case "warn":
      console.warn(...args);
      return;
    case "error":
      console.error(...args);
      return;
  }
}

export const log = {
  debug: (...args: unknown[]): void => write("debug", args),
  info: (...args: unknown[]): void => write("info", args),
  warn: (...args: unknown[]): void => write("warn", args),
  error: (...args: unknown[]): void => write("error", args),
};

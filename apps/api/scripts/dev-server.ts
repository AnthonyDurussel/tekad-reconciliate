/**
 * Serveur de développement sans Azure Functions Core Tools : sert les routes
 * de `src/routes.ts` sur http://localhost:7071/api, comme `func start`, pour
 * le proxy Vite (`apps/frontend`, `pnpm dev`). Mêmes handlers, même pile
 * (`route()` : principal, erreurs, conteneur, accès) ; seule l'enveloppe HTTP
 * change. Développement uniquement — jamais déployé.
 *
 *   pnpm dev:server        # DATABASE_URL : environnement, local.settings.json, puis .env
 */
import "reflect-metadata";
import "./load-env.mjs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import type {
  HttpFunctionOptions,
  HttpHandler,
  HttpResponseInit,
} from "@azure/functions";
import { registerAllRoutes } from "@/routes.js";

// Paquet CommonJS : ses classes ne sont pas des exports ESM nommés sous tsx.
const { HttpRequest, InvocationContext } = createRequire(import.meta.url)(
  "@azure/functions",
) as typeof import("@azure/functions");

type Entry = {
  methods: string[];
  pattern: RegExp;
  params: string[];
  handler: HttpHandler;
  name: string;
};

const entries: Entry[] = [];
registerAllRoutes({
  http(name: string, options: HttpFunctionOptions) {
    const params: string[] = [];
    const source = (options.route ?? name)
      .split("/")
      .map((part) => {
        const match = /^\{(\w+)\}$/.exec(part);
        if (!match) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        params.push(match[1]);
        return "([^/]+)";
      })
      .join("/");
    entries.push({
      name,
      methods: (options.methods ?? ["GET"]) as string[],
      pattern: new RegExp(`^/api/${source}$`),
      params,
      handler: options.handler as HttpHandler,
    });
  },
});

const port = Number(process.env.PORT ?? 7071);

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const method = req.method ?? "GET";
  // Les routes fixes (`expenses/export`) passent avant `expenses/{id}`, comme sur Azure.
  const candidates = entries
    .map((e) => ({ e, m: e.pattern.exec(url.pathname) }))
    .filter((x) => x.m && x.e.methods.includes(method))
    .sort((a, b) => a.e.params.length - b.e.params.length);
  const found = candidates[0];
  if (!found) {
    res.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers[k] = v;
  }
  const request = new HttpRequest({
    method,
    url: url.toString(),
    headers,
    query: Object.fromEntries(url.searchParams),
    params: Object.fromEntries(
      found.e.params.map((p, i) => [p, decodeURIComponent(found.m![i + 1])]),
    ),
    body: body ? { bytes: body } : undefined,
  });
  const context = new InvocationContext({ functionName: found.e.name });
  try {
    const result = ((await found.e.handler(request, context)) ??
      {}) as HttpResponseInit;
    const status = result.status ?? 200;
    const out = new Headers(result.headers as HeadersInit | undefined);
    let payload: Buffer | string | undefined;
    if (result.jsonBody !== undefined) {
      out.set("content-type", "application/json");
      payload = JSON.stringify(result.jsonBody);
    } else if (result.body instanceof Uint8Array) {
      payload = Buffer.from(result.body);
    } else if (typeof result.body === "string") {
      payload = result.body;
    }
    res.writeHead(status, Object.fromEntries(out.entries()));
    res.end(payload);
  } catch (error) {
    console.error(error);
    res.writeHead(500).end();
  }
}).listen(port, () => {
  console.log(
    `API de développement : http://localhost:${port}/api (${entries.length} routes)`,
  );
});

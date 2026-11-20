// Assembles the Azure Functions package of a release: release/function-app.zip, holding the
// bundles (dist/, built first by `pnpm build`: the API, ensure-admin and seed), the generated
// Prisma client (its query compiler is read from disk at run time), host.json, the Prisma
// schema, migrations and seed data (applied by the deploy job, never by the app) and a
// package.json whose `main` is the bundle. esbuild inlines every dependency: no node_modules.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const api = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const release = path.join(api, "release");
const staging = path.join(release, "function-app");

for (const file of [
  "dist/index.cjs",
  "dist/ensure-admin.cjs",
  "dist/seed.cjs",
]) {
  if (!existsSync(path.join(api, file)))
    throw new Error(`${file} missing: run \`pnpm build\` first`);
}
rmSync(release, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

for (const entry of ["dist", "generated", "prisma", "host.json"]) {
  cpSync(path.join(api, entry), path.join(staging, entry), {
    recursive: true,
    // Source maps stay out of the package (the host never reads them).
    filter: (source) => !source.endsWith(".map"),
  });
}

const pkg = JSON.parse(readFileSync(path.join(api, "package.json"), "utf8"));
writeFileSync(
  path.join(staging, "package.json"),
  `${JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      private: true,
      main: "dist/index.cjs",
    },
    null,
    2,
  )}\n`,
);

execFileSync("zip", ["-q", "-r", "-X", "../function-app.zip", "."], {
  cwd: staging,
  stdio: "inherit",
});
console.log(`release/function-app.zip (${pkg.version})`);

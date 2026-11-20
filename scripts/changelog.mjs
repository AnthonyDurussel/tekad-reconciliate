// Regenerates the root CHANGELOG.md from the whole git history (Conventional Commits, tags vX.Y.Z).
// The preset is passed directly: the CLI's preset loader would resolve the old
// conventional-changelog-angular that turboversion depends on.
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { ConventionalChangelog } from "conventional-changelog";
import createPreset from "conventional-changelog-angular";

const generator = new ConventionalChangelog()
  .readPackage()
  .readRepository()
  .config(createPreset())
  .tags({ prefix: "v" })
  .options({ releaseCount: 0 });

await pipeline(generator.writeStream(), createWriteStream("CHANGELOG.md"));

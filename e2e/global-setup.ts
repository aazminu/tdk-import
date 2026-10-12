import { spawnSync } from "node:child_process";
import { join } from "node:path";

/** The e2e files run the built dist/cli.js, so build it once before any of them starts. */
export default function setup(): void {
  const build = spawnSync("npm", ["run", "build"], {
    cwd: join(import.meta.dirname, ".."),
    encoding: "utf8",
  });
  if (build.status !== 0) throw new Error(`build failed:\n${build.stdout}${build.stderr}`);
}

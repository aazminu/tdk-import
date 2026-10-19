import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../detectors/dockerfile.js";
import { formatPlan } from "../format.js";
import { mergeCandidates } from "../merge.js";
import type { ImportPlan } from "../plan.js";
import { selectDetectors } from "../registry.js";
import { planWrites } from "../write.js";

let root: string;

beforeEach(() => {
  root = join(mkdtempSync(join(tmpdir(), "tdk-import-dockerfile-")), "app");
  mkdirSync(root, { recursive: true });
});

afterEach(() => rmSync(dirname(root), { recursive: true, force: true }));

describe("dockerfile detector", () => {
  it("reports non-numeric EXPOSE in skips and plan output", () => {
    const absPath = join(root, "Dockerfile");
    writeFileSync(
      absPath,
      ["FROM node:22-alpine", `EXPOSE $${"{PORT}"}`, 'CMD ["node", "server.js"]', ""].join("\n"),
    );

    const [detector] = selectDetectors(["dockerfile"]);
    if (!detector) throw new Error("dockerfile detector not registered");
    const result = detector.parse(absPath, "Dockerfile");

    expect(result.candidates).toEqual([
      {
        kind: "service",
        dir: "",
        dockerfile: "Dockerfile",
        command: "node server.js",
        confidence: "high",
        sources: [{ file: "Dockerfile", detector: "dockerfile" }],
      },
    ]);
    expect(result.skips).toEqual([
      {
        file: "Dockerfile",
        detector: "dockerfile",
        line: 2,
        reason: "EXPOSE uses a variable; port not imported",
      },
    ]);

    const merged = mergeCandidates(result.candidates, "app");
    const plan: ImportPlan = {
      root,
      services: merged.services,
      skips: [...result.skips, ...merged.skips],
      unsupported: [],
      skippedProcfileProcesses: 0,
      notes: [],
      files: ["Dockerfile"],
    };
    const text = formatPlan(plan, planWrites(plan, false));
    expect(text).toContain("Dockerfile:2 [dockerfile]: EXPOSE uses a variable; port not imported");
  });

  it("imports a numeric EXPOSE port and keeps only the final stage in multi-stage builds", () => {
    const absPath = join(root, "Dockerfile");
    writeFileSync(
      absPath,
      [
        "FROM node:22 AS builder",
        `EXPOSE $${"{BUILD_PORT}"}`,
        'CMD ["npm", "run", "build"]',
        "FROM node:22-slim",
        "EXPOSE 4000/tcp",
        'CMD ["node", "dist/index.js"]',
        "",
      ].join("\n"),
    );

    const [detector] = selectDetectors(["dockerfile"]);
    if (!detector) throw new Error("dockerfile detector not registered");
    const result = detector.parse(absPath, "Dockerfile");

    expect(result.skips).toEqual([]);
    expect(result.candidates[0]).toMatchObject({
      port: 4000,
      command: "node dist/index.js",
    });
  });
});

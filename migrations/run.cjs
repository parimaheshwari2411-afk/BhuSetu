#!/usr/bin/env node
/**
 * Convenience runner from /migrations.
 * Delegates to backend/src/migrations/runner.ts
 */
const { spawnSync } = require("child_process");
const path = require("path");

const result = spawnSync(
  "npx",
  ["ts-node", path.join(__dirname, "../backend/src/migrations/runner.ts")],
  {
    cwd: path.join(__dirname, "../backend"),
    stdio: "inherit",
    shell: true,
  }
);

process.exit(result.status || 0);

/**
 * PM2 ecosystem — run from repo root:
 *   pm2 start archetypes/C-gitguardian-ai/deploy/ecosystem.config.cjs
 *
 * Requires .env at repo root (see deploy/.env.production.example).
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../../..");
const envFile = path.join(root, ".env");

function firstExisting(paths) {
  const found = paths.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`Not found. Tried:\n${paths.map((p) => `  - ${p}`).join("\n")}`);
  }
  return found;
}

const nextBin = firstExisting([
  path.join(root, "archetypes/C-gitguardian-ai/node_modules/next/dist/bin/next"),
  path.join(root, "archetypes/C-gitguardian-ai/apps/web/node_modules/next/dist/bin/next"),
  path.join(root, "node_modules/next/dist/bin/next"),
]);

const tsxCli = firstExisting([
  path.join(root, "node_modules/tsx/dist/cli.mjs"),
  path.join(root, "archetypes/C-gitguardian-ai/node_modules/tsx/dist/cli.mjs"),
]);

const forkApp = {
  exec_mode: "fork",
  instances: 1,
  autorestart: true,
  max_memory_restart: "512M",
};

module.exports = {
  apps: [
    {
      ...forkApp,
      name: "gitguardian-api",
      cwd: path.join(root, "archetypes/C-gitguardian-ai/apps/api"),
      script: "dist/main.js",
      interpreter: "node",
      node_args: `--env-file=${envFile}`,
      env: {
        NODE_ENV: "production",
      },
      kill_timeout: 5000,
    },
    {
      ...forkApp,
      name: "gitguardian-web",
      cwd: path.join(root, "archetypes/C-gitguardian-ai/apps/web"),
      script: nextBin,
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      ...forkApp,
      name: "gitguardian-worker",
      cwd: path.join(root, "archetypes/C-gitguardian-ai/apps/worker"),
      interpreter: "node",
      script: tsxCli,
      args: "src/index.ts",
      node_args: `--env-file=${envFile}`,
    },
  ],
};

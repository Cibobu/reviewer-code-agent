/**
 * PM2 ecosystem — run from repo root:
 *   pm2 start archetypes/C-gitguardian-ai/deploy/ecosystem.config.cjs
 *
 * Requires .env at repo root (see deploy/.env.production.example).
 */
const path = require("path");

const root = path.resolve(__dirname, "../../..");
const envFile = path.join(root, ".env");

module.exports = {
  apps: [
    {
      name: "gitguardian-api",
      cwd: path.join(root, "archetypes/C-gitguardian-ai/apps/api"),
      script: "dist/main.js",
      node_args: `--env-file=${envFile}`,
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
    },
    {
      name: "gitguardian-web",
      cwd: path.join(root, "archetypes/C-gitguardian-ai/apps/web"),
      script: (() => {
        const candidates = [
          path.join(root, "archetypes/C-gitguardian-ai/node_modules/next/dist/bin/next"),
          path.join(root, "archetypes/C-gitguardian-ai/apps/web/node_modules/next/dist/bin/next"),
          path.join(root, "node_modules/next/dist/bin/next"),
        ];
        const found = candidates.find((p) => require("fs").existsSync(p));
        if (!found) {
          throw new Error(
            "next binary not found — run: bash scripts/install-c-web.sh",
          );
        }
        return found;
      })(),
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
    },
    {
      name: "gitguardian-worker",
      cwd: path.join(root, "archetypes/C-gitguardian-ai/apps/worker"),
      script: path.join(root, "node_modules/tsx/dist/cli.mjs"),
      args: `src/index.ts`,
      node_args: `--env-file=${envFile}`,
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
    },
  ],
};

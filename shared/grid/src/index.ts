// Grid deploy is currently MANUAL — FORU eng will add the agent to Grid
// on workshop day. This module is a small helper that prints the exact
// payload a facilitator (or OpenClaw) needs to register your agent.
//
// Replace the body with a real API call once the Grid deploy spec is
// published. The shape below is intentionally minimal so it survives a
// rewrite without churning the CLI.

import type { ArchetypeCode } from "@foru-workshop/contracts";

export interface DeployManifest {
  archetype: ArchetypeCode;
  agentName: string;
  description: string;
  entrypoint: string;
  soulPath: string;
}

export function buildManifest(req: DeployManifest): DeployManifest {
  return req;
}

export function formatHandoff(manifest: DeployManifest): string {
  return [
    `Archetype:    ${manifest.archetype}`,
    `Agent name:   ${manifest.agentName}`,
    `Description:  ${manifest.description}`,
    `Brain:        ${manifest.entrypoint}`,
    `SOUL:         ${manifest.soulPath}`,
  ].join("\n");
}

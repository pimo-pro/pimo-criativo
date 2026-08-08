/**
 * Provisiona githubSyncConfig.php (gitignored) a partir de PIMO_GITHUB_PROJECTS_TOKEN
 * ou do token da sessão `gh auth token` (apenas para bootstrap local / Hostinger).
 *
 * Uso:
 *   node scripts/provisionGithubProjectsSync.mjs
 *   set PIMO_GITHUB_PROJECTS_TOKEN=ghp_... && node scripts/provisionGithubProjectsSync.mjs
 *
 * Preferir PAT fine-grained com Contents:write só em pimo-pro/pimo-projetos.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function resolveToken() {
  const env = process.env.PIMO_GITHUB_PROJECTS_TOKEN;
  if (typeof env === "string" && env.trim() !== "") {
    return env.trim();
  }
  try {
    return execSync("gh auth token", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

async function testRepoAccess(token) {
  const res = await fetch("https://api.github.com/repos/pimo-pro/pimo-projetos", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "PIMO-Projetos-Provision",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Acesso ao repo falhou (${res.status}): ${text}`);
  }
  const body = await res.json();
  if (!body.private) {
    console.warn("AVISO: pimo-projetos não está marcado como privado.");
  }
  return body.html_url;
}

function writeConfig(targetDir, token) {
  const out = path.join(targetDir, "githubSyncConfig.php");
  const php = `<?php
/**
 * Gerado por scripts/provisionGithubProjectsSync.mjs — NÃO versionar.
 */
declare(strict_types=1);

return [
    "enabled" => true,
    "owner" => "pimo-pro",
    "repo" => "pimo-projetos",
    "branch" => "main",
    "token" => ${JSON.stringify(token)},
    "timeoutSeconds" => 12,
];
`;
  fs.writeFileSync(out, php, "utf8");
  console.log(`Config escrita: ${out}`);
}

const token = resolveToken();
if (!token) {
  console.error(
    "Sem token. Defina PIMO_GITHUB_PROJECTS_TOKEN ou autentique com `gh auth login`."
  );
  process.exit(1);
}

const url = await testRepoAccess(token);
console.log(`Repo OK: ${url}`);

writeConfig(path.join(root, "hostinger", "api", "projects"), token);
writeConfig(path.join(root, "public_html", "api", "projects"), token);

console.log("");
console.log("Próximo passo no Hostinger (one-time):");
console.log("  - Carregar githubSyncConfig.php para public_html/api/projects/");
console.log("    OU definir PIMO_GITHUB_PROJECTS_TOKEN no ambiente PHP.");
console.log("  - Preferir PAT fine-grained (Contents:write só em pimo-projetos).");
console.log("Ver docs/PIMO-ARQUIVO-GITHUB-PROJETOS.md");

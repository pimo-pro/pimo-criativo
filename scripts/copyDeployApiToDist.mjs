/**
 * Após `vite build`, coloca PHP de auth/users/projects (e .gitkeep de data) em dist/
 * para o FTP-Deploy enviar tudo dentro de public_html.
 * Layout: dist/api/auth/index.php (stub) → ../_impl/auth/index.php
 * Projects: dist/api/projects/ ← hostinger/api/projects/ (ficheiros estáticos; data/ no servidor preserva JSON existente)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

/** Copia API de projetos (PHP + .htaccess). Não copia JSON de data/ — dados no servidor ficam intactos. */
function copyProjectsApiToDist() {
  const srcProjects = path.join(root, "hostinger", "api", "projects");
  const destProjects = path.join(dist, "api", "projects");
  if (!fs.existsSync(srcProjects)) {
    console.warn("[copyDeployApiToDist] hostinger/api/projects em falta — projects não copiado.");
    return false;
  }
  // index.php faz require de githubSync*.php — tem de ir no deploy (sem config com token).
  const required = ["index.php", "list.php", ".htaccess", "githubSync.php", "githubSyncMapper.php"];
  for (const name of required) {
    const src = path.join(srcProjects, name);
    if (!fs.existsSync(src)) {
      console.warn(`[copyDeployApiToDist] hostinger/api/projects/${name} em falta — projects não copiado.`);
      return false;
    }
    copyFile(src, path.join(destProjects, name));
  }
  const exampleConfig = path.join(srcProjects, "githubSyncConfig.example.php");
  if (fs.existsSync(exampleConfig)) {
    copyFile(exampleConfig, path.join(destProjects, "githubSyncConfig.example.php"));
  }
  const dataHtaccess = path.join(srcProjects, "data", ".htaccess");
  ensureDir(path.join(destProjects, "data"));
  if (fs.existsSync(dataHtaccess)) {
    copyFile(dataHtaccess, path.join(destProjects, "data", ".htaccess"));
  }
  const gitkeepDest = path.join(destProjects, "data", ".gitkeep");
  if (!fs.existsSync(gitkeepDest)) {
    fs.writeFileSync(gitkeepDest, "", "utf8");
  }
  const thumbsDir = path.join(destProjects, "thumbs");
  ensureDir(thumbsDir);
  const thumbsGitkeep = path.join(thumbsDir, ".gitkeep");
  if (!fs.existsSync(thumbsGitkeep)) {
    fs.writeFileSync(thumbsGitkeep, "", "utf8");
  }
  return true;
}

if (!fs.existsSync(dist)) {
  console.warn("[copyDeployApiToDist] dist/ inexistente — ignorar (correr após vite build).");
  process.exit(0);
}

const srcAuth = path.join(root, "api", "auth", "index.php");
const srcUsers = path.join(root, "api", "users", "index.php");
const srcUserSettings = path.join(root, "api", "user-settings", "index.php");
const srcGlobalConfig = path.join(root, "api", "global-config", "index.php");
const srcQuotes = path.join(root, "api", "quotes", "index.php");

if (!fs.existsSync(srcAuth) || !fs.existsSync(srcUsers)) {
  console.warn("[copyDeployApiToDist] api/auth ou api/users em falta — nada a copiar.");
  process.exit(0);
}

copyFile(srcAuth, path.join(dist, "api", "_impl", "auth", "index.php"));
copyFile(srcUsers, path.join(dist, "api", "_impl", "users", "index.php"));

const srcAuthz = path.join(root, "api", "authz", "resourceAccess.php");
if (fs.existsSync(srcAuthz)) {
  copyFile(srcAuthz, path.join(dist, "api", "_impl", "authz", "resourceAccess.php"));
}
if (fs.existsSync(srcUserSettings)) {
  copyFile(srcUserSettings, path.join(dist, "api", "_impl", "user-settings", "index.php"));
}
if (fs.existsSync(srcGlobalConfig)) {
  copyFile(srcGlobalConfig, path.join(dist, "api", "_impl", "global-config", "index.php"));
}
if (fs.existsSync(srcQuotes)) {
  copyFile(srcQuotes, path.join(dist, "api", "_impl", "quotes", "index.php"));
}

const gitkeep = path.join(root, "api", "data", ".gitkeep");
if (fs.existsSync(gitkeep)) {
  copyFile(gitkeep, path.join(dist, "api", "_impl", "data", ".gitkeep"));
}
const srcGlobalSettings = path.join(root, "api", "data", "global-settings.json");
if (fs.existsSync(srcGlobalSettings)) {
  copyFile(srcGlobalSettings, path.join(dist, "api", "_impl", "data", "global-settings.json"));
}

const authStub = `<?php
define('PIMO_AUTH_ROUTER', true);
require_once __DIR__ . '/../_impl/auth/index.php';
`;

const usersStub = `<?php
define('PIMO_USERS_ROUTER', true);
require_once __DIR__ . '/../_impl/users/index.php';
`;

const userSettingsStub = `<?php
define('PIMO_USER_SETTINGS_ROUTER', true);
require_once __DIR__ . '/../_impl/user-settings/index.php';
`;

const globalConfigStub = `<?php
define('PIMO_GLOBAL_CONFIG_ROUTER', true);
require_once __DIR__ . '/../_impl/global-config/index.php';
`;

const quotesStub = `<?php
define('PIMO_QUOTES_ROUTER', true);
require_once __DIR__ . '/../_impl/quotes/index.php';
`;

ensureDir(path.join(dist, "api", "auth"));
ensureDir(path.join(dist, "api", "users"));
fs.writeFileSync(path.join(dist, "api", "auth", "index.php"), authStub, "utf8");
fs.writeFileSync(path.join(dist, "api", "users", "index.php"), usersStub, "utf8");
if (fs.existsSync(srcUserSettings)) {
  ensureDir(path.join(dist, "api", "user-settings"));
  fs.writeFileSync(path.join(dist, "api", "user-settings", "index.php"), userSettingsStub, "utf8");
}
if (fs.existsSync(srcGlobalConfig)) {
  ensureDir(path.join(dist, "api", "global-config"));
  fs.writeFileSync(path.join(dist, "api", "global-config", "index.php"), globalConfigStub, "utf8");
}
if (fs.existsSync(srcQuotes)) {
  ensureDir(path.join(dist, "api", "quotes"));
  fs.writeFileSync(path.join(dist, "api", "quotes", "index.php"), quotesStub, "utf8");
}

const extras = [];
if (fs.existsSync(srcUserSettings)) extras.push("user-settings");
if (fs.existsSync(srcGlobalConfig)) extras.push("global-config");
if (fs.existsSync(srcQuotes)) extras.push("quotes");
const projectsCopied = copyProjectsApiToDist();
if (projectsCopied) extras.push("projects");

function copyIndustrialOrdersApiToDist() {
  const srcOrders = path.join(root, "api", "industrial", "orders", "index.php");
  const destOrders = path.join(dist, "api", "industrial", "orders");
  if (!fs.existsSync(srcOrders)) {
    console.warn("[copyDeployApiToDist] api/industrial/orders/index.php em falta — industrial orders não copiado.");
    return false;
  }
  copyFile(srcOrders, path.join(destOrders, "index.php"));
  const dataDir = path.join(destOrders, "data");
  ensureDir(dataDir);
  const gitkeep = path.join(dataDir, ".gitkeep");
  if (!fs.existsSync(gitkeep)) {
    fs.writeFileSync(gitkeep, "", "utf8");
  }
  return true;
}

const industrialOrdersCopied = copyIndustrialOrdersApiToDist();
if (industrialOrdersCopied) extras.push("industrial/orders");

console.log(
  "[copyDeployApiToDist] Copiado auth/users" +
    (extras.length ? "/" + extras.join("/") : "") +
    " para dist/api/ (_impl + stubs" +
    (projectsCopied ? "; projects em dist/api/projects/" : "") +
    (industrialOrdersCopied ? "; industrial/orders em dist/api/industrial/orders/" : "") +
    ")."
);

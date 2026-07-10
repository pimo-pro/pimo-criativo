/**
 * Publicação com versionamento definitivo: v{A}.{MMDD}.{HHMM}
 * Exemplo: v6.0316.1542
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const versionFilePath = path.join(rootDir, "version.json");
const publicVersionPath = path.join(rootDir, "public", "version.json");
const distVersionPath = path.join(rootDir, "dist", "version.json");

function readVersionJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

/** Grava version.json na raiz e espelha em public/ (copiado pelo Vite para dist/). */
function writeVersionFiles(data) {
  const json = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(versionFilePath, json, "utf8");
  fs.mkdirSync(path.dirname(publicVersionPath), { recursive: true });
  fs.writeFileSync(publicVersionPath, json, "utf8");
}

function assertVersionFilesInSync() {
  if (!fs.existsSync(distVersionPath)) {
    console.error("ERRO: dist/version.json ausente apos build.");
    process.exit(1);
  }
  const root = readVersionJson(versionFilePath);
  const pub = readVersionJson(publicVersionPath);
  const dist = readVersionJson(distVersionPath);
  const samePayload = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (!samePayload(root, pub) || !samePayload(root, dist)) {
    console.error("ERRO: version.json, public/version.json e dist/version.json divergem.");
    process.exit(1);
  }
  console.log("Versao sincronizada: version.json, public/version.json, dist/version.json");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}


function getShortVersion() {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-1); // último dígito do ano
  const mmdd = pad2(now.getMonth() + 1) + pad2(now.getDate());
  const hhmm = pad2(now.getHours()) + pad2(now.getMinutes());
  return `v${year}.${mmdd}.${hhmm}`;
}

if (!fs.existsSync(versionFilePath)) {
  throw new Error(`Ficheiro nao encontrado: ${versionFilePath}`);
}

const currentRaw = fs.readFileSync(versionFilePath, "utf8").replace(/^\uFEFF/, "");
const currentData = JSON.parse(currentRaw);
const now = new Date();
const nextVersion = getShortVersion();
const updatedAt = `${pad2(now.getDate())}.${pad2(now.getMonth() + 1)}.${now.getFullYear()} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

const nextData = {
  ...currentData,
  version: nextVersion,
  updatedAt,
};

writeVersionFiles(nextData);

function runStep(description, command) {
  console.log(description);
  try {
    execSync(command, { stdio: "inherit" });
  } catch (err) {
    console.error(`Erro ao executar: ${command}`);
    process.exit(1);
  }
}

function runOutput(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}


function ensureProductionEnv() {
  const prodPath = path.join(rootDir, ".env.production");
  const base = fs.existsSync(prodPath) ? fs.readFileSync(prodPath, "utf8") : "";
  const updates = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    VITE_API_URL: process.env.VITE_API_URL,
    VITE_TEXTURES_URL: process.env.VITE_TEXTURES_URL,
  };

  let merged = base.endsWith("\n") || base === "" ? base : `${base}\n`;
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value !== "string" || value.trim() === "") continue;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    merged = pattern.test(merged)
      ? merged.replace(pattern, `${key}=${value}`)
      : `${merged}${key}=${value}\n`;
  }

  fs.writeFileSync(prodPath, merged, "utf8");

  const hasUrl = /^VITE_SUPABASE_URL=\s*\S+/m.test(merged);
  const hasKey = /^VITE_SUPABASE_ANON_KEY=\s*\S+/m.test(merged);
  if (!hasUrl || !hasKey) {
    console.warn(
      "AVISO: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes no build local. " +
        "Configure .env.production ou secrets GitHub (CI injeta no deploy)."
    );
  } else {
    console.log("Supabase industrial: variaveis presentes para o build.");
  }
}

console.log(`Nova versao: ${nextVersion}`);
console.log(`updatedAt: ${nextData.updatedAt}`);
console.log("Sincronizado public/version.json antes do build.");
ensureProductionEnv();

runStep(
  "Testes contrato furos (anti-regressão)...",
  "npm test -- --run src/core/cutlayout/holePipelineContract.test.ts src/core/cutlayout/holeInvariantContract.test.ts src/core/cutlayout/cutlistToPiecesGrain.test.ts"
);

runStep("Executando build...", "npm run build");
assertVersionFilesInSync();
// Evitar adicionar repositórios embutidos (ex.: backend/ tem o seu próprio .git)
// para não criar gitlinks/submodules acidentais no repo principal.
runStep("Adicionando arquivos ao git...", "git add . \":(exclude)backend\"");
runStep("Criando commit...", `git commit -m "Publicação automática"`);
const localTagRef = runOutput(`git rev-parse -q --verify refs/tags/${nextVersion}`);
if (!localTagRef) {
  runStep("Criando tag...", `git tag ${nextVersion}`);
} else {
  console.log(`Tag local já existe: ${nextVersion} (reutilizando)`);
}
runStep("Enviando push...", "git push origin HEAD");
const remoteTagRef = runOutput(`git ls-remote --tags origin refs/tags/${nextVersion}`);
if (!remoteTagRef) {
  runStep("Enviando push da nova tag...", `git push origin refs/tags/${nextVersion}`);
} else {
  console.log(`Tag já existe no remoto: ${nextVersion} (sem erro)`);
}

console.log("Publicação concluída.");

/**
 * Append Whats New entry to public/updates/news.json (deploy / publish).
 * Preserves existing entries; never deletes history (cap MAX_ENTRIES).
 * Optionally merges remote production file before append (CI).
 * Texto = commit message real (nunca "Publicação PIMO — Sistema Industrial").
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const NEWS_REL = path.join("public", "updates", "news.json");
const NEWS_PATH = path.join(rootDir, NEWS_REL);
const MAX_ENTRIES = 300;
const PROD_NEWS_URL = process.env.PIMO_NEWS_URL || "https://pimo.pro/updates/news.json";

/** Mensagens de commit de release a ignorar na resolução do texto das Novidades. */
const PUBLICATION_MSG_RE = /^publica[cç][aã]o\b/i;
const RELEASE_CHORE_RE = /^chore\s*\(\s*release\s*\)\s*:/i;
const IGNORED_COMMIT_SCOPES = new Set([
  "lint",
  "ci",
  "chore",
  "test",
  "style",
  "build",
  "deps",
  "release",
  "refactor",
]);
const FRIENDLY_TYPE_LABEL = {
  fix: "Correção: ",
  feat: "Novidade: ",
  feature: "Novidade: ",
  update: "Atualização: ",
  docs: "Documentação: ",
};
const CONVENTIONAL_TYPE_RE =
  /^(fix|feat|feature|update|chore|docs|ci|test|style|build|perf|refactor|revert|deps|release|lint)(?:\(([^)]+)\))?:\s*(.*)$/i;

function run(cmd) {
  try {
    return execSync(cmd, { cwd: rootDir, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function isIgnoredCommitMessage(message) {
  const m = String(message || "").trim();
  if (!m) return true;
  return PUBLICATION_MSG_RE.test(m) || RELEASE_CHORE_RE.test(m);
}

function stripCoAuthoredByLines(message) {
  return String(message || "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*co-authored-by:/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Prefixo conventional-commit na 1.ª linha: type, scope opcional, resto. */
function parseConventionalPrefix(message) {
  const first = String(message || "")
    .trim()
    .split(/\r?\n/)[0]
    .trim();
  const match = first.match(CONVENTIONAL_TYPE_RE);
  if (!match) return null;
  const scopeRaw = match[2] == null ? "" : String(match[2]).trim();
  return {
    type: match[1],
    scope: scopeRaw || null,
    rest: String(match[3] || "").trim(),
  };
}

function shouldIgnoreCommitByScope(message) {
  const parsed = parseConventionalPrefix(message);
  if (!parsed || !parsed.scope) return false;
  return parsed.scope
    .split(/[,\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .some((part) => IGNORED_COMMIT_SCOPES.has(part));
}

function friendlyFirstLine(message, version) {
  const cleaned = stripCoAuthoredByLines(message);
  const first = cleaned.split(/\r?\n/)[0].trim();
  const parsed = parseConventionalPrefix(first);
  const typeKey = parsed ? parsed.type.toLowerCase() : "";
  const rest = parsed && parsed.rest ? parsed.rest : first;
  const label = FRIENDLY_TYPE_LABEL[typeKey] || "";
  const body = rest || `Release ${version || ""}`.trim();
  return `${label}${body}`.trim();
}

function friendlyTitleFromMessage(message, version) {
  const title = friendlyFirstLine(message, version);
  if (!title) return `Release ${version || ""}`.trim();
  return title.length > 120 ? `${title.slice(0, 117)}...` : title;
}

function friendlyDescriptionFromMessage(message, version) {
  const cleaned = stripCoAuthoredByLines(message);
  const first = friendlyFirstLine(cleaned, version);
  if (!cleaned) return first;
  const nl = cleaned.indexOf("\n");
  if (nl === -1) return first;
  return `${first}${cleaned.slice(nl)}`;
}

function inferType(message) {
  const m = String(message || "").trim().toLowerCase();
  const match = m.match(/^(fix|feat|feature|update|chore|docs)(\(|:|\b)/);
  if (!match) return "update";
  const prefix = match[1];
  if (prefix === "fix") return "fix";
  if (prefix === "feat" || prefix === "feature") return "feature";
  if (prefix === "docs") return "docs";
  return "update";
}

function isNewsType(value) {
  return value === "fix" || value === "feature" || value === "update" || value === "docs";
}

/** Ícone lógico (mapeado para SVG no frontend) — sem emoji. */
function iconForType(type) {
  const t = isNewsType(type) ? type : "update";
  if (t === "fix") return "fix";
  if (t === "feature") return "feature";
  if (t === "docs") return "docs";
  return "update";
}

function sortByPublishedAtDesc(list) {
  return [...list].sort((a, b) => {
    const tb = Date.parse(b.publishedAt) || 0;
    const ta = Date.parse(a.publishedAt) || 0;
    return tb - ta;
  });
}

function shortTitle(message, version) {
  const line = String(message || "")
    .trim()
    .split(/\r?\n/)[0]
    .trim();
  if (!line) return `Release ${version}`;
  return line.length > 120 ? `${line.slice(0, 117)}...` : line;
}

function emptyFile() {
  return { updatedAt: new Date().toISOString(), news: [] };
}

function isHtmlPayload(text) {
  const t = String(text || "").trim().toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html");
}

/**
 * Resolve a mensagem real do commit (ignora commits de publicação/release).
 */
function resolveRealCommitMessage(fallbackVersion) {
  const fromEnv = String(process.env.DEPLOY_COMMIT_MESSAGE || "").trim();
  if (fromEnv && !isIgnoredCommitMessage(fromEnv)) {
    return stripCoAuthoredByLines(fromEnv) || fromEnv;
  }

  const subjects = run("git log -40 --format=%s")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const subject of subjects) {
    if (!isIgnoredCommitMessage(subject)) {
      return stripCoAuthoredByLines(subject) || subject;
    }
  }

  if (fromEnv) return stripCoAuthoredByLines(fromEnv) || fromEnv;
  return `Release ${fallbackVersion || ""}`.trim();
}

function resolveCommitHash() {
  const fromEnv = process.env.DEPLOY_SHA || process.env.GITHUB_SHA || "";
  if (fromEnv && /^[0-9a-f]{7,40}$/i.test(fromEnv)) {
    return fromEnv.slice(0, 7).toLowerCase();
  }
  const short = run("git rev-parse --short HEAD");
  return short || undefined;
}

function messageForCommitHash(hash) {
  if (!hash) return "";
  const subject = run(`git log -1 --format=%s ${hash}`);
  if (subject && !isIgnoredCommitMessage(subject)) return subject;
  // Commit de publicação: usar o pai
  const parent = run(`git log -1 --format=%s ${hash}^`);
  if (parent && !isIgnoredCommitMessage(parent)) return parent;
  const walk = run(`git log -15 --format=%s ${hash}`)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !isIgnoredCommitMessage(s));
  return walk[0] || "";
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const version = typeof raw.version === "string" ? raw.version.trim() : "";
  if (!version) return null;
  let description =
    typeof raw.description === "string"
      ? raw.description
      : typeof raw.commitMessage === "string"
        ? raw.commitMessage
        : "";
  description = stripCoAuthoredByLines(description);
  const commit =
    typeof raw.commit === "string" && raw.commit.trim() ? raw.commit.trim() : undefined;

  // Corrigir entradas históricas com texto fixo de publicação
  if (isIgnoredCommitMessage(description) && commit) {
    const repaired = messageForCommitHash(commit);
    if (repaired) description = stripCoAuthoredByLines(repaired);
  }
  if (isIgnoredCommitMessage(description)) {
    description = "";
  }
  if (shouldIgnoreCommitByScope(description || String(raw.title || ""))) {
    return null;
  }

  const publishedAt =
    typeof raw.publishedAt === "string" && raw.publishedAt
      ? raw.publishedAt
      : new Date().toISOString();
  const type = isNewsType(raw.type)
    ? raw.type
    : inferType(description || String(raw.title || ""));
  let title =
    typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : shortTitle(description, version);
  if (isIgnoredCommitMessage(title)) {
    title = shortTitle(description, version);
  }
  const sourceText = description || title;
  title = friendlyTitleFromMessage(sourceText, version);
  description = friendlyDescriptionFromMessage(sourceText, version);
  if (!description) description = title;
  const author = typeof raw.author === "string" && raw.author.trim() ? raw.author.trim() : "pimo-pro";
  // Sem actionUrl — não exibir link GitHub Action
  const icon = iconForType(type);

  const out = { version, title, description, publishedAt, type, author, icon };
  if (commit) out.commit = commit;
  return out;
}

function readLocalNews() {
  try {
    if (!fs.existsSync(NEWS_PATH)) return emptyFile();
    const raw = fs.readFileSync(NEWS_PATH, "utf8").replace(/^\uFEFF/, "");
    if (isHtmlPayload(raw)) return emptyFile();
    const data = JSON.parse(raw);
    const list = Array.isArray(data.news)
      ? data.news
      : Array.isArray(data.publications)
        ? data.publications
        : [];
    return {
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
      news: list.map(normalizeEntry).filter(Boolean),
    };
  } catch {
    return emptyFile();
  }
}

async function fetchRemoteNews() {
  if (process.env.PIMO_NEWS_SKIP_REMOTE === "1") return null;
  try {
    const res = await fetch(PROD_NEWS_URL, {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (isHtmlPayload(text)) return null;
    const data = JSON.parse(text);
    const list = Array.isArray(data.news)
      ? data.news
      : Array.isArray(data.publications)
        ? data.publications
        : [];
    return list.map(normalizeEntry).filter(Boolean);
  } catch {
    return null;
  }
}

function mergeNews(localList, remoteList) {
  const byVersion = new Map();
  for (const entry of [...(remoteList || []), ...(localList || [])]) {
    if (!entry?.version) continue;
    const prev = byVersion.get(entry.version);
    if (!prev) {
      byVersion.set(entry.version, entry);
      continue;
    }
    const prevT = Date.parse(prev.publishedAt) || 0;
    const nextT = Date.parse(entry.publishedAt) || 0;
    const prevScore =
      (prev.commit ? 1 : 0) +
      (prev.description && !isIgnoredCommitMessage(prev.description) ? 2 : 0) +
      Math.min(3, Math.floor(String(prev.description || "").length / 80));
    const nextScore =
      (entry.commit ? 1 : 0) +
      (entry.description && !isIgnoredCommitMessage(entry.description) ? 2 : 0) +
      Math.min(3, Math.floor(String(entry.description || "").length / 80));
    if (
      nextT > prevT ||
      (nextT === prevT && nextScore > prevScore) ||
      (nextScore > prevScore &&
        String(entry.description || "").length > String(prev.description || "").length + 20)
    ) {
      // Preferir mensagem real / descrição longa sobre título curto de publicação.
      const merged = { ...prev, ...entry, icon: entry.icon || prev.icon };
      if (
        String(prev.description || "").length > String(merged.description || "").length + 20 &&
        !isIgnoredCommitMessage(prev.description)
      ) {
        merged.description = prev.description;
        if (prev.title && !isIgnoredCommitMessage(prev.title)) merged.title = prev.title;
      }
      if (
        isIgnoredCommitMessage(merged.description) &&
        prev.description &&
        !isIgnoredCommitMessage(prev.description)
      ) {
        merged.description = prev.description;
        merged.title = prev.title;
        merged.type = prev.type;
        merged.icon = prev.icon;
      }
      delete merged.actionUrl;
      byVersion.set(entry.version, merged);
    } else if (
      String(prev.description || "").length + 20 < String(entry.description || "").length &&
      !isIgnoredCommitMessage(entry.description)
    ) {
      // Mesmo publishedAt antigo: adoptar descrição mais completa.
      byVersion.set(entry.version, {
        ...prev,
        ...entry,
        description: entry.description,
        title: entry.title || prev.title,
        icon: entry.icon || prev.icon,
      });
    }
  }
  return sortByPublishedAtDesc([...byVersion.values()]);
}

function writeNews(file) {
  fs.mkdirSync(path.dirname(NEWS_PATH), { recursive: true });
  const payload = {
    updatedAt: new Date().toISOString(),
    news: sortByPublishedAtDesc(file.news).slice(0, MAX_ENTRIES),
  };
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  JSON.parse(json);
  fs.writeFileSync(NEWS_PATH, json, "utf8");
  return payload;
}

function resolveMeta() {
  const version =
    process.env.DEPLOY_VERSION ||
    process.env.GITHUB_REF_NAME ||
    (() => {
      try {
        const v = JSON.parse(fs.readFileSync(path.join(rootDir, "version.json"), "utf8"));
        return v.version || "";
      } catch {
        return "";
      }
    })() ||
    run("git describe --tags --exact-match HEAD 2>nul") ||
    "unknown";

  const commitMessage = resolveRealCommitMessage(version);
  const author = process.env.DEPLOY_AUTHOR || run("git log -1 --format=%an") || "pimo-pro";
  const publishedAt = process.env.DEPLOY_PUBLISHED_AT || new Date().toISOString();
  const type = isNewsType(process.env.DEPLOY_NEWS_TYPE)
    ? process.env.DEPLOY_NEWS_TYPE
    : inferType(commitMessage);

  const entry = {
    version: String(version).trim(),
    title: friendlyTitleFromMessage(commitMessage, version),
    description: friendlyDescriptionFromMessage(commitMessage, version),
    publishedAt,
    type,
    author: String(author).trim() || "pimo-pro",
    icon: iconForType(type),
    skipByScope: shouldIgnoreCommitByScope(commitMessage),
  };

  const commit = resolveCommitHash();
  if (commit) entry.commit = commit;

  return entry;
}

async function main() {
  const local = readLocalNews();
  const remote = await fetchRemoteNews();
  let news = mergeNews(local.news, remote);

  const entry = resolveMeta();
  if (!entry.version || entry.version === "unknown") {
    console.error("appendWhatsNewNews: versão inválida — abort.");
    process.exit(1);
  }

  const skipByScope = Boolean(entry.skipByScope);
  delete entry.skipByScope;
  if (skipByScope) {
    console.log(
      `Whats New: ${entry.version} ignorado (scope técnico) — sem nova entrada`
    );
  }

  // Preservar título/descrição já preparados no repo (ex.: release notes manuais).
  // Preferir sempre a descrição local mais longa (evita truncar para o título em re-deploys).
  const preset = local.news.find((n) => n.version === entry.version);
  if (
    !skipByScope &&
    preset &&
    preset.title &&
    !isIgnoredCommitMessage(preset.title) &&
    preset.description &&
    !isIgnoredCommitMessage(preset.description)
  ) {
    const presetLonger =
      String(preset.description).length > String(entry.description || "").length + 20;
    if (
      presetLonger ||
      preset.title !== entry.title ||
      preset.description !== entry.description
    ) {
      entry.title = preset.title;
      entry.description = preset.description;
      if (preset.type) entry.type = preset.type;
      if (preset.icon) entry.icon = preset.icon;
    }
  }
  // Commit do deploy actual (não reutilizar hash antigo em falta no shallow clone).
  const deployCommit = resolveCommitHash();
  if (deployCommit) entry.commit = deployCommit;

  if (!skipByScope) {
    news = news.filter((n) => n.version !== entry.version);
    news.push(entry);
  }
  news = sortByPublishedAtDesc(news)
    .map((n) => {
      const copy = { ...n };
      delete copy.actionUrl;
      delete copy.skipByScope;
      return copy;
    })
    .map(normalizeEntry)
    .filter(Boolean);

  const written = writeNews({ news });
  if (!skipByScope) {
    console.log(
      `Whats New: ${entry.version} (${entry.type} ${entry.icon}) → ${NEWS_REL} — total ${written.news.length} registos` +
        (entry.commit ? ` commit=${entry.commit}` : "")
    );
  } else {
    console.log(`Whats New: ficheiro limpo — total ${written.news.length} registos`);
  }
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((err) => {
    console.error("appendWhatsNewNews failed:", err);
    process.exit(1);
  });
}

export {
  inferType,
  isIgnoredCommitMessage,
  resolveRealCommitMessage,
  normalizeEntry,
  iconForType,
  stripCoAuthoredByLines,
  shouldIgnoreCommitByScope,
  friendlyTitleFromMessage,
  friendlyDescriptionFromMessage,
};

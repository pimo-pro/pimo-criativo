/**
 * Helpers de ligação Postgres para migrations (sem side-effects de apply).
 */
import dns from "node:dns";
import { lookup as dnsLookup } from "node:dns/promises";
import pg from "pg";
import { projectRefFromSupabaseUrl } from "./migrateTargetGuard.mjs";

dns.setDefaultResultOrder("ipv4first");

const POOLER_REGIONS = [
  "eu-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-north-1",
  "us-east-1",
  "us-west-1",
  "ap-southeast-1",
];

const POOLER_PREFIXES = ["aws-1", "aws-0"];

export function resolveDatabaseUrl(env) {
  if (env.DATABASE_URL?.trim()) return env.DATABASE_URL.trim();
  const password = env.SUPABASE_DB_PASSWORD?.trim();
  const ref =
    env.SUPABASE_PROJECT_REF?.trim() ||
    projectRefFromSupabaseUrl(env.VITE_SUPABASE_URL) ||
    projectRefFromSupabaseUrl(env.SUPABASE_URL);
  const host = env.SUPABASE_DB_HOST?.trim() || `db.${ref}.supabase.co`;
  if (password && ref) {
    const user = env.SUPABASE_DB_USER?.trim() || "postgres";
    const port = env.SUPABASE_DB_PORT?.trim() || "5432";
    const db = env.SUPABASE_DB_NAME?.trim() || "postgres";
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${db}`;
  }
  return "";
}

export function parsePgConfig(connectionString) {
  const normalized = connectionString
    .trim()
    .replace(/^postgres:\/\//, "postgresql://");
  if (!normalized.startsWith("postgresql://")) {
    throw new Error("URI Postgres inválida.");
  }

  const withoutProto = normalized.slice("postgresql://".length);
  const atIdx = withoutProto.lastIndexOf("@");
  if (atIdx === -1) {
    throw new Error("URI Postgres sem credenciais.");
  }

  const userPart = withoutProto.slice(0, atIdx);
  const hostPart = withoutProto.slice(atIdx + 1);
  const colonIdx = userPart.indexOf(":");
  const user = decodeURIComponent(
    colonIdx === -1 ? userPart : userPart.slice(0, colonIdx),
  );
  const password = decodeURIComponent(
    colonIdx === -1 ? "" : userPart.slice(colonIdx + 1),
  );

  const slashIdx = hostPart.indexOf("/");
  const hostPort = slashIdx === -1 ? hostPart : hostPart.slice(0, slashIdx);
  const database =
    (slashIdx === -1 ? "postgres" : hostPart.slice(slashIdx + 1)).split(
      "?",
    )[0] || "postgres";
  const [host, portStr] = hostPort.includes(":")
    ? [
        hostPort.slice(0, hostPort.lastIndexOf(":")),
        hostPort.slice(hostPort.lastIndexOf(":") + 1),
      ]
    : [hostPort, "5432"];

  return {
    host,
    port: Number(portStr || 5432),
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false },
  };
}

async function ipv4DatabaseUrl(databaseUrl) {
  try {
    const config = parsePgConfig(databaseUrl);
    if (!config.host.endsWith(".supabase.co")) return null;
    const { address } = await dnsLookup(config.host, { family: 4 });
    return `postgresql://${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}@${address}:${config.port}/${config.database}`;
  } catch {
    return null;
  }
}

function buildPoolerUrls(databaseUrl, preferredRegion, overridePassword) {
  try {
    const config = parsePgConfig(databaseUrl);
    const directMatch = config.host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (!directMatch) return [];

    const ref = directMatch[1];
    const rawPassword = overridePassword || config.password;
    const password = encodeURIComponent(rawPassword);
    const database = config.database;
    const regions = preferredRegion
      ? [
          preferredRegion,
          ...POOLER_REGIONS.filter((r) => r !== preferredRegion),
        ]
      : POOLER_REGIONS;

    const urls = [];
    for (const prefix of POOLER_PREFIXES) {
      for (const region of regions) {
        for (const port of ["6543", "5432"]) {
          urls.push(
            `postgresql://postgres.${ref}:${password}@${prefix}-${region}.pooler.supabase.com:${port}/${database}`,
          );
        }
      }
    }
    urls.push(
      `postgresql://postgres.${ref}:${password}@db.${ref}.supabase.co:6543/${database}`,
    );
    return urls;
  } catch {
    return [];
  }
}

export async function connectionCandidates(env) {
  const primary = resolveDatabaseUrl(env);
  if (!primary) return [];

  const primaryConfig = parsePgConfig(primary);
  if (primaryConfig.host.includes("pooler.supabase.com")) {
    return [primary];
  }

  const overridePassword = env.SUPABASE_DB_PASSWORD?.trim() || "";
  const preferredRegion = env.SUPABASE_REGION?.trim() || "eu-central-1";
  const ipv4Direct = await ipv4DatabaseUrl(primary);
  const pooler = buildPoolerUrls(
    primary,
    preferredRegion,
    overridePassword || undefined,
  );
  return [...new Set([ipv4Direct, ...pooler].filter(Boolean))];
}

export async function connectPg(candidates, log = console) {
  let lastError;
  for (let i = 0; i < candidates.length; i += 1) {
    const connectionString = candidates[i];
    const label = i === 0 ? "primary" : `fallback-${i}`;
    const config = parsePgConfig(connectionString);
    const client = new pg.Client(config);
    try {
      log.log(
        `Tentativa de ligação (${label}) → ${config.user}@${config.host}:${config.port}`,
      );
      await client.connect();
      log.log(`Ligação OK (${label}).`);
      return client;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      log.warn(`Falha (${label}): ${message}`);
      await client.end().catch(() => undefined);
    }
  }
  throw (
    lastError ??
    new Error(
      "Não foi possível ligar ao Postgres. Use DATABASE_URL = URI Session pooler do Supabase Dashboard, " +
        "ou adicione SUPABASE_DB_PASSWORD (password raw) nos secrets GitHub.",
    )
  );
}

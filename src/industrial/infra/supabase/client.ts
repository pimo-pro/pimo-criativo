import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  allowIndustrialDirectWrite,
  blockedIndustrialWriteResult,
} from './writePolicy';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
let browserClient: SupabaseClient | null = null;

const MUTATION_METHODS = new Set(['insert', 'update', 'upsert', 'delete']);

/**
 * Cliente browser do Supabase para o pacote industrial.
 * Mantem a configuracao isolada em `industrial/infra` e usa variaveis Vite.
 */
export function createSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase industrial requer VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export function getSupabaseClient(): SupabaseClient {
  browserClient ??= createSupabaseClient();
  return browserClient;
}

/**
 * Builder thenable mínimo quando writes directos estão bloqueados (Phase 1).
 * Compatível com padrões `.insert().select().single()` e `await query`.
 */
function createBlockedMutationBuilder(op: string): unknown {
  const result = blockedIndustrialWriteResult(op);
  const builder: Record<string, unknown> = {};
  const passthrough = () => builder;
  for (const key of [
    'select',
    'eq',
    'neq',
    'in',
    'is',
    'order',
    'limit',
    'range',
    'single',
    'maybeSingle',
    'throwOnError',
    'csv',
    'filter',
    'match',
    'not',
    'or',
    'gte',
    'lte',
    'gt',
    'lt',
    'like',
    'ilike',
    'contains',
    'containedBy',
    'overlap',
  ]) {
    builder[key] = passthrough;
  }
  builder.then = (
    onfulfilled?: (v: typeof result) => unknown,
    onrejected?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(onfulfilled, onrejected);
  return builder;
}

function wrapTableBuilder(table: string, query: unknown): unknown {
  return new Proxy(query as object, {
    get(target, property, receiver) {
      const key = String(property);
      if (MUTATION_METHODS.has(key)) {
        return (..._args: unknown[]) => {
          if (allowIndustrialDirectWrite(`${table}.${key}`)) {
            const orig = Reflect.get(target, property, receiver);
            return typeof orig === 'function' ? (orig as (...a: unknown[]) => unknown).apply(target, _args) : orig;
          }
          return createBlockedMutationBuilder(`${table}.${key}`);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}

/**
 * Proxy lazy: permite importar o pacote industrial antes de configurar Supabase.
 * Phase 1: intercepta insert/update/upsert/delete quando writes directos estão off.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, _receiver) {
    if (property === 'from') {
      return (table: string) => wrapTableBuilder(table, getSupabaseClient().from(table));
    }
    const client = getSupabaseClient();
    const value = Reflect.get(client, property, client);
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});

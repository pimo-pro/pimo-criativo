/**
 * Parser STEP IFC (IFC2x3 / IFC4) — extrai entidades sem WASM.
 */
import type { IfcEntity, IfcParsedDocument, IfcSchema, IfcValue } from "./IfcTypes";

function detectSchema(header: string): IfcSchema {
  const upper = header.toUpperCase();
  if (upper.includes("IFC4X3")) return "IFC4X3";
  if (upper.includes("IFC4")) return "IFC4";
  if (upper.includes("IFC2X3") || upper.includes("IFC2X3")) return "IFC2X3";
  if (upper.includes("'IFC2X3'")) return "IFC2X3";
  return "UNKNOWN";
}

function parseArgs(raw: string): IfcValue[] {
  const args: IfcValue[] = [];
  let i = 0;
  const s = raw;

  const skipWs = () => {
    while (i < s.length && /\s/.test(s[i]!)) i++;
  };

  const parseValue = (): IfcValue => {
    skipWs();
    if (i >= s.length) return null;
    const ch = s[i]!;

    if (ch === "$" || ch === "*") {
      i++;
      return null;
    }
    if (ch === ".") {
      const end = s.indexOf(".", i + 1);
      if (end < 0) {
        i = s.length;
        return null;
      }
      const token = s.slice(i + 1, end).toUpperCase();
      i = end + 1;
      if (token === "T") return true;
      if (token === "F") return false;
      return token;
    }
    if (ch === "'") {
      i++;
      let out = "";
      while (i < s.length) {
        if (s[i] === "'" && s[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        if (s[i] === "'") {
          i++;
          break;
        }
        out += s[i];
        i++;
      }
      return out;
    }
    if (ch === "#") {
      i++;
      let num = "";
      while (i < s.length && /\d/.test(s[i]!)) {
        num += s[i];
        i++;
      }
      return { ref: Number(num) };
    }
    if (ch === "(") {
      i++;
      const list: IfcValue[] = [];
      skipWs();
      if (s[i] === ")") {
        i++;
        return list;
      }
      while (i < s.length) {
        list.push(parseValue());
        skipWs();
        if (s[i] === ",") {
          i++;
          continue;
        }
        if (s[i] === ")") {
          i++;
          break;
        }
        break;
      }
      return list;
    }
    // number or typed aggregate prefix like IFCLENGTHMEASURE(1.2)
    if (/[A-Za-z_]/.test(ch)) {
      let name = "";
      while (i < s.length && /[A-Za-z0-9_]/.test(s[i]!)) {
        name += s[i];
        i++;
      }
      skipWs();
      if (s[i] === "(") {
        const inner = parseValue();
        return Array.isArray(inner) ? inner : [inner];
      }
      return name;
    }
    let num = "";
    if (ch === "-" || ch === "+") {
      num += ch;
      i++;
    }
    while (i < s.length && /[0-9.eE+-]/.test(s[i]!) && !/,|\)/.test(s[i]!)) {
      // stop at comma/paren handled below
      if ((s[i] === "+" || s[i] === "-") && num.length > 0 && !/[eE]$/.test(num)) break;
      if (s[i] === "," || s[i] === ")") break;
      num += s[i];
      i++;
    }
    if (num && /[0-9]/.test(num)) return Number(num);
    return null;
  };

  skipWs();
  if (!s.length) return args;
  while (i < s.length) {
    args.push(parseValue());
    skipWs();
    if (s[i] === ",") {
      i++;
      continue;
    }
    break;
  }
  return args;
}

/** Divide DATA section em statements `#id=TYPE(...);` respeitando strings. */
function splitStatements(data: string): string[] {
  const out: string[] = [];
  let start = 0;
  let inStr = false;
  for (let i = 0; i < data.length; i++) {
    const c = data[i]!;
    if (c === "'") {
      if (inStr && data[i + 1] === "'") {
        i++;
        continue;
      }
      inStr = !inStr;
      continue;
    }
    if (!inStr && c === ";") {
      const stmt = data.slice(start, i).trim();
      if (stmt.startsWith("#")) out.push(stmt);
      start = i + 1;
    }
  }
  return out;
}

export const IfcParser = {
  parse(text: string): IfcParsedDocument {
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const schema = detectSchema(normalized);
    const dataMatch = normalized.match(/DATA;\s*([\s\S]*?)\s*ENDSEC;/i);
    const data = dataMatch?.[1] ?? normalized;
    const entities = new Map<number, IfcEntity>();
    const byType = new Map<string, IfcEntity[]>();

    for (const stmt of splitStatements(data)) {
      const m = stmt.match(/^#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\(([\s\S]*)\)\s*$/);
      if (!m) continue;
      const id = Number(m[1]);
      const type = m[2]!.toUpperCase();
      const args = parseArgs(m[3] ?? "");
      const entity: IfcEntity = { id, type, args };
      entities.set(id, entity);
      const list = byType.get(type) ?? [];
      list.push(entity);
      byType.set(type, list);
    }

    return { schema, entities, byType };
  },

  get(doc: IfcParsedDocument, id: number): IfcEntity | undefined {
    return doc.entities.get(id);
  },

  resolveRef(doc: IfcParsedDocument, value: IfcValue): IfcEntity | null {
    if (value && typeof value === "object" && !Array.isArray(value) && "ref" in value) {
      return doc.entities.get(value.ref) ?? null;
    }
    return null;
  },

  asString(v: IfcValue, fallback = ""): string {
    return typeof v === "string" ? v : fallback;
  },

  asNumber(v: IfcValue, fallback = 0): number {
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  },

  asRefId(v: IfcValue): number | null {
    if (v && typeof v === "object" && !Array.isArray(v) && "ref" in v) return v.ref;
    return null;
  },
};

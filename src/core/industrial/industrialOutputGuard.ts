/**
 * Proteção de saídas industriais — TCN, TXML, PDF Layout PRO e Cutlist.
 *
 * Geradores industriais permanecem imutáveis; apenas consumidores autorizados
 * (comandos explícitos do utilizador) podem invocar exportação.
 */

export type IndustrialOutputKind =
  | "tcn"
  | "txml"
  | "pdf-layout-pro"
  | "pdf-layout-manual"
  | "pdf-cutlist"
  | "pdf-etiquetas"
  | "pdf-ferragens-industriais"
  | "xlsx-ferragens-industriais";

export type IndustrialRequiredArtifactKind =
  | "pdf-ferragens-industriais"
  | "xlsx-ferragens-industriais";

export const INDUSTRIAL_REQUIRED_ARTIFACT_KINDS: readonly IndustrialRequiredArtifactKind[] = [
  "pdf-ferragens-industriais",
  "xlsx-ferragens-industriais",
] as const;

const ALL_OUTPUT_KINDS: IndustrialOutputKind[] = [
  "tcn",
  "txml",
  "pdf-layout-pro",
  "pdf-layout-manual",
  "pdf-cutlist",
  "pdf-etiquetas",
  "pdf-ferragens-industriais",
  "xlsx-ferragens-industriais",
];

export class IndustrialOutputBlockedError extends Error {
  readonly kind: IndustrialOutputKind;

  constructor(kind: IndustrialOutputKind) {
    super(
      `Saída industrial bloqueada (${kind}): requer autorização explícita do utilizador via withIndustrialOutputAuthorization.`
    );
    this.name = "IndustrialOutputBlockedError";
    this.kind = kind;
  }
}

export class IndustrialRequiredArtifactsMissingError extends Error {
  readonly missing: IndustrialRequiredArtifactKind[];

  constructor(missing: IndustrialRequiredArtifactKind[]) {
    super(
      `Saída industrial bloqueada: artefactos obrigatórios em falta (${missing.join(", ")}).`
    );
    this.name = "IndustrialRequiredArtifactsMissingError";
    this.missing = missing;
  }
}

/** Módulos geradores protegidos — não alterar sem comando explícito do utilizador. */
export const INDUSTRIAL_LOCKED_GENERATOR_PATHS = [
  "src/core/cnc/tcnGeneratorV2New.ts",
  "src/core/cnc/tcnGeneratorNestingMo.ts",
  "src/core/cnc/cncExport.ts",
  "src/core/drill/drillExport.ts",
  "src/core/cutlayout/cutLayoutPdf.ts",
  "src/core/pdf/pdfCutlist.ts",
  "src/core/pdf/pdfEtiquetas.ts",
  "src/core/pdf/pdfFerragensIndustriais.ts",
  "src/core/xlsx/xlsxFerragensIndustriais.ts",
] as const;

let authorizationDepth = 0;
const authorizedKinds = new Set<IndustrialOutputKind>();
let sessionDepth = 0;

let requiredArtifactTrackingDepth = 0;
const registeredRequiredArtifacts = new Set<IndustrialRequiredArtifactKind>();

let testBypassDisabled = false;

/** Apenas testes — força o guard mesmo em ambiente Vitest. */
export function __disableIndustrialOutputTestBypass(disable: boolean): void {
  testBypassDisabled = disable;
}

function isTestEnvironment(): boolean {
  if (testBypassDisabled) return false;
  return typeof import.meta !== "undefined" && import.meta.env?.MODE === "test";
}

/** Inicia sessão autorizada (chamado por beginIndustrialFileGeneration). */
export function beginIndustrialOutputSession(): void {
  sessionDepth += 1;
  authorizationDepth += 1;
}

/** Termina sessão autorizada (chamado por endIndustrialFileGeneration). */
export function endIndustrialOutputSession(): void {
  sessionDepth = Math.max(0, sessionDepth - 1);
  authorizationDepth = Math.max(0, authorizationDepth - 1);
}

export function isIndustrialOutputSessionActive(): boolean {
  return sessionDepth > 0;
}

export function beginIndustrialRequiredArtifactTracking(): void {
  requiredArtifactTrackingDepth += 1;
  registeredRequiredArtifacts.clear();
}

export function endIndustrialRequiredArtifactTracking(): void {
  requiredArtifactTrackingDepth = Math.max(0, requiredArtifactTrackingDepth - 1);
  if (requiredArtifactTrackingDepth === 0) {
    registeredRequiredArtifacts.clear();
  }
}

export function resetIndustrialRequiredArtifacts(): void {
  if (requiredArtifactTrackingDepth > 0) {
    registeredRequiredArtifacts.clear();
  }
}

export function registerIndustrialRequiredArtifact(kind: IndustrialRequiredArtifactKind): void {
  if (requiredArtifactTrackingDepth > 0) {
    registeredRequiredArtifacts.add(kind);
  }
}

export function assertIndustrialRequiredArtifactsComplete(): void {
  if (requiredArtifactTrackingDepth <= 0) return;
  const missing = INDUSTRIAL_REQUIRED_ARTIFACT_KINDS.filter(
    (kind) => !registeredRequiredArtifacts.has(kind)
  );
  if (missing.length > 0) {
    throw new IndustrialRequiredArtifactsMissingError(missing);
  }
}

export function isIndustrialOutputAuthorized(kind: IndustrialOutputKind): boolean {
  if (isTestEnvironment()) return true;
  if (authorizationDepth <= 0) return false;
  if (authorizedKinds.size === 0) return true;
  return authorizedKinds.has(kind);
}

export function assertIndustrialOutputAuthorized(kind: IndustrialOutputKind): void {
  if (!isIndustrialOutputAuthorized(kind)) {
    throw new IndustrialOutputBlockedError(kind);
  }
}

export type IndustrialOutputAuthorizationScope = IndustrialOutputKind | IndustrialOutputKind[] | "all";

function resolveAuthorizationKinds(
  scope: IndustrialOutputAuthorizationScope
): IndustrialOutputKind[] {
  if (scope === "all") return [...ALL_OUTPUT_KINDS];
  return Array.isArray(scope) ? scope : [scope];
}

/**
 * Autoriza exportações industriais durante a execução de um handler explícito do utilizador.
 */
export function withIndustrialOutputAuthorization<T>(
  scope: IndustrialOutputAuthorizationScope,
  fn: () => T
): T {
  authorizationDepth += 1;
  const kindsToAdd = resolveAuthorizationKinds(scope);

  for (const kind of kindsToAdd) {
    authorizedKinds.add(kind);
  }

  try {
    return fn();
  } finally {
    for (const kind of kindsToAdd) {
      authorizedKinds.delete(kind);
    }
    authorizationDepth = Math.max(0, authorizationDepth - 1);
  }
}

export async function withIndustrialOutputAuthorizationAsync<T>(
  scope: IndustrialOutputAuthorizationScope,
  fn: () => Promise<T>
): Promise<T> {
  authorizationDepth += 1;
  const kindsToAdd = resolveAuthorizationKinds(scope);

  for (const kind of kindsToAdd) {
    authorizedKinds.add(kind);
  }

  try {
    return await fn();
  } finally {
    for (const kind of kindsToAdd) {
      authorizedKinds.delete(kind);
    }
    authorizationDepth = Math.max(0, authorizationDepth - 1);
  }
}

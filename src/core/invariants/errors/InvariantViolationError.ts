// @pimo-soon — funcionalidade incompleta, será expandida na próxima fase

export class InvariantViolationError extends Error {
  readonly issues: import("../types").InvariantIssue[];

  constructor(issues: import("../types").InvariantIssue[]) {
    const count = issues.filter((i) => i.severity === "error").length;
    super(
      `Geração bloqueada: ${count} violação(ões) de invariantes. Active «Permitir geração com erros» no admin ou corrija os problemas.`
    );
    this.name = "InvariantViolationError";
    this.issues = issues;
  }

  formatForToast(): string {
    const errors = this.issues.filter((i) => i.severity === "error");
    const first = errors[0];
    if (!first) return this.message;
    const more = errors.length > 1 ? ` (+${errors.length - 1} mais)` : "";
    return `${first.ruleName}: ${first.message}${more}`;
  }
}

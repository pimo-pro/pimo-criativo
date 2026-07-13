// @pimo-soon — funcionalidade incompleta, será expandida na próxima fase

import { createRulesStore } from "../../../admin/rules/shared/createRulesStore";
import { BUILTIN_RULE_SEEDS, INVARIANT_SYSTEM_DEFAULTS } from "./invariantDefaults";
import type { InvariantRuleConfig, InvariantSystemConfig } from "../types";

const store = createRulesStore<InvariantSystemConfig>("invariants", INVARIANT_SYSTEM_DEFAULTS);

function mergeWithBuiltinSeeds(config: InvariantSystemConfig): InvariantSystemConfig {
  const byValidator = new Map(config.rules.map((r) => [r.validatorId, r]));
  const mergedRules: InvariantRuleConfig[] = [];

  for (const seed of BUILTIN_RULE_SEEDS) {
    const existing = byValidator.get(seed.validatorId);
    if (existing) {
      mergedRules.push({ ...seed, ...existing, id: existing.id || seed.id });
      byValidator.delete(seed.validatorId);
    } else {
      mergedRules.push(seed);
    }
  }

  for (const custom of config.rules) {
    if (!BUILTIN_RULE_SEEDS.some((s) => s.validatorId === custom.validatorId)) {
      mergedRules.push(custom);
    }
  }

  return {
    blockGenerationOnErrors: config.blockGenerationOnErrors ?? false,
    rules: mergedRules,
  };
}

export const invariantRulesStore = {
  get(): InvariantSystemConfig {
    return mergeWithBuiltinSeeds(store.get());
  },
  set(value: InvariantSystemConfig): void {
    store.set(mergeWithBuiltinSeeds(value));
  },
  patch(partial: Partial<InvariantSystemConfig>): void {
    store.patch(mergeWithBuiltinSeeds({ ...store.get(), ...partial }));
  },
  reset(): void {
    store.reset();
  },
  subscribe(listener: () => void): () => void {
    return store.subscribe(listener);
  },
  setBlockGenerationOnErrors(block: boolean): void {
    this.patch({ blockGenerationOnErrors: block });
  },
  isGenerationBlockedOnErrors(): boolean {
    return this.get().blockGenerationOnErrors;
  },
  getEnabledRules(): InvariantRuleConfig[] {
    return this.get().rules.filter((r) => r.enabled);
  },
  upsertRule(rule: InvariantRuleConfig): void {
    const current = this.get();
    const idx = current.rules.findIndex((r) => r.id === rule.id);
    const rules =
      idx >= 0
        ? current.rules.map((r, i) => (i === idx ? rule : r))
        : [...current.rules, rule];
    this.set({ ...current, rules });
  },
  removeRule(ruleId: string): void {
    const current = this.get();
    this.set({ ...current, rules: current.rules.filter((r) => r.id !== ruleId) });
  },
  toggleRule(ruleId: string, enabled: boolean): void {
    const current = this.get();
    this.set({
      ...current,
      rules: current.rules.map((r) => (r.id === ruleId ? { ...r, enabled } : r)),
    });
  },
};

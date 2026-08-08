<?php
/**
 * Exemplo de configuração — copiar para githubSyncConfig.php (não versionado)
 * ou definir PIMO_GITHUB_PROJECTS_TOKEN no ambiente do Hostinger.
 *
 * Token: PAT fine-grained com contents:write apenas em pimo-pro/pimo-projetos.
 */
declare(strict_types=1);

return [
    /** false = no-op (save do PIMO continua normal) */
    "enabled" => true,
    "owner" => "pimo-pro",
    "repo" => "pimo-projetos",
    "branch" => "main",
    /**
     * Preferir variável de ambiente. Se vazio, usa o valor abaixo (só em ficheiro local).
     * Nunca colocar token real neste ficheiro .example.
     */
    "token" => "",
    /** Timeout HTTP para a API GitHub (segundos) */
    "timeoutSeconds" => 12,
];

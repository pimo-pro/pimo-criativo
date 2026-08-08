<?php
/**
 * Sincronização best-effort de projetos PIMO → GitHub (pimo-pro/pimo-projetos).
 * Nunca falha o save local: erros só vão para log.
 */
declare(strict_types=1);

require_once __DIR__ . "/githubSyncMapper.php";

/**
 * Ponto de entrada chamado após gravação local bem-sucedida.
 *
 * @param array<string, mixed> $project
 * @param "save"|"rename"|"delete" $op
 */
function pimo_github_sync_project(array $project, string $op = "save"): void
{
    try {
        @set_time_limit(30);
        if (function_exists("ignore_user_abort")) {
            @ignore_user_abort(true);
        }

        $config = pimo_github_sync_load_config();
        if ($config === null || empty($config["enabled"])) {
            return;
        }
        $token = trim((string)($config["token"] ?? ""));
        if ($token === "") {
            pimo_github_sync_local_error("Token ausente — sync no-op", $project, $op);
            return;
        }

        $owner = (string)($config["owner"] ?? "pimo-pro");
        $repo = (string)($config["repo"] ?? "pimo-projetos");
        $branch = (string)($config["branch"] ?? "main");
        $timeout = (int)($config["timeoutSeconds"] ?? 12);
        if ($timeout < 3) {
            $timeout = 3;
        }
        if ($timeout > 25) {
            $timeout = 25;
        }

        $ctx = [
            "token" => $token,
            "owner" => $owner,
            "repo" => $repo,
            "branch" => $branch,
            "timeout" => $timeout,
        ];

        $files = pimo_github_sync_build_files($project, $op);
        $written = [];
        $errors = [];

        foreach ($files as $file) {
            $path = $file["path"];
            $content = $file["content"];
            $isBinary = !pimo_github_sync_is_text_payload($content) || str_ends_with(strtolower($path), ".pdf");
            $result = pimo_github_sync_put_file(
                $ctx,
                $path,
                $content,
                "PIMO sync [{$op}] " . ($file["message"] ?? $path),
                $isBinary
            );
            if ($result["ok"]) {
                if (!empty($result["skipped"])) {
                    $written[] = ["path" => $path, "status" => "unchanged"];
                } else {
                    $written[] = ["path" => $path, "status" => "updated"];
                }
            } else {
                $errors[] = ["path" => $path, "error" => $result["error"] ?? "erro"];
            }
        }

        $logEntry = [
            "op" => $op,
            "at" => gmdate("c"),
            "ok" => $errors === [],
            "projectId" => $project["id"] ?? null,
            "projectName" => $project["name"] ?? null,
            "files" => $written,
            "error" => $errors === [] ? null : $errors,
        ];

        pimo_github_sync_append_logs($ctx, $project, $logEntry);

        if ($errors !== []) {
            pimo_github_sync_local_error(
                "Falhas parciais: " . json_encode($errors, JSON_UNESCAPED_UNICODE),
                $project,
                $op
            );
        }
    } catch (Throwable $e) {
        pimo_github_sync_local_error($e->getMessage(), $project, $op);
    }
}

/**
 * @return array<string, mixed>|null
 */
function pimo_github_sync_load_config(): ?array
{
    $configPath = __DIR__ . "/githubSyncConfig.php";
    $config = [];
    if (is_file($configPath)) {
        $loaded = include $configPath;
        if (is_array($loaded)) {
            $config = $loaded;
        }
    }

    $envToken = getenv("PIMO_GITHUB_PROJECTS_TOKEN");
    if (is_string($envToken) && trim($envToken) !== "") {
        $config["token"] = trim($envToken);
    }

    $envEnabled = getenv("PIMO_GITHUB_PROJECTS_SYNC");
    if (is_string($envEnabled) && $envEnabled !== "") {
        $config["enabled"] = in_array(strtolower($envEnabled), ["1", "true", "yes", "on"], true);
    }

    if ($config === []) {
        // Sem ficheiro e sem env → desligado
        return [
            "enabled" => false,
            "owner" => "pimo-pro",
            "repo" => "pimo-projetos",
            "branch" => "main",
            "token" => "",
            "timeoutSeconds" => 12,
        ];
    }

    if (!isset($config["enabled"])) {
        $config["enabled"] = !empty($config["token"]);
    }

    return $config;
}

/**
 * @param array{token:string,owner:string,repo:string,branch:string,timeout:int} $ctx
 * @return array{ok:bool,skipped?:bool,error?:string,sha?:string}
 */
function pimo_github_sync_put_file(array $ctx, string $path, string $content, string $message, bool $binary = false): array
{
    $existing = pimo_github_sync_get_file($ctx, $path);
    $newSha = hash("sha256", $content);

    if ($existing["ok"] && isset($existing["sha256"]) && $existing["sha256"] === $newSha) {
        return ["ok" => true, "skipped" => true, "sha" => $existing["gitSha"] ?? ""];
    }

    $payload = [
        "message" => $message,
        "content" => base64_encode($content),
        "branch" => $ctx["branch"],
    ];
    if ($existing["ok"] && !empty($existing["gitSha"])) {
        $payload["sha"] = $existing["gitSha"];
    }

    $url = sprintf(
        "https://api.github.com/repos/%s/%s/contents/%s",
        rawurlencode($ctx["owner"]),
        rawurlencode($ctx["repo"]),
        implode("/", array_map("rawurlencode", explode("/", $path)))
    );

    $res = pimo_github_sync_http($ctx, "PUT", $url, $payload);
    if (!$res["ok"]) {
        return ["ok" => false, "error" => $res["error"] ?? "PUT falhou"];
    }
    return ["ok" => true, "skipped" => false];
}

/**
 * @param array{token:string,owner:string,repo:string,branch:string,timeout:int} $ctx
 * @return array{ok:bool,gitSha?:string,sha256?:string,error?:string}
 */
function pimo_github_sync_get_file(array $ctx, string $path): array
{
    $url = sprintf(
        "https://api.github.com/repos/%s/%s/contents/%s?ref=%s",
        rawurlencode($ctx["owner"]),
        rawurlencode($ctx["repo"]),
        implode("/", array_map("rawurlencode", explode("/", $path))),
        rawurlencode($ctx["branch"])
    );
    $res = pimo_github_sync_http($ctx, "GET", $url, null);
    if (!$res["ok"]) {
        // 404 = ficheiro novo
        if (($res["status"] ?? 0) === 404) {
            return ["ok" => false, "error" => "not_found"];
        }
        return ["ok" => false, "error" => $res["error"] ?? "GET falhou"];
    }
    $body = $res["body"] ?? [];
    $gitSha = isset($body["sha"]) && is_string($body["sha"]) ? $body["sha"] : "";
    $decoded = "";
    if (isset($body["content"]) && is_string($body["content"])) {
        $decoded = base64_decode(str_replace("\n", "", $body["content"]), true);
        if ($decoded === false) {
            $decoded = "";
        }
    }
    return [
        "ok" => true,
        "gitSha" => $gitSha,
        "sha256" => hash("sha256", $decoded),
    ];
}

/**
 * @param array{token:string,owner:string,repo:string,branch:string,timeout:int} $ctx
 * @param array<string, mixed> $logEntry
 * @param array<string, mixed> $project
 */
function pimo_github_sync_append_logs(array $ctx, array $project, array $logEntry): void
{
    $id = isset($project["id"]) ? trim((string)$project["id"]) : "unknown";
    $line = json_encode($logEntry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($line === false) {
        return;
    }
    $line .= "\n";

    $day = gmdate("Y-m-d");
    $paths = [
        "projects/{$id}/sync.log.jsonl",
        "_logs/sync-{$day}.jsonl",
    ];

    foreach ($paths as $path) {
        $existing = pimo_github_sync_get_file($ctx, $path);
        $prev = "";
        $gitSha = null;
        if ($existing["ok"]) {
            // Re-fetch raw content via GET already decoded sha256; need actual content
            $url = sprintf(
                "https://api.github.com/repos/%s/%s/contents/%s?ref=%s",
                rawurlencode($ctx["owner"]),
                rawurlencode($ctx["repo"]),
                implode("/", array_map("rawurlencode", explode("/", $path))),
                rawurlencode($ctx["branch"])
            );
            $res = pimo_github_sync_http($ctx, "GET", $url, null);
            if ($res["ok"] && isset($res["body"]["content"]) && is_string($res["body"]["content"])) {
                $decoded = base64_decode(str_replace("\n", "", $res["body"]["content"]), true);
                $prev = $decoded !== false ? $decoded : "";
                $gitSha = isset($res["body"]["sha"]) && is_string($res["body"]["sha"])
                    ? $res["body"]["sha"]
                    : null;
            }
        }

        // Truncar logs muito grandes (manter cauda ~400KB)
        $max = 400000;
        $combined = $prev . $line;
        if (strlen($combined) > $max) {
            $combined = substr($combined, -$max);
            $nl = strpos($combined, "\n");
            if ($nl !== false) {
                $combined = substr($combined, $nl + 1);
            }
        }

        $payload = [
            "message" => "PIMO sync log [{$logEntry["op"]}] {$id}",
            "content" => base64_encode($combined),
            "branch" => $ctx["branch"],
        ];
        if (is_string($gitSha) && $gitSha !== "") {
            $payload["sha"] = $gitSha;
        }

        $url = sprintf(
            "https://api.github.com/repos/%s/%s/contents/%s",
            rawurlencode($ctx["owner"]),
            rawurlencode($ctx["repo"]),
            implode("/", array_map("rawurlencode", explode("/", $path)))
        );
        pimo_github_sync_http($ctx, "PUT", $url, $payload);
    }
}

/**
 * @param array{token:string,owner:string,repo:string,branch:string,timeout:int} $ctx
 * @param array<string, mixed>|null $jsonBody
 * @return array{ok:bool,status?:int,body?:array,error?:string}
 */
function pimo_github_sync_http(array $ctx, string $method, string $url, ?array $jsonBody): array
{
    $headers = [
        "Accept: application/vnd.github+json",
        "Authorization: Bearer " . $ctx["token"],
        "X-GitHub-Api-Version: 2022-11-28",
        "User-Agent: PIMO-Projetos-Sync",
    ];

    if (function_exists("curl_init")) {
        $ch = curl_init($url);
        if ($ch === false) {
            return ["ok" => false, "error" => "curl_init falhou"];
        }
        $opts = [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => $ctx["timeout"],
            CURLOPT_CONNECTTIMEOUT => min(5, $ctx["timeout"]),
        ];
        if ($jsonBody !== null) {
            $encoded = json_encode($jsonBody, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $opts[CURLOPT_POSTFIELDS] = $encoded === false ? "{}" : $encoded;
            $headers[] = "Content-Type: application/json";
            $opts[CURLOPT_HTTPHEADER] = $headers;
        }
        curl_setopt_array($ch, $opts);
        $raw = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $cerr = curl_error($ch);
        curl_close($ch);
        if ($raw === false) {
            return ["ok" => false, "status" => $status, "error" => $cerr !== "" ? $cerr : "curl_exec falhou"];
        }
        $body = json_decode($raw, true);
        if ($status >= 200 && $status < 300) {
            return ["ok" => true, "status" => $status, "body" => is_array($body) ? $body : []];
        }
        $msg = is_array($body) && isset($body["message"]) ? (string)$body["message"] : "HTTP {$status}";
        return ["ok" => false, "status" => $status, "body" => is_array($body) ? $body : [], "error" => $msg];
    }

    // Fallback file_get_contents
    $headerStr = implode("\r\n", $headers);
    $opts = [
        "http" => [
            "method" => $method,
            "header" => $headerStr,
            "timeout" => $ctx["timeout"],
            "ignore_errors" => true,
        ],
    ];
    if ($jsonBody !== null) {
        $encoded = json_encode($jsonBody, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $opts["http"]["content"] = $encoded === false ? "{}" : $encoded;
        $opts["http"]["header"] .= "\r\nContent-Type: application/json";
    }
    $raw = @file_get_contents($url, false, stream_context_create($opts));
    $status = 0;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
        $status = (int)$m[1];
    }
    if ($raw === false) {
        return ["ok" => false, "status" => $status, "error" => "file_get_contents falhou"];
    }
    $body = json_decode($raw, true);
    if ($status >= 200 && $status < 300) {
        return ["ok" => true, "status" => $status, "body" => is_array($body) ? $body : []];
    }
    $msg = is_array($body) && isset($body["message"]) ? (string)$body["message"] : "HTTP {$status}";
    return ["ok" => false, "status" => $status, "body" => is_array($body) ? $body : [], "error" => $msg];
}

function pimo_github_sync_is_text_payload(string $content): bool
{
    return !str_contains($content, "\0");
}

/**
 * @param array<string, mixed> $project
 */
function pimo_github_sync_local_error(string $message, array $project, string $op): void
{
    $line = sprintf(
        "[%s] op=%s id=%s name=%s error=%s\n",
        gmdate("c"),
        $op,
        isset($project["id"]) ? (string)$project["id"] : "-",
        isset($project["name"]) ? (string)$project["name"] : "-",
        $message
    );
    $logPath = __DIR__ . "/data/_github_sync_errors.log";
    @file_put_contents($logPath, $line, FILE_APPEND | LOCK_EX);
    error_log("[PIMO-GITHUB-SYNC] " . trim($line));
}

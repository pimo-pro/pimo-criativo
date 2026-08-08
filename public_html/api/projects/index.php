<?php
/**
 * API de projetos PIMO — persistência em JSON (Hostinger / PHP 8+).
 * Contrato alinhado com src/core/projects/projectsApi.ts
 */
declare(strict_types=1);

// Diagnóstico de routing/WAF: confirma que o script PHP é realmente executado.
// Visível em: Hostinger → Logs → PHP error log (ou equivalente).
// Remover após confirmar que o routing está correto e o sync funciona.
error_log(sprintf(
    "[PIMO-API] projects/index.php reached — method=%s uri=%s",
    $_SERVER["REQUEST_METHOD"] ?? "?",
    $_SERVER["REQUEST_URI"] ?? "?"
));

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

if (($_SERVER["REQUEST_METHOD"] ?? "") === "OPTIONS") {
    http_response_code(200);
    exit;
}

$dataDir = __DIR__ . "/data";
if (!is_dir($dataDir)) {
    if (!@mkdir($dataDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(
            ["status" => "error", "message" => "Não foi possível criar o diretório de dados"],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }
}

// Arquivo GitHub (best-effort) — no-op se ficheiro/config/token ausentes.
// Nunca falhar a API de projetos por causa do sync (evita HTTP 500 vazio).
$githubSyncPath = __DIR__ . "/githubSync.php";
if (is_file($githubSyncPath)) {
    try {
        require_once $githubSyncPath;
    } catch (Throwable $e) {
        error_log("[PIMO-API] githubSync.php falhou ao carregar: " . $e->getMessage());
    }
} else {
    error_log("[PIMO-API] githubSync.php ausente — sync GitHub desligado; API de projetos continua.");
}

function respond_json(array $data, int $code = 200): void
{
    http_response_code($code);
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($json === false) {
        http_response_code(500);
        echo '{"status":"error","message":"Falha ao serializar JSON"}';
        exit;
    }
    echo $json;
    exit;
}

/** IDs seguros para nome de ficheiro */
function sanitize_id(?string $id): ?string
{
    if ($id === null) {
        return null;
    }
    $id = trim($id);
    if ($id === "") {
        return null;
    }
    if (preg_match("/^[a-zA-Z0-9._-]{1,160}$/", $id)) {
        return $id;
    }
    return null;
}

function generate_id(): string
{
    return "pimo-" . bin2hex(random_bytes(8));
}

function project_path(string $dataDir, string $id): string
{
    return $dataDir . "/project-" . $id . ".json";
}

function thumbnail_from_project(array $data): ?string
{
    if (isset($data["thumbnailDataUrl"]) && (is_string($data["thumbnailDataUrl"]) || $data["thumbnailDataUrl"] === null)) {
        return $data["thumbnailDataUrl"];
    }
    $cd = $data["centerDisplay"] ?? null;
    if (is_array($cd) && array_key_exists("thumbnailDataUrl", $cd)) {
        $t = $cd["thumbnailDataUrl"];
        return is_string($t) || $t === null ? $t : null;
    }
    return null;
}

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";
$action = isset($_GET["action"]) ? (string)$_GET["action"] : "";

// --- GET ?action=load&id=... ---
if ($method === "GET" && $action === "load") {
    $id = sanitize_id($_GET["id"] ?? null);
    if ($id === null) {
        respond_json(["status" => "error", "message" => "id inválido"], 400);
    }
    $path = project_path($dataDir, $id);
    if (!is_file($path)) {
        respond_json(["status" => "error", "message" => "Não encontrado"], 404);
    }
    $raw = file_get_contents($path);
    $data = json_decode($raw !== false ? $raw : "null", true);
    if (!is_array($data)) {
        respond_json(["status" => "error", "message" => "Ficheiro inválido"], 500);
    }
    respond_json(["status" => "ok", "project" => $data]);
}

// --- PUT ?action=update&id=...  (rename) ---
if ($method === "PUT" && $action === "update") {
    $id = sanitize_id($_GET["id"] ?? null);
    if ($id === null) {
        respond_json(["status" => "error", "message" => "id inválido"], 400);
    }
    $path = project_path($dataDir, $id);
    if (!is_file($path)) {
        respond_json(["status" => "error", "message" => "Não encontrado"], 404);
    }
    $raw = file_get_contents($path);
    $data = json_decode($raw !== false ? $raw : "null", true);
    if (!is_array($data)) {
        respond_json(["status" => "error", "message" => "Ficheiro inválido"], 500);
    }
    $input = json_decode(file_get_contents("php://input") ?: "{}", true);
    if (!is_array($input)) {
        respond_json(["status" => "error", "message" => "JSON inválido"], 400);
    }
    $name = isset($input["name"]) ? trim((string)$input["name"]) : "";
    if ($name === "") {
        respond_json(["status" => "error", "message" => "name obrigatório"], 400);
    }
    $data["name"] = $name;
    if (isset($data["centerDisplay"]) && is_array($data["centerDisplay"])) {
        $data["centerDisplay"]["projectName"] = $name;
    }
    $data["updatedAt"] = gmdate("c");
    $encoded = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($encoded === false || file_put_contents($path, $encoded) === false) {
        respond_json(["status" => "error", "message" => "Falha ao gravar"], 500);
    }
    if (function_exists("pimo_github_sync_project")) {
        pimo_github_sync_project($data, "rename");
    }
    respond_json(["status" => "ok", "project" => $data]);
}

// --- DELETE ?action=delete&id=... ---
if ($method === "DELETE" && $action === "delete") {
    $id = sanitize_id($_GET["id"] ?? null);
    if ($id === null) {
        respond_json(["status" => "error", "message" => "id inválido"], 400);
    }
    $path = project_path($dataDir, $id);
    $deletedProject = null;
    if (is_file($path)) {
        $raw = file_get_contents($path);
        $decoded = json_decode($raw !== false ? $raw : "null", true);
        $deletedProject = is_array($decoded) ? $decoded : ["id" => $id];
        @unlink($path);
    }
    if (is_array($deletedProject) && function_exists("pimo_github_sync_project")) {
        pimo_github_sync_project($deletedProject, "delete");
    }
    respond_json(["status" => "ok"]);
}

// --- POST: criar ou atualizar projeto (corpo = PimoProjectData JSON) ---
if ($method === "POST") {
    $input = json_decode(file_get_contents("php://input") ?: "null", true);
    if (!is_array($input)) {
        respond_json(["status" => "error", "message" => "JSON inválido"], 400);
    }

    $now = gmdate("c");
    $incomingId = isset($input["id"]) ? trim((string)$input["id"]) : "";
    $sid = sanitize_id($incomingId);

    if ($sid !== null) {
        // UPSERT: usa o ID fornecido pelo cliente.
        // Atualiza o ficheiro se existir; cria-o se não existir.
        // Evita 404 quando o servidor perdeu os dados (ex.: redeployment, limpeza de disco).
        $id   = $sid;
        $path = project_path($dataDir, $id);
        if (is_file($path)) {
            $oldRaw    = file_get_contents($path);
            $old       = json_decode($oldRaw !== false ? $oldRaw : "null", true);
            $createdAt = is_array($old) && isset($old["createdAt"]) && is_string($old["createdAt"])
                ? $old["createdAt"]
                : $now;
        } else {
            // Ficheiro inexistente: criar com o ID fornecido (UPSERT — não retornar 404).
            $createdAt = isset($input["createdAt"]) && is_string($input["createdAt"])
                ? $input["createdAt"]
                : $now;
        }
        $input["id"]        = $id;
        $input["createdAt"] = $createdAt;
        $input["updatedAt"] = $now;
    } else {
        $id = generate_id();
        $path = project_path($dataDir, $id);
        $input["id"] = $id;
        if (!isset($input["createdAt"]) || !is_string($input["createdAt"])) {
            $input["createdAt"] = $now;
        }
        $input["updatedAt"] = $now;
    }

    $encoded = json_encode($input, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($encoded === false || file_put_contents($path, $encoded) === false) {
        respond_json(["status" => "error", "message" => "Falha ao gravar (permissões?)"], 500);
    }

    if (function_exists("pimo_github_sync_project")) {
        pimo_github_sync_project($input, "save");
    }

    respond_json(["status" => "ok", "project" => $input]);
}

// --- GET: listagem ?scope=mine|all&ownerId=... ---
if ($method === "GET" && $action === "") {
    $scope = isset($_GET["scope"]) ? (string)$_GET["scope"] : "mine";
    $ownerId = isset($_GET["ownerId"]) ? (string)$_GET["ownerId"] : "";
    $now = gmdate("c");

    $files = glob($dataDir . "/project-*.json") ?: [];
    $projects = [];

    foreach ($files as $file) {
        $raw = file_get_contents($file);
        $data = json_decode($raw !== false ? $raw : "null", true);
        if (!is_array($data)) {
            continue;
        }
        $pid = isset($data["id"]) ? trim((string)$data["id"]) : "";
        if ($pid === "") {
            continue;
        }
            // scope=all  → sem filtro: devolve TODOS os projectos do sistema,
        //               incluindo ownerId com prefixo "guest-" (visitantes),
        //               "anon-" (sistema legacy) e utilizadores registados.
        // scope=mine → filtra pelo ownerId exacto enviado pelo cliente.
        if ($scope === "mine" && $ownerId !== "") {
            if (($data["ownerId"] ?? "") !== $ownerId) {
                continue;
            }
        }

        $projects[] = [
            "id" => $pid,
            "name" => isset($data["name"]) ? (string)$data["name"] : "Projeto",
            "sequence" => 0,
            "createdAt" => isset($data["createdAt"]) && is_string($data["createdAt"]) ? $data["createdAt"] : $now,
            "updatedAt" => isset($data["updatedAt"]) && is_string($data["updatedAt"]) ? $data["updatedAt"] : (isset($data["createdAt"]) ? $data["createdAt"] : ""),
            "ownerId" => isset($data["ownerId"]) ? (string)$data["ownerId"] : "usuario-local",
            "ownerName" => isset($data["ownerName"]) ? (string)$data["ownerName"] : (string)($data["ownerId"] ?? "Utilizador"),
            "thumbnailDataUrl" => thumbnail_from_project($data),
        ];
    }

    usort(
        $projects,
        static function (array $a, array $b): int {
            return strcmp($b["updatedAt"] ?? "", $a["updatedAt"] ?? "");
        }
    );

    foreach ($projects as $i => &$p) {
        $p["sequence"] = $i + 1;
    }
    unset($p);

    respond_json([
        "status" => "ok",
        "scope" => $scope,
        "ownerId" => $ownerId !== "" ? $ownerId : null,
        "projects" => $projects,
    ]);
}

respond_json(["status" => "error", "message" => "Método não suportado"], 405);

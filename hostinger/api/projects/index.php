<?php
/**
 * API de projetos PIMO — persistência em JSON (Hostinger / PHP 8+).
 * Ficheiros por nome: data/{name}.json (id interno pimo-xxxx dentro do JSON).
 * Compatível com legacy: data/project-{id}.json
 */
declare(strict_types=1);

error_log(sprintf(
    "[PIMO-API] projects/index.php reached — method=%s uri=%s",
    $_SERVER["REQUEST_METHOD"] ?? "?",
    $_SERVER["REQUEST_URI"] ?? "?"
));

// Phase 1 — authz (JWT + ownership). Paths: monorepo api/authz ou dist/api/_impl/authz.
(function (): void {
    $candidates = [
        __DIR__ . "/../_impl/authz/resourceAccess.php",
        __DIR__ . "/../../../api/authz/resourceAccess.php",
    ];
    foreach ($candidates as $path) {
        if (is_file($path)) {
            require_once $path;
            return;
        }
    }
    http_response_code(503);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["status" => "error", "message" => "Authz library unavailable"], JSON_UNESCAPED_UNICODE);
    exit;
})();

pimo_authz_cors();
header("Content-Type: application/json; charset=utf-8");

if (($_SERVER["REQUEST_METHOD"] ?? "") === "OPTIONS") {
    http_response_code(200);
    exit;
}

/** Utilizador autenticado para todos os handlers desta API. */
$pimoAuthUser = pimo_authz_require_jwt_user();

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

$thumbsDir = __DIR__ . "/thumbs";
if (!is_dir($thumbsDir)) {
    @mkdir($thumbsDir, 0755, true);
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

/** IDs internos seguros (pimo-xxxx) */
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

/** Nome de projecto seguro para nome de ficheiro */
function sanitize_filename(?string $name): ?string
{
    if ($name === null) {
        return null;
    }
    $name = trim($name);
    if ($name === "") {
        return null;
    }
    if (str_contains($name, "..") || preg_match('/[\/\\\\<>:"|?*\x00]/', $name)) {
        return null;
    }
    if (strlen($name) > 160) {
        return null;
    }
    return $name;
}

/**
 * Versão tolerante para thumbnails: substitui caracteres ilegais em vez de falhar.
 * Aceita nomes com espaços/acentos; rejeita apenas vazio após limpeza.
 */
function coerce_safe_filename(?string $name): ?string
{
    if ($name === null) {
        return null;
    }
    $name = trim($name);
    if ($name === "") {
        return null;
    }
    $name = str_replace(["../", "..\\", ".."], "", $name);
    $name = preg_replace('/[\/\\\\<>:"|?*\x00]+/', "_", $name) ?? "";
    $name = trim($name, " ._");
    if ($name === "") {
        return null;
    }
    if (strlen($name) > 160) {
        $name = rtrim(substr($name, 0, 160));
    }
    return $name !== "" ? $name : null;
}

/** Detecta MIME de um ficheiro temporário de upload. */
function detect_upload_mime(string $tmpPath, string $fallback = ""): string
{
    if (function_exists("finfo_open") && is_file($tmpPath)) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo !== false) {
            $detected = finfo_file($finfo, $tmpPath);
            finfo_close($finfo);
            if (is_string($detected) && $detected !== "") {
                return $detected;
            }
        }
    }
    return $fallback;
}

/** Grava bytes de thumbnail no destino (webp/jpg). */
function save_thumbnail_bytes(string $thumbsDir, string $uploadName, string $bytes, string $mime): ?string
{
    if ($bytes === "" || $uploadName === "") {
        return null;
    }
    if (!is_dir($thumbsDir) && !@mkdir($thumbsDir, 0755, true)) {
        return null;
    }
    $ext = str_contains(strtolower($mime), "webp") ? "webp" : "jpg";
    foreach (["webp", "jpg", "jpeg"] as $oldExt) {
        delete_file_if_exists($thumbsDir . "/" . $uploadName . "." . $oldExt);
    }
    $destPath = $thumbsDir . "/" . $uploadName . "." . $ext;
    if (@file_put_contents($destPath, $bytes) === false) {
        return null;
    }
    return thumbnail_file_url($thumbsDir, $uploadName);
}

function is_internal_project_id(string $value): bool
{
    return (bool)preg_match('/^pimo-[a-f0-9]{16}$/', trim($value));
}

function generate_id(): string
{
    return "pimo-" . bin2hex(random_bytes(8));
}

function name_based_path(string $dataDir, string $name): string
{
    return $dataDir . "/" . $name . ".json";
}

function legacy_project_path(string $dataDir, string $id): string
{
    return $dataDir . "/project-" . $id . ".json";
}

function read_project_file(string $path): ?array
{
    if (!is_file($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    $data = json_decode($raw !== false ? $raw : "null", true);
    return is_array($data) ? $data : null;
}

function write_project_file(string $path, array $data): bool
{
    $encoded = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    return $encoded !== false && file_put_contents($path, $encoded) !== false;
}

function delete_file_if_exists(string $path): void
{
    if ($path !== "" && is_file($path)) {
        @unlink($path);
    }
}

function is_legacy_project_file(string $path): bool
{
    return str_starts_with(basename($path), "project-");
}

/** Localiza ficheiro por nome, id interno ou scan do conteúdo JSON */
function find_project_file(string $dataDir, string $lookup): ?string
{
    $lookup = trim($lookup);
    if ($lookup === "") {
        return null;
    }

    $safeName = sanitize_filename($lookup);
    if ($safeName !== null) {
        $path = name_based_path($dataDir, $safeName);
        if (is_file($path)) {
            return $path;
        }
    }

    $legacyId = sanitize_id($lookup);
    if ($legacyId !== null) {
        $legacyPath = legacy_project_path($dataDir, $legacyId);
        if (is_file($legacyPath)) {
            return $legacyPath;
        }
    }

    foreach (glob($dataDir . "/*.json") ?: [] as $file) {
        $data = read_project_file($file);
        if ($data === null) {
            continue;
        }
        $jsonId = isset($data["id"]) ? trim((string)$data["id"]) : "";
        $jsonName = isset($data["name"]) ? trim((string)$data["name"]) : "";
        if ($jsonId === $lookup || $jsonName === $lookup) {
            return $file;
        }
        if ($safeName !== null && $jsonName === $safeName) {
            return $file;
        }
    }

    return null;
}

/** Lista projectos deduplicados por id interno (preferir ficheiro por nome) */
function list_project_entries(string $dataDir): array
{
    $byId = [];
    foreach (glob($dataDir . "/*.json") ?: [] as $file) {
        $data = read_project_file($file);
        if ($data === null) {
            continue;
        }
        $pid = isset($data["id"]) ? trim((string)$data["id"]) : "";
        if ($pid === "") {
            continue;
        }
        $legacy = is_legacy_project_file($file);
        if (!isset($byId[$pid])) {
            $byId[$pid] = ["file" => $file, "data" => $data, "legacy" => $legacy];
            continue;
        }
        if ($byId[$pid]["legacy"] && !$legacy) {
            $byId[$pid] = ["file" => $file, "data" => $data, "legacy" => $legacy];
        }
    }
    return array_values($byId);
}

function remove_stale_project_files(string $dataDir, string $internalId, string $keepPath): void
{
    foreach (glob($dataDir . "/*.json") ?: [] as $file) {
        if ($file === $keepPath) {
            continue;
        }
        $data = read_project_file($file);
        if ($data === null) {
            continue;
        }
        $jsonId = isset($data["id"]) ? trim((string)$data["id"]) : "";
        if ($jsonId === $internalId) {
            delete_file_if_exists($file);
        }
    }
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

/** URL pública da thumbnail em disco (/api/projects/thumbs/{nome}.webp|.jpg). */
function thumbnail_file_url(string $thumbsDir, string $projectName): ?string
{
    $safe = sanitize_filename($projectName);
    if ($safe === null) {
        return null;
    }
    foreach (["webp", "jpg", "jpeg"] as $ext) {
        if (is_file($thumbsDir . "/" . $safe . "." . $ext)) {
            return "/api/projects/thumbs/" . rawurlencode($safe) . "." . $ext;
        }
    }
    return null;
}

function resolve_project_thumbnail(array $data, string $thumbsDir): ?string
{
    $name = isset($data["name"]) ? trim((string)$data["name"]) : "";
    if ($name !== "") {
        $fileUrl = thumbnail_file_url($thumbsDir, $name);
        if ($fileUrl !== null) {
            return $fileUrl;
        }
    }
    return thumbnail_from_project($data);
}

function apply_project_name(array $data, string $name): array
{
    $data["name"] = $name;
    if (isset($data["centerDisplay"]) && is_array($data["centerDisplay"])) {
        $data["centerDisplay"]["projectName"] = $name;
    }
    return $data;
}

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";
$action = isset($_GET["action"]) ? (string)$_GET["action"] : "";

// --- GET ?action=load&id={project.name|pimo-id} ---
if ($method === "GET" && $action === "load") {
    $lookup = trim((string)($_GET["id"] ?? ""));
    if ($lookup === "") {
        respond_json(["status" => "error", "message" => "id inválido"], 400);
    }
    $path = find_project_file($dataDir, $lookup);
    if ($path === null) {
        // 404 genérico — não revelar existência vs. falta de permissão (anti-enumeration)
        respond_json(["status" => "error", "message" => "Não encontrado"], 404);
    }
    $data = read_project_file($path);
    if ($data === null) {
        respond_json(["status" => "error", "message" => "Ficheiro inválido"], 500);
    }
    if (!pimo_authz_can_view_project($pimoAuthUser, $data)) {
        respond_json(["status" => "error", "message" => "Não encontrado"], 404);
    }
    respond_json(["status" => "ok", "project" => $data]);
}

// --- PUT ?action=update&id={pimo-id interno} (rename) ---
if ($method === "PUT" && $action === "update") {
    $id = sanitize_id($_GET["id"] ?? null);
    if ($id === null) {
        respond_json(["status" => "error", "message" => "id inválido"], 400);
    }
    $path = find_project_file($dataDir, $id);
    if ($path === null) {
        respond_json(["status" => "error", "message" => "Não encontrado"], 404);
    }
    $data = read_project_file($path);
    if ($data === null) {
        respond_json(["status" => "error", "message" => "Ficheiro inválido"], 500);
    }
    if (!pimo_authz_can_mutate_project($pimoAuthUser, $data)) {
        respond_json(["status" => "error", "message" => "Não encontrado"], 404);
    }
    $input = json_decode(file_get_contents("php://input") ?: "{}", true);
    if (!is_array($input)) {
        respond_json(["status" => "error", "message" => "JSON inválido"], 400);
    }
    $name = sanitize_filename(isset($input["name"]) ? (string)$input["name"] : null);
    if ($name === null) {
        respond_json(["status" => "error", "message" => "name obrigatório"], 400);
    }
    $data = apply_project_name($data, $name);
    $data["updatedAt"] = gmdate("c");
    $newPath = name_based_path($dataDir, $name);
    if (!write_project_file($newPath, $data)) {
        respond_json(["status" => "error", "message" => "Falha ao gravar"], 500);
    }
    if ($path !== $newPath) {
        delete_file_if_exists($path);
    }
    remove_stale_project_files($dataDir, $id, $newPath);
    if (function_exists("pimo_github_sync_project")) {
        pimo_github_sync_project($data, "rename");
    }
    respond_json(["status" => "ok", "project" => $data]);
}

// --- DELETE ?action=delete&id={pimo-id|nome} ---
if ($method === "DELETE" && $action === "delete") {
    $lookup = trim((string)($_GET["id"] ?? ""));
    if ($lookup === "") {
        respond_json(["status" => "error", "message" => "id inválido"], 400);
    }
    $path = find_project_file($dataDir, $lookup);
    if ($path === null) {
        respond_json(["status" => "error", "message" => "Não encontrado"], 404);
    }
    $data = read_project_file($path);
    if (!is_array($data) || !pimo_authz_can_mutate_project($pimoAuthUser, $data)) {
        respond_json(["status" => "error", "message" => "Não encontrado"], 404);
    }
    $deletedProject = $data;
    $internalId = isset($data["id"]) ? trim((string)$data["id"]) : "";
    delete_file_if_exists($path);
    if ($internalId !== "") {
        remove_stale_project_files($dataDir, $internalId, "");
    }
    if (function_exists("pimo_github_sync_project")) {
        pimo_github_sync_project($deletedProject, "delete");
    }
    respond_json(["status" => "ok"]);
}

// --- POST: criar ou atualizar projeto (corpo = PimoProjectData JSON) ---
if ($method === "POST" && $action === "") {
    $input = json_decode(file_get_contents("php://input") ?: "null", true);
    if (!is_array($input)) {
        respond_json(["status" => "error", "message" => "JSON inválido"], 400);
    }

    $name = sanitize_filename(isset($input["name"]) ? (string)$input["name"] : null);
    if ($name === null) {
        respond_json(["status" => "error", "message" => "name obrigatório"], 400);
    }

    $now = gmdate("c");
    $incomingId = isset($input["id"]) ? trim((string)$input["id"]) : "";
    $sid = sanitize_id($incomingId);

    $existingPath = null;
    $internalId = null;
    $existingData = null;

    if ($sid !== null && is_internal_project_id($sid)) {
        $existingPath = find_project_file($dataDir, $sid);
        $internalId = $sid;
    } elseif ($sid !== null) {
        $existingPath = find_project_file($dataDir, $sid);
        if ($existingPath !== null) {
            $old = read_project_file($existingPath);
            $existingData = is_array($old) ? $old : null;
            $internalId = is_array($old) && isset($old["id"]) ? trim((string)$old["id"]) : $sid;
        }
    }

    if ($internalId === null) {
        $existingPath = find_project_file($dataDir, $name);
        if ($existingPath !== null) {
            $old = read_project_file($existingPath);
            $existingData = is_array($old) ? $old : null;
            if (is_array($old) && isset($old["id"])) {
                $candidate = trim((string)$old["id"]);
                $internalId = $candidate !== "" ? $candidate : generate_id();
            } else {
                $internalId = generate_id();
            }
        } else {
            $internalId = generate_id();
        }
    }

    if ($existingPath === null) {
        $existingPath = find_project_file($dataDir, $internalId);
    }

    if ($existingPath !== null && is_file($existingPath)) {
        $old = read_project_file($existingPath);
        $existingData = is_array($old) ? $old : null;
        $createdAt = is_array($old) && isset($old["createdAt"]) && is_string($old["createdAt"])
            ? $old["createdAt"]
            : $now;
        // Merge defensivo: preservar settings.projectReport / productionRelease se o POST não os trouxer.
        if (is_array($old)) {
            $oldSettings = isset($old["settings"]) && is_array($old["settings"]) ? $old["settings"] : [];
            $inSettings = isset($input["settings"]) && is_array($input["settings"]) ? $input["settings"] : [];
            $settingsMerged = false;
            if (!array_key_exists("projectReport", $inSettings) && isset($oldSettings["projectReport"])) {
                $inSettings["projectReport"] = $oldSettings["projectReport"];
                $settingsMerged = true;
            }
            if (!array_key_exists("productionRelease", $inSettings) && isset($oldSettings["productionRelease"])) {
                $inSettings["productionRelease"] = $oldSettings["productionRelease"];
                $settingsMerged = true;
            }
            if ($settingsMerged) {
                $input["settings"] = $inSettings;
            }
        }
    } else {
        $createdAt = isset($input["createdAt"]) && is_string($input["createdAt"])
            ? $input["createdAt"]
            : $now;
        $existingData = null;
    }

    if (!pimo_authz_can_mutate_project($pimoAuthUser, $existingData)) {
        respond_json(["status" => "error", "message" => "Não encontrado"], 404);
    }

    $input = apply_project_name($input, $name);
    $input["id"] = $internalId;
    $input["createdAt"] = $createdAt;
    $input["updatedAt"] = $now;
    $input = pimo_authz_bind_project_owner($pimoAuthUser, $input, $existingData);

    $targetPath = name_based_path($dataDir, $name);
    if (!write_project_file($targetPath, $input)) {
        respond_json(["status" => "error", "message" => "Falha ao gravar (permissões?)"], 500);
    }

    remove_stale_project_files($dataDir, $internalId, $targetPath);

    if (function_exists("pimo_github_sync_project")) {
        pimo_github_sync_project($input, "save");
    }

    respond_json(["status" => "ok", "project" => $input]);
}

/**
 * Constrói metadados de listagem a partir de entradas em disco.
 *
 * @param array<int, array{file: string, data: array, legacy: bool}> $entries
 * @param bool $namedOnly Apenas ficheiros {nome}.json (páginas PROJETOS)
 */
function build_projects_list(
    array $entries,
    string $scope,
    array $authUser,
    string $thumbsDir,
    bool $namedOnly = false
): array {
    $now = gmdate("c");
    $projects = [];

    foreach ($entries as $entry) {
        if ($namedOnly && !empty($entry["legacy"])) {
            continue;
        }
        $data = $entry["data"];
        $pid = isset($data["id"]) ? trim((string)$data["id"]) : "";
        if ($pid === "") {
            continue;
        }
        if ($scope === "mine") {
            if (!pimo_authz_list_includes_project($authUser, $data)) {
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
            "thumbnailDataUrl" => resolve_project_thumbnail($data, $thumbsDir),
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

    return $projects;
}

// --- GET|HEAD ?action=thumb&name={projectName} — verificar thumbnail em disco ---
if (($method === "GET" || $method === "HEAD") && $action === "thumb") {
    $lookupName = coerce_safe_filename((string)($_GET["name"] ?? ""));
    if ($lookupName === null) {
        respond_json(["status" => "error", "message" => "name inválido ou em falta"], 400);
    }
    $thumbProjectPath = find_project_file($dataDir, $lookupName);
    $thumbProject = $thumbProjectPath !== null ? read_project_file($thumbProjectPath) : null;
    if (!is_array($thumbProject) || !pimo_authz_can_view_project($pimoAuthUser, $thumbProject)) {
        if ($method === "HEAD") {
            http_response_code(404);
            exit;
        }
        respond_json(["status" => "error", "message" => "Não encontrado"], 404);
    }
    $url = thumbnail_file_url($thumbsDir, $lookupName);
    if ($method === "HEAD") {
        http_response_code($url !== null ? 200 : 404);
        header("Content-Type: application/json; charset=utf-8");
        exit;
    }
    respond_json([
        "status" => "ok",
        "exists" => $url !== null,
        "url" => $url,
    ]);
}

// --- POST ?action=thumb — gravar thumbnail (multipart name+file OU JSON {name,dataUrl}) ---
if ($method === "POST" && $action === "thumb") {
    $jsonBody = null;
    if (!isset($_FILES["file"])) {
        $rawBody = file_get_contents("php://input");
        if (is_string($rawBody) && $rawBody !== "") {
            $decoded = json_decode($rawBody, true);
            if (is_array($decoded)) {
                $jsonBody = $decoded;
            }
        }
    }

    $uploadName = coerce_safe_filename(
        (string)(
            $_GET["name"]
            ?? $_POST["name"]
            ?? ($jsonBody["name"] ?? "")
        )
    );
    if ($uploadName === null) {
        respond_json(["status" => "error", "message" => "name inválido ou em falta"], 400);
    }
    $thumbMutatePath = find_project_file($dataDir, $uploadName);
    $thumbMutateProject = $thumbMutatePath !== null ? read_project_file($thumbMutatePath) : null;
    if (!is_array($thumbMutateProject) || !pimo_authz_can_mutate_project($pimoAuthUser, $thumbMutateProject)) {
        respond_json(["status" => "error", "message" => "Não encontrado"], 404);
    }

    // Caminho A: multipart/form-data com campo "file"
    if (isset($_FILES["file"]) && is_array($_FILES["file"])) {
        $fileErr = (int)($_FILES["file"]["error"] ?? UPLOAD_ERR_NO_FILE);
        $tmpPath = (string)($_FILES["file"]["tmp_name"] ?? "");
        if ($fileErr === UPLOAD_ERR_NO_FILE || $fileErr === UPLOAD_ERR_PARTIAL) {
            respond_json([
                "status" => "error",
                "message" => "thumbnail missing",
                "hint" => "Campo 'file' em falta ou upload incompleto.",
                "uploadError" => $fileErr,
            ], 400);
        }
        if ($fileErr !== UPLOAD_ERR_OK) {
            respond_json([
                "status" => "error",
                "message" => "falha no upload do ficheiro",
                "uploadError" => $fileErr,
            ], 400);
        }
        if ($tmpPath === "" || !is_file($tmpPath) || (int)filesize($tmpPath) <= 0) {
            respond_json([
                "status" => "error",
                "message" => "thumbnail missing",
                "hint" => "Ficheiro de thumbnail vazio ou em falta.",
            ], 400);
        }

        $mime = detect_upload_mime($tmpPath, (string)($_FILES["file"]["type"] ?? "image/jpeg"));
        $ext = str_contains(strtolower($mime), "webp") ? "webp" : "jpg";
        foreach (["webp", "jpg", "jpeg"] as $oldExt) {
            delete_file_if_exists($thumbsDir . "/" . $uploadName . "." . $oldExt);
        }
        if (!is_dir($thumbsDir) && !@mkdir($thumbsDir, 0755, true)) {
            respond_json(["status" => "error", "message" => "diretório thumbs indisponível"], 500);
        }
        $destPath = $thumbsDir . "/" . $uploadName . "." . $ext;
        $moved = false;
        if (is_uploaded_file($tmpPath)) {
            $moved = move_uploaded_file($tmpPath, $destPath);
        }
        if (!$moved) {
            // Proxies/alguns hosts invalidam is_uploaded_file — fallback seguro se o tmp existe.
            $moved = @rename($tmpPath, $destPath);
            if (!$moved) {
                $moved = @copy($tmpPath, $destPath);
                if ($moved) {
                    @unlink($tmpPath);
                }
            }
        }
        if (!$moved) {
            respond_json(["status" => "error", "message" => "Falha ao gravar thumbnail"], 500);
        }
        respond_json([
            "status" => "ok",
            "url" => thumbnail_file_url($thumbsDir, $uploadName),
        ]);
    }

    // Caminho B: JSON com dataUrl (base64) — preferido pelo frontend
    $dataUrl = is_array($jsonBody) ? (string)($jsonBody["dataUrl"] ?? "") : "";
    if ($dataUrl === "" && is_array($jsonBody) && array_key_exists("dataUrl", $jsonBody)) {
        respond_json([
            "status" => "error",
            "message" => "thumbnail missing",
            "hint" => "JSON dataUrl vazio.",
        ], 400);
    }
    if ($dataUrl !== "" && preg_match('#^data:(image/(?:jpeg|jpg|png|webp));base64,#i', $dataUrl, $m)) {
        $mime = strtolower($m[1]);
        if ($mime === "image/jpg") {
            $mime = "image/jpeg";
        }
        $b64 = substr($dataUrl, strlen($m[0]));
        $bytes = base64_decode($b64, true);
        if ($bytes === false || $bytes === "") {
            respond_json([
                "status" => "error",
                "message" => "thumbnail missing",
                "hint" => "dataUrl inválido ou sem bytes.",
            ], 400);
        }
        $url = save_thumbnail_bytes($thumbsDir, $uploadName, $bytes, $mime);
        if ($url === null) {
            respond_json(["status" => "error", "message" => "Falha ao gravar thumbnail"], 500);
        }
        respond_json(["status" => "ok", "url" => $url]);
    }

    respond_json([
        "status" => "error",
        "message" => "thumbnail missing",
        "hint" => "Envie multipart field 'file' ou JSON { name, dataUrl } com imagem válida.",
    ], 400);
}

// --- GET ?action=projetos — apenas ficheiros {nome}.json (hub PROJETOS) ---
if ($method === "GET" && $action === "projetos") {
    $scope = isset($_GET["scope"]) ? (string)$_GET["scope"] : "mine";
    if ($scope === "all") {
        if (!pimo_authz_can_view_all_projects($pimoAuthUser)) {
            respond_json(["status" => "error", "message" => "Sem permissão"], 403);
        }
        $ownerId = "";
    } else {
        $scope = "mine";
        $ownerId = (string) $pimoAuthUser["id"];
    }
    $entries = list_project_entries($dataDir);
    $projects = build_projects_list($entries, $scope, $pimoAuthUser, $thumbsDir, true);

    respond_json([
        "status" => "ok",
        "scope" => $scope,
        "ownerId" => $ownerId !== "" ? $ownerId : null,
        "projects" => $projects,
    ]);
}

// --- GET: listagem ?scope=mine|all (ownerId do JWT; query ownerId ignorado) ---
if ($method === "GET" && $action === "") {
    try {
        $scope = isset($_GET["scope"]) ? (string)$_GET["scope"] : "mine";
        if ($scope === "all") {
            if (!pimo_authz_can_view_all_projects($pimoAuthUser)) {
                respond_json(["status" => "error", "message" => "Sem permissão"], 403);
            }
            $ownerId = "";
        } else {
            $scope = "mine";
            $ownerId = (string) $pimoAuthUser["id"];
        }
        $entries = list_project_entries($dataDir);
        $projects = build_projects_list($entries, $scope, $pimoAuthUser, $thumbsDir, false);

        respond_json([
            "status" => "ok",
            "scope" => $scope,
            "ownerId" => $ownerId !== "" ? $ownerId : null,
            "projects" => $projects,
        ]);
    } catch (Throwable $e) {
        error_log("[PIMO-API] listagem falhou: " . $e->getMessage());
        respond_json([
            "status" => "ok",
            "scope" => "mine",
            "ownerId" => (string) $pimoAuthUser["id"],
            "projects" => [],
            "warning" => "Listagem parcial indisponível",
        ], 200);
    }
}

respond_json(["status" => "error", "message" => "Método não suportado"], 405);

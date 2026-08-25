<?php
/**
 * PIMO — endpoint dedicado de listagem de projetos (versão Hostinger).
 *
 * GET /api/projects/list.php?scope=mine|all
 * Phase 1: JWT obrigatório; scope=mine usa JWT.sub; scope=all requer project.view.all.
 */
declare(strict_types=1);

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

if (($_SERVER["REQUEST_METHOD"] ?? "GET") !== "GET") {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Apenas GET permitido"], JSON_UNESCAPED_UNICODE);
    exit;
}

$authUser = pimo_authz_require_jwt_user();

$dataDir = __DIR__ . "/data";

if (!is_dir($dataDir)) {
    echo json_encode([
        "status"   => "ok",
        "scope"    => "mine",
        "ownerId"  => $authUser["id"],
        "total"    => 0,
        "projects" => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$scope = isset($_GET["scope"]) ? trim((string)$_GET["scope"]) : "mine";
if ($scope === "all") {
    if (!pimo_authz_can_view_all_projects($authUser)) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "Sem permissão"], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $ownerId = "";
} else {
    $scope = "mine";
    $ownerId = (string) $authUser["id"];
}
$now = gmdate("c");

/**
 * Extrai thumbnailDataUrl do projeto (top-level ou dentro de centerDisplay).
 */
function list_thumbnail(array $data): ?string
{
    if (array_key_exists("thumbnailDataUrl", $data)) {
        $t = $data["thumbnailDataUrl"];
        return (is_string($t) || $t === null) ? $t : null;
    }
    $cd = $data["centerDisplay"] ?? null;
    if (is_array($cd) && array_key_exists("thumbnailDataUrl", $cd)) {
        $t = $cd["thumbnailDataUrl"];
        return (is_string($t) || $t === null) ? $t : null;
    }
    return null;
}

$files    = glob($dataDir . "/*.json") ?: [];
$byId     = [];
$projects = [];

foreach ($files as $file) {
    $raw  = file_get_contents($file);
    $data = json_decode($raw !== false ? $raw : "null", true);

    if (!is_array($data)) {
        continue;
    }

    $pid = isset($data["id"]) ? trim((string)$data["id"]) : "";
    if ($pid === "") {
        continue;
    }

    $legacy = str_starts_with(basename($file), "project-");
    if (!isset($byId[$pid])) {
        $byId[$pid] = ["data" => $data, "legacy" => $legacy];
        continue;
    }
    if ($byId[$pid]["legacy"] && !$legacy) {
        $byId[$pid] = ["data" => $data, "legacy" => $legacy];
    }
}

foreach ($byId as $entry) {
    $data = $entry["data"];
    $pid = isset($data["id"]) ? trim((string)$data["id"]) : "";
    if ($pid === "") {
        continue;
    }

    if ($scope === "mine" && $ownerId !== "") {
        if (($data["ownerId"] ?? "") !== $ownerId) {
            continue;
        }
    }

    $projects[] = [
        "id"               => $pid,
        "name"             => isset($data["name"]) ? (string)$data["name"] : "Projeto",
        "sequence"         => 0,
        "createdAt"        => isset($data["createdAt"]) && is_string($data["createdAt"])
            ? $data["createdAt"] : $now,
        "updatedAt"        => isset($data["updatedAt"]) && is_string($data["updatedAt"])
            ? $data["updatedAt"]
            : (isset($data["createdAt"]) ? $data["createdAt"] : $now),
        "ownerId"          => isset($data["ownerId"])   ? (string)$data["ownerId"]   : "usuario-local",
        "ownerName"        => isset($data["ownerName"]) ? (string)$data["ownerName"] : (string)($data["ownerId"] ?? "Utilizador"),
        "thumbnailDataUrl" => list_thumbnail($data),
    ];
}

usort($projects, static function (array $a, array $b): int {
    return strcmp($b["updatedAt"] ?? "", $a["updatedAt"] ?? "");
});

foreach ($projects as $i => &$p) {
    $p["sequence"] = $i + 1;
}
unset($p);

echo json_encode([
    "status"   => "ok",
    "scope"    => $scope,
    "ownerId"  => $ownerId !== "" ? $ownerId : null,
    "total"    => count($projects),
    "projects" => $projects,
], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

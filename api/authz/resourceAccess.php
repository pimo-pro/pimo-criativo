<?php
declare(strict_types=1);

/**
 * Phase 1 — autenticação + autorização de recurso (ownership / permissions).
 * Incluído por Projects API, industrial orders, etc. Sem router próprio.
 */

if (defined('PIMO_AUTHZ_LIB_LOADED')) {
    return;
}
define('PIMO_AUTHZ_LIB_LOADED', true);

/** Resolve e carrega api/auth (repo ou dist/_impl). */
function pimo_authz_bootstrap_auth(): void
{
    if (defined('PIMO_AUTH_LIB_LOADED')) {
        return;
    }
    $candidates = [
        __DIR__ . '/../auth/index.php',
        __DIR__ . '/../auth/index.php',
    ];
    $seen = [];
    foreach ($candidates as $path) {
        $real = realpath($path);
        $key = $real !== false ? $real : $path;
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        if (is_file($path)) {
            require_once $path;
            return;
        }
    }
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'error',
        'message' => 'Auth library unavailable',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function pimo_authz_bootstrap_project_shares(): void
{
    if (defined('PIMO_PROJECT_SHARES_STORE_LOADED')) {
        return;
    }
    $path = __DIR__ . '/projectSharesStore.php';
    if (is_file($path)) {
        require_once $path;
    }
}

pimo_authz_bootstrap_auth();
pimo_authz_bootstrap_project_shares();

/**
 * JWT válido → utilizador da base. Termina com 401/503 se falhar.
 *
 * @return array{id: string, username: string, email: string, role: string, effectiveRole: string, accountStatus: string, permissions: list<string>}
 */
function pimo_authz_require_jwt_user(): array
{
    $token = pimo_bearer_token();
    if ($token === null || $token === '') {
        pimo_json_response(['status' => 'error', 'message' => 'Não autenticado'], 401);
        exit;
    }
    if (pimo_is_local_dev_bearer($token)) {
        pimo_json_response([
            'status' => 'error',
            'message' => 'Token local de desenvolvimento não válido para APIs',
        ], 401);
        exit;
    }
    $secret = pimo_jwt_secret();
    if ($secret === null) {
        pimo_json_response([
            'status' => 'error',
            'message' => 'Auth misconfigured (PIMO_JWT_SECRET obrigatório neste ambiente)',
        ], 503);
        exit;
    }
    $payload = pimo_jwt_decode($token, $secret);
    if ($payload === null || empty($payload['sub'])) {
        pimo_json_response(['status' => 'error', 'message' => 'Token inválido'], 401);
        exit;
    }
    $users = pimo_load_users();
    $user = pimo_find_user_by_id($users, (string) $payload['sub']);
    if ($user === null) {
        pimo_json_response(['status' => 'error', 'message' => 'Não autenticado'], 401);
        exit;
    }
    $effectiveRole = pimo_user_effective_role($user);
    $perms = pimo_effective_permissions_for_user($user);
    if ($effectiveRole === 'admin') {
        $perms = array_values(array_unique([...$perms, 'admin.full_access', 'project.view.all']));
    }
    return [
        'id' => (string) $user['id'],
        'username' => (string) ($user['username'] ?? $user['email'] ?? $user['id']),
        'email' => (string) ($user['email'] ?? ''),
        'role' => (string) ($user['role'] ?? 'visitor'),
        'effectiveRole' => $effectiveRole,
        'accountStatus' => pimo_user_account_status($user),
        'permissions' => $perms,
    ];
}

/** @param array{permissions?: list<string>, effectiveRole?: string} $user */
function pimo_authz_has(array $user, string $permission): bool
{
    $perms = $user['permissions'] ?? [];
    return is_array($perms) && in_array($permission, $perms, true);
}

function pimo_authz_is_platform_admin(array $user): bool
{
    return pimo_authz_has($user, 'admin.full_access') || ($user['effectiveRole'] ?? '') === 'admin';
}

function pimo_authz_can_view_all_projects(array $user): bool
{
    return pimo_authz_has($user, 'project.view.all') || pimo_authz_is_platform_admin($user);
}

function pimo_authz_user_has_project_share(string $userId, string $projectId): bool
{
    if (!function_exists('pimo_find_project_share')) {
        return false;
    }
    return pimo_find_project_share($projectId, $userId) !== null;
}

/** Ultra+ aprovado: projectos do admin único da plataforma. */
function pimo_authz_ultra_plus_admin_project_access(array $user, string $projectOwnerId): bool
{
    if (($user['effectiveRole'] ?? '') !== 'ultra+') {
        return false;
    }
    if (($user['accountStatus'] ?? 'approved') === 'pending') {
        return false;
    }
    $adminId = pimo_find_platform_admin_id();
    return $adminId !== null && $adminId !== '' && $projectOwnerId === $adminId;
}

/**
 * Listagem scope=mine expandida: próprios + partilhados + ultra+ (projectos do admin).
 *
 * @param array<string,mixed> $project
 */
function pimo_authz_list_includes_project(array $user, array $project): bool
{
    if (pimo_authz_can_view_all_projects($user)) {
        return true;
    }
    $ownerId = isset($project['ownerId']) ? (string) $project['ownerId'] : '';
    $projectId = isset($project['id']) ? trim((string) $project['id']) : '';
    if ($ownerId !== '' && $ownerId === (string) ($user['id'] ?? '')) {
        return true;
    }
    if ($projectId !== '' && pimo_authz_user_has_project_share((string) ($user['id'] ?? ''), $projectId)) {
        return true;
    }
    if ($ownerId !== '' && pimo_authz_ultra_plus_admin_project_access($user, $ownerId)) {
        return true;
    }
    return false;
}

/**
 * Ver projecto: owner OU view.all OU admin OU partilha OU ultra+ (admin).
 *
 * @param array<string,mixed> $project
 */
function pimo_authz_can_view_project(array $user, array $project): bool
{
    return pimo_authz_list_includes_project($user, $project);
}

/**
 * Mutar (create/update/delete/rename/thumb write):
 * - create: project.edit.self OU admin
 * - update existing: (edit.self E acesso) OU admin
 *
 * @param array<string,mixed>|null $existingProject null = create
 */
function pimo_authz_can_mutate_project(array $user, ?array $existingProject): bool
{
    if (pimo_authz_is_platform_admin($user)) {
        return true;
    }
    if (!pimo_authz_has($user, 'project.edit.self')) {
        return false;
    }
    if ($existingProject === null) {
        return ($user['accountStatus'] ?? 'approved') === 'approved';
    }
    return pimo_authz_can_view_project($user, $existingProject);
}

/**
 * Força ownership a partir do JWT (ignora spoof do body).
 *
 * @param array<string,mixed> $project
 * @return array<string,mixed>
 */
function pimo_authz_bind_project_owner(array $user, array $project, ?array $existingProject): array
{
    if (
        $existingProject !== null
        && pimo_authz_is_platform_admin($user)
        && isset($existingProject['ownerId'])
        && (string) $existingProject['ownerId'] !== ''
    ) {
        $project['ownerId'] = (string) $existingProject['ownerId'];
        if (isset($existingProject['ownerName']) && (string) $existingProject['ownerName'] !== '') {
            $project['ownerName'] = (string) $existingProject['ownerName'];
        }
        return $project;
    }
    $project['ownerId'] = (string) $user['id'];
    $project['ownerName'] = (string) ($user['username'] !== '' ? $user['username'] : $user['id']);
    return $project;
}

function pimo_authz_can_send_to_production(array $user): bool
{
    return pimo_authz_has($user, 'project.send_to_production.self')
        || pimo_authz_is_platform_admin($user);
}

/**
 * CORS seguro (não *). Em local/dev também permite localhost Vite.
 */
function pimo_authz_cors(): void
{
    $allowed = ['https://pimo.pro', 'https://www.pimo.pro'];
    if (function_exists('pimo_is_local_dev_environment') && pimo_is_local_dev_environment()) {
        $allowed[] = 'http://localhost:5173';
        $allowed[] = 'http://127.0.0.1:5173';
        $allowed[] = 'http://localhost:4173';
        $allowed[] = 'http://127.0.0.1:4173';
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Max-Age: 86400');
}

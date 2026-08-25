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
        // dist/api/_impl/authz → dist/api/_impl/auth
        __DIR__ . '/../auth/index.php',
        // repo: api/authz → api/auth
        __DIR__ . '/../auth/index.php',
    ];
    // Deduplicate while keeping order
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

pimo_authz_bootstrap_auth();

/**
 * JWT válido → utilizador da base. Termina com 401/503 se falhar.
 *
 * @return array{id: string, username: string, email: string, role: string, permissions: list<string>}
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
    $role = (string) ($user['role'] ?? 'visitor');
    $perms = pimo_effective_permissions($role);
    if ($role === 'admin') {
        $perms = array_values(array_unique([...$perms, 'admin.full_access', 'project.view.all']));
    }
    return [
        'id' => (string) $user['id'],
        'username' => (string) ($user['username'] ?? $user['email'] ?? $user['id']),
        'email' => (string) ($user['email'] ?? ''),
        'role' => $role,
        'permissions' => $perms,
    ];
}

/** @param array{permissions?: list<string>} $user */
function pimo_authz_has(array $user, string $permission): bool
{
    $perms = $user['permissions'] ?? [];
    return is_array($perms) && in_array($permission, $perms, true);
}

function pimo_authz_is_platform_admin(array $user): bool
{
    return pimo_authz_has($user, 'admin.full_access') || ($user['role'] ?? '') === 'admin';
}

function pimo_authz_can_view_all_projects(array $user): bool
{
    return pimo_authz_has($user, 'project.view.all') || pimo_authz_is_platform_admin($user);
}

/**
 * Ver projecto: owner OU view.all OU admin.
 *
 * @param array<string,mixed> $project
 */
function pimo_authz_can_view_project(array $user, array $project): bool
{
    if (pimo_authz_can_view_all_projects($user)) {
        return true;
    }
    $ownerId = isset($project['ownerId']) ? (string) $project['ownerId'] : '';
    return $ownerId !== '' && $ownerId === (string) ($user['id'] ?? '');
}

/**
 * Mutar (create/update/delete/rename/thumb write):
 * - create: project.edit.self OU admin
 * - update existing: (edit.self E owner) OU admin
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
        return true;
    }
    $ownerId = isset($existingProject['ownerId']) ? (string) $existingProject['ownerId'] : '';
    return $ownerId !== '' && $ownerId === (string) ($user['id'] ?? '');
}

/**
 * Força ownership a partir do JWT (ignora spoof do body).
 * Em update, admin pode preservar owner existente; não-admin sobrescreve com o próprio id.
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

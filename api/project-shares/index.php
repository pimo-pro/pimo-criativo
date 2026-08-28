<?php
declare(strict_types=1);

/**
 * CRUD partilhas de projecto (só admin).
 * Entrada: public_html/api/project-shares/index.php
 */

require_once __DIR__ . '/../auth/index.php';
require_once __DIR__ . '/../authz/projectSharesStore.php';

function pimo_project_shares_public(array $share): array
{
    return [
        'id' => (string) ($share['id'] ?? ''),
        'projectId' => (string) ($share['projectId'] ?? ''),
        'userId' => (string) ($share['userId'] ?? ''),
        'grantedBy' => (string) ($share['grantedBy'] ?? ''),
        'access' => (string) ($share['access'] ?? 'edit'),
        'createdAt' => (string) ($share['createdAt'] ?? ''),
    ];
}

function pimo_project_shares_require_admin(): ?array
{
    $token = pimo_bearer_token();
    if ($token === null || $token === '') {
        return null;
    }
    $payload = pimo_jwt_decode($token, pimo_jwt_secret());
    if ($payload === null || empty($payload['sub'])) {
        return null;
    }
    $users = pimo_load_users();
    $user = pimo_find_user_by_id($users, (string) $payload['sub']);
    if ($user === null) {
        return null;
    }
    $perms = pimo_effective_permissions_for_user($user);
    if (pimo_user_effective_role($user) === 'admin') {
        $perms = array_values(array_unique([...$perms, 'admin.full_access']));
    }
    if (!in_array('admin.full_access', $perms, true)) {
        return null;
    }
    return $user;
}

function pimo_project_shares_user_is_approved(string $userId): bool
{
    $user = pimo_find_user_by_id(pimo_load_users(), $userId);
    if ($user === null) {
        return false;
    }
    return pimo_user_account_status($user) === 'approved';
}

function pimo_project_shares_router(): void
{
    pimo_cors();
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        return;
    }

    $admin = pimo_project_shares_require_admin();
    if ($admin === null) {
        pimo_json_response(['status' => 'error', 'message' => 'Proibido (requer admin.full_access)'], 403);
        return;
    }

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $id = isset($_GET['id']) ? trim((string) $_GET['id']) : '';

    try {
        if ($method === 'GET') {
            $shares = pimo_load_project_shares();
            $userFilter = isset($_GET['userId']) ? trim((string) $_GET['userId']) : '';
            $projectFilter = isset($_GET['projectId']) ? trim((string) $_GET['projectId']) : '';
            if ($userFilter !== '') {
                $shares = array_values(array_filter(
                    $shares,
                    static fn(array $s): bool => (string) ($s['userId'] ?? '') === $userFilter
                ));
            }
            if ($projectFilter !== '') {
                $shares = array_values(array_filter(
                    $shares,
                    static fn(array $s): bool => (string) ($s['projectId'] ?? '') === $projectFilter
                ));
            }
            pimo_json_response([
                'status' => 'ok',
                'shares' => array_map('pimo_project_shares_public', $shares),
            ]);
            return;
        }

        if ($method === 'POST') {
            $raw = file_get_contents('php://input') ?: '';
            $body = json_decode($raw, true);
            if (!is_array($body)) {
                pimo_json_response(['status' => 'error', 'message' => 'JSON inválido'], 400);
                return;
            }
            $projectId = trim((string) ($body['projectId'] ?? ''));
            $userId = trim((string) ($body['userId'] ?? ''));
            if ($projectId === '' || $userId === '') {
                pimo_json_response(['status' => 'error', 'message' => 'projectId e userId obrigatórios'], 400);
                return;
            }
            if (!pimo_project_shares_user_is_approved($userId)) {
                pimo_json_response([
                    'status' => 'error',
                    'message' => 'Partilha só permitida para contas aprovadas (accountStatus=approved)',
                ], 400);
                return;
            }
            $target = pimo_find_user_by_id(pimo_load_users(), $userId);
            if ($target === null) {
                pimo_json_response(['status' => 'error', 'message' => 'Utilizador não encontrado'], 404);
                return;
            }
            $share = pimo_add_project_share($projectId, $userId, (string) ($admin['id'] ?? ''));
            pimo_json_response(['status' => 'ok', 'share' => pimo_project_shares_public($share)], 201);
            return;
        }

        if ($method === 'DELETE') {
            if ($id === '') {
                pimo_json_response(['status' => 'error', 'message' => 'id obrigatório'], 400);
                return;
            }
            if (!pimo_remove_project_share($id)) {
                pimo_json_response(['status' => 'error', 'message' => 'Não encontrado'], 404);
                return;
            }
            pimo_json_response(['status' => 'ok']);
            return;
        }

        pimo_json_response(['status' => 'error', 'message' => 'Método não suportado'], 405);
    } catch (Throwable $e) {
        pimo_json_response(['status' => 'error', 'message' => 'Erro interno'], 500);
    }
}

if (defined('PIMO_PROJECT_SHARES_ROUTER') && PIMO_PROJECT_SHARES_ROUTER) {
    pimo_project_shares_router();
}

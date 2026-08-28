<?php
declare(strict_types=1);

/**
 * CRUD mínimo de utilizadores (só admin).
 * Entrada: public_html/api/users/index.php com define('PIMO_USERS_ROUTER', true).
 */

require_once __DIR__ . '/../auth/index.php';

const PIMO_APPROVABLE_ROLES = ['pro', 'ultra', 'ultra+'];

function pimo_users_public(array $u): array
{
    return pimo_user_public($u);
}

/** JWT válido + permissão efectiva `admin.full_access` (alinhado com RBAC no cliente). */
function pimo_users_require_full_access(): ?array
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

function pimo_users_apply_account_resolution(array &$target, array $body, array $admin): ?string
{
    if (!isset($body['accountStatus'])) {
        return null;
    }
    $status = strtolower(trim((string) $body['accountStatus']));
    if ($status !== 'approved') {
        return 'accountStatus inválido (use approved)';
    }

    if (isset($body['role'])) {
        $role = strtolower(trim((string) $body['role']));
        if ($role === 'visitor') {
            $target['role'] = 'visitor';
            $target['accountStatus'] = 'approved';
            $target['approvedAt'] = gmdate('c');
            $target['approvedBy'] = (string) ($admin['id'] ?? '');
            return null;
        }
        if (!in_array($role, PIMO_APPROVABLE_ROLES, true)) {
            return 'role inválida para aprovação (pro, ultra, ultra+)';
        }
        $target['role'] = $role;
        $target['accountStatus'] = 'approved';
        $target['approvedAt'] = gmdate('c');
        $target['approvedBy'] = (string) ($admin['id'] ?? '');
        return null;
    }

    return 'role obrigatória ao aprovar conta';
}

function pimo_users_router(): void
{
    pimo_cors();
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        return;
    }

    $admin = pimo_users_require_full_access();
    if ($admin === null) {
        pimo_json_response(['status' => 'error', 'message' => 'Proibido (requer admin.full_access)'], 403);
        return;
    }

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $id = isset($_GET['id']) ? trim((string) $_GET['id']) : '';

    try {
        $users = pimo_load_users();

        if ($method === 'GET') {
            $out = array_map('pimo_users_public', $users);
            pimo_json_response(['status' => 'ok', 'users' => $out]);
            return;
        }

        if ($method === 'POST') {
            $raw = file_get_contents('php://input') ?: '';
            $body = json_decode($raw, true);
            if (!is_array($body)) {
                pimo_json_response(['status' => 'error', 'message' => 'JSON inválido'], 400);
                return;
            }
            $email = strtolower(trim((string) ($body['email'] ?? '')));
            $password = (string) ($body['password'] ?? '');
            $username = trim((string) ($body['username'] ?? ''));
            $role = trim((string) ($body['role'] ?? 'visitor'));
            if ($email === '' || $password === '') {
                pimo_json_response(['status' => 'error', 'message' => 'email e password obrigatórios'], 400);
                return;
            }
            if (pimo_find_user_by_email($users, $email) !== null) {
                pimo_json_response(['status' => 'error', 'message' => 'Email já existe'], 409);
                return;
            }
            if ($username === '') {
                $username = strstr($email, '@', true) ?: $email;
            }
            $newUser = [
                'id' => bin2hex(random_bytes(16)),
                'email' => $email,
                'username' => $username,
                'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
                'role' => $role !== '' ? $role : 'visitor',
                'accountStatus' => 'approved',
                'createdAt' => gmdate('c'),
                'approvedAt' => gmdate('c'),
                'approvedBy' => (string) ($admin['id'] ?? ''),
            ];
            $users[] = $newUser;
            pimo_save_users($users);
            pimo_json_response(['status' => 'ok', 'user' => pimo_users_public($newUser)], 201);
            return;
        }

        if ($method === 'PUT') {
            if ($id === '') {
                pimo_json_response(['status' => 'error', 'message' => 'id obrigatório'], 400);
                return;
            }
            $raw = file_get_contents('php://input') ?: '';
            $body = json_decode($raw, true);
            if (!is_array($body)) {
                pimo_json_response(['status' => 'error', 'message' => 'JSON inválido'], 400);
                return;
            }
            $found = false;
            foreach ($users as $i => $u) {
                if (($u['id'] ?? '') !== $id) {
                    continue;
                }
                $found = true;

                $resolutionError = pimo_users_apply_account_resolution($users[$i], $body, $admin);
                if ($resolutionError !== null) {
                    pimo_json_response(['status' => 'error', 'message' => $resolutionError], 400);
                    return;
                }

                if (isset($body['email']) && !isset($body['accountStatus'])) {
                    $ne = strtolower(trim((string) $body['email']));
                    if ($ne !== '' && $ne !== strtolower((string) $u['email'])) {
                        if (pimo_find_user_by_email($users, $ne) !== null) {
                            pimo_json_response(['status' => 'error', 'message' => 'Email já existe'], 409);
                            return;
                        }
                        $users[$i]['email'] = $ne;
                    }
                }
                if (isset($body['username']) && !isset($body['accountStatus'])) {
                    $users[$i]['username'] = trim((string) $body['username']);
                }
                if (isset($body['role']) && !isset($body['accountStatus'])) {
                    $users[$i]['role'] = trim((string) $body['role']);
                }
                if (!empty($body['password'])) {
                    $users[$i]['passwordHash'] = password_hash((string) $body['password'], PASSWORD_DEFAULT);
                }
                break;
            }
            if (!$found) {
                pimo_json_response(['status' => 'error', 'message' => 'Não encontrado'], 404);
                return;
            }
            pimo_save_users($users);
            $updated = pimo_find_user_by_id($users, $id);
            pimo_json_response(['status' => 'ok', 'user' => pimo_users_public($updated ?? [])]);
            return;
        }

        if ($method === 'DELETE') {
            if ($id === '') {
                pimo_json_response(['status' => 'error', 'message' => 'id obrigatório'], 400);
                return;
            }
            $admins = array_filter($users, static fn($u) => ($u['role'] ?? '') === 'admin');
            $target = pimo_find_user_by_id($users, $id);
            if ($target === null) {
                pimo_json_response(['status' => 'error', 'message' => 'Não encontrado'], 404);
                return;
            }
            if (($target['role'] ?? '') === 'admin' && count($admins) <= 1) {
                pimo_json_response(['status' => 'error', 'message' => 'Não é possível apagar o último admin'], 400);
                return;
            }
            $users = array_values(array_filter($users, static fn($u) => ($u['id'] ?? '') !== $id));
            pimo_save_users($users);
            pimo_json_response(['status' => 'ok']);
            return;
        }

        pimo_json_response(['status' => 'error', 'message' => 'Método não suportado'], 405);
    } catch (Throwable $e) {
        pimo_json_response(['status' => 'error', 'message' => 'Erro interno'], 500);
    }
}

if (defined('PIMO_USERS_ROUTER') && PIMO_USERS_ROUTER) {
    pimo_users_router();
}

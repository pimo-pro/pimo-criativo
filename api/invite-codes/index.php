<?php
declare(strict_types=1);

/**
 * CRUD códigos de convite (só admin).
 * Entrada: public_html/api/invite-codes/index.php
 */

require_once __DIR__ . '/../auth/index.php';
require_once __DIR__ . '/../authz/inviteCodesStore.php';

function pimo_invite_codes_require_admin(): ?array
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

function pimo_invite_codes_router(): void
{
    pimo_cors();
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        return;
    }

    $admin = pimo_invite_codes_require_admin();
    if ($admin === null) {
        pimo_json_response(['status' => 'error', 'message' => 'Proibido (requer admin.full_access)'], 403);
        return;
    }

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $id = isset($_GET['id']) ? trim((string) $_GET['id']) : '';

    try {
        if ($method === 'GET') {
            $codes = pimo_load_invite_codes();
            pimo_json_response([
                'status' => 'ok',
                'inviteCodes' => array_map('pimo_invite_public', $codes),
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
            $code = pimo_invite_normalize_code((string) ($body['code'] ?? ''));
            $role = strtolower(trim((string) ($body['role'] ?? '')));
            $usageMode = strtolower(trim((string) ($body['usageMode'] ?? 'single')));
            if ($code === '') {
                pimo_json_response(['status' => 'error', 'message' => 'code obrigatório'], 400);
                return;
            }
            if (!in_array($role, PIMO_INVITE_ROLES, true)) {
                pimo_json_response(['status' => 'error', 'message' => 'role inválido (pro|ultra|ultra+)'], 400);
                return;
            }
            if ($usageMode !== 'single' && $usageMode !== 'multi') {
                pimo_json_response(['status' => 'error', 'message' => 'usageMode inválido (single|multi)'], 400);
                return;
            }

            $created = pimo_invite_codes_mutate(static function (array $codes) use ($code, $role, $usageMode, $admin): array {
                foreach ($codes as $existing) {
                    if (!is_array($existing)) {
                        continue;
                    }
                    if (pimo_invite_normalize_code((string) ($existing['code'] ?? '')) === $code) {
                        return [
                            'codes' => $codes,
                            'value' => ['error' => 'Código já existe'],
                        ];
                    }
                }
                $invite = [
                    'id' => bin2hex(random_bytes(16)),
                    'code' => $code,
                    'role' => $role,
                    'usageMode' => $usageMode,
                    'usageLimit' => $usageMode === 'single' ? 1 : null,
                    'usedCount' => 0,
                    'active' => true,
                    'createdAt' => gmdate('c'),
                    'createdBy' => (string) ($admin['id'] ?? ''),
                    'disabledAt' => null,
                    'disabledBy' => null,
                    'lastUsedAt' => null,
                ];
                $codes[] = $invite;
                return ['codes' => $codes, 'value' => ['invite' => $invite]];
            });

            if (isset($created['error'])) {
                pimo_json_response(['status' => 'error', 'message' => (string) $created['error']], 409);
                return;
            }
            pimo_json_response([
                'status' => 'ok',
                'inviteCode' => pimo_invite_public($created['invite']),
            ], 201);
            return;
        }

        if ($method === 'PATCH') {
            if ($id === '') {
                pimo_json_response(['status' => 'error', 'message' => 'id obrigatório'], 400);
                return;
            }
            $raw = file_get_contents('php://input') ?: '';
            $body = json_decode($raw, true);
            if (!is_array($body) || !array_key_exists('active', $body)) {
                pimo_json_response(['status' => 'error', 'message' => 'active (bool) obrigatório'], 400);
                return;
            }
            $wantActive = (bool) $body['active'];
            $adminId = (string) ($admin['id'] ?? '');

            $updated = pimo_invite_codes_mutate(static function (array $codes) use ($id, $wantActive, $adminId): array {
                $idx = null;
                foreach ($codes as $i => $c) {
                    if (is_array($c) && (string) ($c['id'] ?? '') === $id) {
                        $idx = $i;
                        break;
                    }
                }
                if ($idx === null) {
                    return ['codes' => $codes, 'value' => ['error' => 'not_found']];
                }
                $invite = $codes[$idx];
                if ($wantActive) {
                    $invite['active'] = true;
                    $invite['disabledAt'] = null;
                    $invite['disabledBy'] = null;
                    // Opção A: reactivar single usado → reset usedCount
                    if ((string) ($invite['usageMode'] ?? '') === 'single') {
                        $invite['usedCount'] = 0;
                    }
                } else {
                    $invite['active'] = false;
                    $invite['disabledAt'] = gmdate('c');
                    $invite['disabledBy'] = $adminId;
                }
                $codes[$idx] = $invite;
                return ['codes' => $codes, 'value' => ['invite' => $invite]];
            });

            if (($updated['error'] ?? null) === 'not_found') {
                pimo_json_response(['status' => 'error', 'message' => 'Não encontrado'], 404);
                return;
            }
            pimo_json_response([
                'status' => 'ok',
                'inviteCode' => pimo_invite_public($updated['invite']),
            ]);
            return;
        }

        if ($method === 'DELETE') {
            if ($id === '') {
                pimo_json_response(['status' => 'error', 'message' => 'id obrigatório'], 400);
                return;
            }
            $ok = pimo_invite_codes_mutate(static function (array $codes) use ($id): array {
                $next = [];
                $found = false;
                foreach ($codes as $c) {
                    if (is_array($c) && (string) ($c['id'] ?? '') === $id) {
                        $found = true;
                        continue;
                    }
                    $next[] = $c;
                }
                return ['codes' => $next, 'value' => $found];
            });
            if (!$ok) {
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

if (defined('PIMO_INVITE_CODES_ROUTER') && PIMO_INVITE_CODES_ROUTER) {
    pimo_invite_codes_router();
}

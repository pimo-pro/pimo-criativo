<?php
declare(strict_types=1);

/**
 * Auth API — login + /me (JWT HS256).
 * Incluído por public_html/api/auth/index.php com define('PIMO_AUTH_ROUTER', true).
 * Incluído por api/users/index.php só para funções partilhadas (sem PIMO_AUTH_ROUTER).
 */

if (defined('PIMO_AUTH_LIB_LOADED')) {
    return;
}
define('PIMO_AUTH_LIB_LOADED', true);

const PIMO_USERS_FILE = __DIR__ . '/../data/users.json';
const PIMO_JWT_TTL = 86400;

/**
 * Hostinger Shared: carrega env SERVER-ONLY se o ficheiro existir.
 * Nunca versionar o ficheiro com secret. Ordem: fora da webroot → fallback data/.
 */
(function (): void {
    $candidates = [
        // Prod (lib em public_html/api/_impl/auth): ../../../../ = /files/
        __DIR__ . '/../../../../pimo-private/server-env.local.php',
        // Fallback local / data ao lado da lib (api/data ou api/_impl/data)
        __DIR__ . '/../data/server-env.local.php',
    ];
    foreach ($candidates as $path) {
        if (is_file($path)) {
            require_once $path;
            return;
        }
    }
})();

/**
 * Ambiente da aplicação (fail-closed).
 * Ausente / desconhecido → production (nunca assume local).
 * Valores: local | development | staging | production | preview
 */
function pimo_app_env(): string
{
    $raw = getenv('PIMO_APP_ENV');
    if (!is_string($raw) || trim($raw) === '') {
        return 'production';
    }
    $env = strtolower(trim($raw));
    $allowed = ['local', 'development', 'staging', 'production', 'preview'];
    if (!in_array($env, $allowed, true)) {
        return 'production';
    }
    return $env;
}

/** Local / development explícitos apenas — staging/preview/production = false. */
function pimo_is_local_dev_environment(): bool
{
    $env = pimo_app_env();
    return $env === 'local' || $env === 'development';
}

/**
 * JWT signing secret.
 * - production/staging/preview: PIMO_JWT_SECRET obrigatório (≥32), senão null (fail-closed).
 * - local/development: PIMO_JWT_SECRET, senão PIMO_JWT_SECRET_LOCAL, senão material LOCAL-ONLY
 *   (nunca o antigo fallback de produção).
 *
 * @return non-empty-string|null
 */
function pimo_jwt_secret(): ?string
{
    $env = getenv('PIMO_JWT_SECRET');
    if (is_string($env) && strlen($env) >= 32) {
        return $env;
    }

    if (pimo_is_local_dev_environment()) {
        $local = getenv('PIMO_JWT_SECRET_LOCAL');
        if (is_string($local) && strlen($local) >= 32) {
            return $local;
        }
        // Material explícito só para PIMO_APP_ENV=local|development — não reutilizar em prod.
        return 'pimo-LOCAL-DEV-ONLY-jwt-not-for-prod-32+';
    }

    return null;
}

/** Emite 503 e termina se o secret JWT não estiver disponível (non-local). */
function pimo_require_jwt_secret(): string
{
    $secret = pimo_jwt_secret();
    if ($secret === null || $secret === '') {
        pimo_json_response([
            'status' => 'error',
            'message' => 'Auth misconfigured (PIMO_JWT_SECRET obrigatório neste ambiente)',
        ], 503);
        exit;
    }
    return $secret;
}

/** Token de sessão local de desenvolvimento — nunca é JWT válido em APIs reais. */
function pimo_is_local_dev_bearer(?string $token): bool
{
    return is_string($token) && $token === 'local-dev-token';
}

function pimo_cors(): void
{
    $allowed = ['https://pimo.pro', 'https://www.pimo.pro'];
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Max-Age: 86400');
}

function pimo_json_response(array $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}

function pimo_b64url_encode(string $bin): string
{
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}

function pimo_b64url_decode(string $b64): string
{
    $b64 = strtr($b64, '-_', '+/');
    $pad = strlen($b64) % 4;
    if ($pad > 0) {
        $b64 .= str_repeat('=', 4 - $pad);
    }
    $raw = base64_decode($b64, true);
    return $raw === false ? '' : $raw;
}

function pimo_jwt_encode(array $payload, string $secret, int $ttlSec = PIMO_JWT_TTL): string
{
    $header = ['typ' => 'JWT', 'alg' => 'HS256'];
    $now = time();
    $payload['iat'] = $now;
    $payload['exp'] = $now + $ttlSec;
    $h = pimo_b64url_encode(json_encode($header, JSON_THROW_ON_ERROR));
    $p = pimo_b64url_encode(json_encode($payload, JSON_THROW_ON_ERROR));
    $sig = pimo_b64url_encode(hash_hmac('sha256', $h . '.' . $p, $secret, true));
    return $h . '.' . $p . '.' . $sig;
}

/** @return array<string,mixed>|null */
function pimo_jwt_decode(string $jwt, ?string $secret): ?array
{
    if ($secret === null || $secret === '') {
        return null;
    }
    if (pimo_is_local_dev_bearer($jwt)) {
        return null;
    }
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) {
        return null;
    }
    [$h, $p, $s] = $parts;
    $check = pimo_b64url_encode(hash_hmac('sha256', $h . '.' . $p, $secret, true));
    if (!hash_equals($check, $s)) {
        return null;
    }
    $json = pimo_b64url_decode($p);
    $payload = json_decode($json, true);
    if (!is_array($payload)) {
        return null;
    }
    if (($payload['exp'] ?? 0) < time()) {
        return null;
    }
    return $payload;
}

/** @return list<array<string,mixed>> */
function pimo_load_users(): array
{
    if (!is_readable(PIMO_USERS_FILE)) {
        return [];
    }
    $raw = file_get_contents(PIMO_USERS_FILE);
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** @param list<array<string,mixed>> $users */
function pimo_save_users(array $users): void
{
    $dir = dirname(PIMO_USERS_FILE);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    file_put_contents(
        PIMO_USERS_FILE,
        json_encode($users, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)
    );
}

/** Retrocompat: contas antigas sem accountStatus tratam-se como aprovadas. */
function pimo_user_account_status(array $user): string
{
    $status = strtolower(trim((string) ($user['accountStatus'] ?? 'approved')));
    return $status === 'pending' ? 'pending' : 'approved';
}

/** Role efectivo para RBAC — pending usa sempre visitor até aprovação manual. */
function pimo_user_effective_role(array $user): string
{
    if (pimo_user_account_status($user) === 'pending') {
        return 'visitor';
    }
    $role = strtolower(trim((string) ($user['role'] ?? 'visitor')));
    return $role !== '' ? $role : 'visitor';
}

/** ID do admin da plataforma (primeiro user com role admin). */
function pimo_find_platform_admin_id(): ?string
{
    foreach (pimo_load_users() as $user) {
        if (strtolower(trim((string) ($user['role'] ?? ''))) === 'admin') {
            $id = trim((string) ($user['id'] ?? ''));
            if ($id !== '') {
                return $id;
            }
        }
    }
    return null;
}

/** @param array<string,mixed> $user */
function pimo_user_public(array $user): array
{
    $effectiveRole = pimo_user_effective_role($user);
    return [
        'id' => (string) ($user['id'] ?? ''),
        'email' => (string) ($user['email'] ?? ''),
        'username' => (string) ($user['username'] ?? ''),
        'role' => (string) ($user['role'] ?? 'visitor'),
        'effectiveRole' => $effectiveRole,
        'accountStatus' => pimo_user_account_status($user),
        'requestedRole' => isset($user['requestedRole']) ? (string) $user['requestedRole'] : null,
        'accountCategory' => isset($user['accountCategory']) ? (string) $user['accountCategory'] : null,
        'createdAt' => (string) ($user['createdAt'] ?? ''),
        'approvedAt' => isset($user['approvedAt']) ? (string) $user['approvedAt'] : null,
        'approvedBy' => isset($user['approvedBy']) ? (string) $user['approvedBy'] : null,
        'emailVerified' => pimo_user_email_verified($user),
        'requiresEmailVerification' => pimo_user_requires_email_verification($user),
    ];
}

/** @return list<string> */
function pimo_effective_permissions_for_user(array $user): array
{
    return pimo_effective_permissions(pimo_user_effective_role($user));
}

function pimo_auth_load_mail_client(): void
{
    if (defined('PIMO_MAIL_CLIENT_LOADED')) {
        return;
    }
    $path = __DIR__ . '/../mail/mailClient.php';
    if (is_file($path)) {
        require_once $path;
    }
}

/** Verificação de email só bloqueia contas pending (não-visitor). */
function pimo_user_requires_email_verification(array $user): bool
{
    return pimo_user_account_status($user) === 'pending';
}

function pimo_user_email_verified(array $user): bool
{
    if (!pimo_user_requires_email_verification($user)) {
        return true;
    }
    return ($user['emailVerified'] ?? false) === true;
}

/** @param list<array<string,mixed>> $users */
function pimo_find_user_by_verification_token(array $users, string $token): ?array
{
    $needle = trim($token);
    if ($needle === '') {
        return null;
    }
    foreach ($users as $u) {
        if (($u['emailVerificationToken'] ?? '') === $needle) {
            return $u;
        }
    }
    return null;
}

/**
 * Seed admin conhecido — APENAS local/development.
 * Staging/production/preview: nunca cria admin@pimo.local / admin123.
 */
function pimo_ensure_default_admin(): void
{
    if (!pimo_is_local_dev_environment()) {
        return;
    }
    $allow = getenv('PIMO_ALLOW_DEFAULT_ADMIN');
    // Em local/development: activo por omissão (workflow local).
    // Desligar com PIMO_ALLOW_DEFAULT_ADMIN=0.
    if (is_string($allow) && ($allow === '0' || strtolower($allow) === 'false')) {
        return;
    }

    $users = pimo_load_users();
    foreach ($users as $u) {
        if (($u['email'] ?? '') === 'admin@pimo.local') {
            return;
        }
    }
    $users[] = [
        'id' => bin2hex(random_bytes(16)),
        'email' => 'admin@pimo.local',
        'username' => 'admin',
        'passwordHash' => password_hash('admin123', PASSWORD_DEFAULT),
        'role' => 'admin',
        'createdAt' => gmdate('c'),
    ];
    pimo_save_users($users);
}

/** @return array<string,list<string>> */
function pimo_role_permissions_map(): array
{
    return [
        'admin' => ['admin.full_access', 'project.view.all', 'project.edit.self', 'user.manage.below'],
        'ultra+' => ['project.view.factory', 'user.manage.below', 'project.edit.self'],
        'ultra' => ['project.edit.self', 'project.view.self', 'project.send_to_production.self'],
        'pro' => ['project.edit.self', 'project.view.self'],
        'visitor' => ['project.view.self'],
    ];
}

/** @return list<string> */
function pimo_effective_permissions(string $role): array
{
    $map = pimo_role_permissions_map();
    return $map[$role] ?? $map['visitor'];
}

/** @param list<array<string,mixed>> $users */
function pimo_find_user_by_id(array $users, string $id): ?array
{
    foreach ($users as $u) {
        if (($u['id'] ?? '') === $id) {
            return $u;
        }
    }
    return null;
}

/** @param list<array<string,mixed>> $users */
function pimo_find_user_by_email(array $users, string $email): ?array
{
    $e = strtolower(trim($email));
    foreach ($users as $u) {
        if (strtolower((string) ($u['email'] ?? '')) === $e) {
            return $u;
        }
    }
    return null;
}

/** Username comparado em minúsculas (único para registo público). */
function pimo_find_user_by_username_ci(array $users, string $username): ?array
{
    $want = strtolower(trim($username));
    if ($want === '') {
        return null;
    }
    foreach ($users as $u) {
        if (strtolower(trim((string) ($u['username'] ?? ''))) === $want) {
            return $u;
        }
    }
    return null;
}

const PIMO_REGISTER_MIN_PASSWORD_LEN = 6;
const PIMO_USER_SETTINGS_DIR_FOR_REGISTER = __DIR__ . '/../data/user-settings';

/** Registo público: só `visitor` ou `pro`; qualquer outro valor (ex.: admin) → visitor. */
function pimo_register_normalize_public_role(mixed $roleInput): string
{
    $r = strtolower(trim((string) ($roleInput ?? '')));
    return $r === 'pro' ? 'pro' : 'visitor';
}

/** Categorias de negócio públicas (independentes de role/RBAC). */
function pimo_register_normalize_account_category(mixed $input): ?string
{
    $c = strtolower(trim((string) ($input ?? '')));
    $allowed = ['visitor', 'designer_arquiteto', 'lojista', 'fabricante'];
    return in_array($c, $allowed, true) ? $c : null;
}

/** Ficheiro inicial para GET/PATCH /user/settings (vazio). */
function pimo_auth_write_empty_user_settings(string $userId): void
{
    if (!is_dir(PIMO_USER_SETTINGS_DIR_FOR_REGISTER)) {
        mkdir(PIMO_USER_SETTINGS_DIR_FOR_REGISTER, 0755, true);
    }
    $path = PIMO_USER_SETTINGS_DIR_FOR_REGISTER . '/user-settings-' . $userId . '.json';
    $payload = [
        'updatedAt' => null,
        'settings' => new stdClass(),
    ];
    $encoded = json_encode(
        $payload,
        JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT
    );
    file_put_contents($path, $encoded);
}

function pimo_auth_handle_register(): void
{
    pimo_ensure_default_admin();
    $raw = file_get_contents('php://input') ?: '';
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        pimo_json_response(['status' => 'error', 'message' => 'JSON inválido'], 400);
        return;
    }
    $username = trim((string) ($body['username'] ?? ''));
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $password = (string) ($body['password'] ?? '');
    if ($username === '' || $email === '') {
        pimo_json_response(['status' => 'error', 'message' => 'username e email obrigatórios'], 400);
        return;
    }
    if (strlen($password) < PIMO_REGISTER_MIN_PASSWORD_LEN) {
        pimo_json_response([
            'status' => 'error',
            'message' => 'Password demasiado curta (mínimo ' . (string) PIMO_REGISTER_MIN_PASSWORD_LEN . ' caracteres)',
        ], 400);
        return;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        pimo_json_response(['status' => 'error', 'message' => 'Email inválido'], 400);
        return;
    }
    $users = pimo_load_users();
    if (pimo_find_user_by_email($users, $email) !== null) {
        pimo_json_response(['status' => 'error', 'message' => 'Email já registado'], 409);
        return;
    }
    if (pimo_find_user_by_username_ci($users, $username) !== null) {
        pimo_json_response(['status' => 'error', 'message' => 'Username já em uso'], 409);
        return;
    }
    $accountCategory = pimo_register_normalize_account_category($body['accountCategory'] ?? null);
    if ($accountCategory === null) {
        pimo_json_response(['status' => 'error', 'message' => 'accountCategory inválido'], 400);
        return;
    }
    $isVisitorCategory = $accountCategory === 'visitor';
    $id = bin2hex(random_bytes(16));
    $newUser = [
        'id' => $id,
        'email' => $email,
        'username' => $username,
        'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
        'role' => 'visitor',
        'accountCategory' => $accountCategory,
        'accountStatus' => $isVisitorCategory ? 'approved' : 'pending',
        'requestedRole' => $isVisitorCategory ? null : 'pro',
        'createdAt' => gmdate('c'),
    ];
    if ($isVisitorCategory) {
        $newUser['approvedAt'] = gmdate('c');
        $newUser['emailVerified'] = true;
    } else {
        $verificationToken = bin2hex(random_bytes(32));
        $newUser['emailVerified'] = false;
        $newUser['emailVerificationToken'] = $verificationToken;
    }
    $users[] = $newUser;
    pimo_save_users($users);
    try {
        pimo_auth_write_empty_user_settings($id);
    } catch (Throwable $e) {
        $users = array_values(array_filter($users, static fn($u) => ($u['id'] ?? '') !== $id));
        pimo_save_users($users);
        pimo_json_response(['status' => 'error', 'message' => 'Falha ao criar ficheiro de preferências'], 500);
        return;
    }

    pimo_auth_load_mail_client();
    if (!$isVisitorCategory) {
        $tokenForMail = (string) ($newUser['emailVerificationToken'] ?? '');
        pimo_mail_send_account_verification($newUser, $tokenForMail);
        pimo_mail_send_admin_pending_account($newUser);
    }

    pimo_json_response([
        'status' => 'ok',
        'requiresEmailVerification' => !$isVisitorCategory,
        'user' => pimo_user_public($newUser),
    ], 201);
}

function pimo_bearer_token(): ?string
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['Authorization'] ?? '';
    if (!is_string($h) || $h === '') {
        return null;
    }
    if (preg_match('/Bearer\s+(\S+)/i', $h, $m)) {
        return $m[1];
    }
    return null;
}

function pimo_request_path(): string
{
    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    $path = parse_url($uri, PHP_URL_PATH);
    return is_string($path) ? rtrim($path, '/') : '/';
}

function pimo_auth_handle_login(): void
{
    pimo_ensure_default_admin();
    $raw = file_get_contents('php://input') ?: '';
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        pimo_json_response(['status' => 'error', 'message' => 'JSON inválido'], 400);
        return;
    }
    $email = trim((string) ($body['email'] ?? ''));
    $password = (string) ($body['password'] ?? '');
    if ($email === '' || $password === '') {
        pimo_json_response(['status' => 'error', 'message' => 'email e password obrigatórios'], 400);
        return;
    }
    // K/K nunca passa pelo login JWT real — só /auth/dev-local em ambiente local.
    if ($email === 'K' && $password === 'K') {
        pimo_json_response([
            'status' => 'error',
            'message' => 'Credenciais inválidas',
        ], 401);
        return;
    }
    $users = pimo_load_users();
    $user = pimo_find_user_by_email($users, $email);
    if ($user === null || empty($user['passwordHash']) || !password_verify($password, (string) $user['passwordHash'])) {
        pimo_json_response(['status' => 'error', 'message' => 'Credenciais inválidas'], 401);
        return;
    }
    if (!pimo_user_email_verified($user)) {
        pimo_json_response([
            'status' => 'error',
            'message' => 'Confirme o seu e-mail antes de continuar — verifique a sua caixa de entrada.',
            'code' => 'email_not_verified',
        ], 403);
        return;
    }
    $secret = pimo_require_jwt_secret();
    $id = (string) $user['id'];
    $username = (string) ($user['username'] ?? $user['email']);
    $effectiveRole = pimo_user_effective_role($user);
    $perms = pimo_effective_permissions_for_user($user);
    if (pimo_user_effective_role($user) === 'admin') {
        $perms = array_values(array_unique([...$perms, 'admin.full_access']));
    }
    $token = pimo_jwt_encode(['sub' => $id, 'email' => $user['email']], $secret);
    pimo_json_response([
        'status' => 'ok',
        'token' => $token,
        'user' => [
            ...pimo_user_public($user),
            'username' => $username,
            'role' => $effectiveRole,
            'permissions' => $perms,
        ],
    ]);
}

/**
 * Login de desenvolvimento local (K/K).
 * Fail-closed: só com PIMO_APP_ENV=local|development.
 * Não emite JWT de produção — devolve token local não aceite pelas APIs JWT.
 */
function pimo_auth_handle_dev_local(): void
{
    if (!pimo_is_local_dev_environment()) {
        pimo_json_response([
            'status' => 'error',
            'message' => 'Local development auth disabled neste ambiente',
        ], 403);
        return;
    }
    $raw = file_get_contents('php://input') ?: '';
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        pimo_json_response(['status' => 'error', 'message' => 'JSON inválido'], 400);
        return;
    }
    $email = trim((string) ($body['email'] ?? ''));
    $password = (string) ($body['password'] ?? '');
    if ($email !== 'K' || $password !== 'K') {
        pimo_json_response(['status' => 'error', 'message' => 'Credenciais locais inválidas'], 401);
        return;
    }
    pimo_json_response([
        'status' => 'ok',
        'localDev' => true,
        'token' => 'local-dev-token',
        'user' => [
            'id' => 'local-user',
            'username' => 'Khaled Local',
            'role' => 'industrial',
        ],
    ]);
}

function pimo_auth_handle_me(): void
{
    $token = pimo_bearer_token();
    if ($token === null || $token === '') {
        pimo_json_response(['status' => 'error', 'message' => 'Não autenticado'], 401);
        return;
    }
    if (pimo_is_local_dev_bearer($token)) {
        pimo_json_response(['status' => 'error', 'message' => 'Token local de desenvolvimento não válido para APIs'], 401);
        return;
    }
    $secret = pimo_jwt_secret();
    if ($secret === null) {
        pimo_json_response([
            'status' => 'error',
            'message' => 'Auth misconfigured (PIMO_JWT_SECRET obrigatório neste ambiente)',
        ], 503);
        return;
    }
    $payload = pimo_jwt_decode($token, $secret);
    if ($payload === null || empty($payload['sub'])) {
        pimo_json_response(['status' => 'error', 'message' => 'Token inválido'], 401);
        return;
    }
    $users = pimo_load_users();
    $user = pimo_find_user_by_id($users, (string) $payload['sub']);
    if ($user === null) {
        pimo_json_response(['status' => 'error', 'message' => 'Utilizador não encontrado'], 401);
        return;
    }
    $effectiveRole = pimo_user_effective_role($user);
    $perms = pimo_effective_permissions_for_user($user);
    if ($effectiveRole === 'admin') {
        $perms = array_values(array_unique([...$perms, 'admin.full_access']));
    }
    pimo_json_response([
        'status' => 'ok',
        'user' => [
            ...pimo_user_public($user),
            'username' => (string) ($user['username'] ?? $user['email']),
            'role' => $effectiveRole,
            'permissions' => $perms,
        ],
    ]);
}

function pimo_auth_handle_verify_email(): void
{
    $token = isset($_GET['token']) ? trim((string) $_GET['token']) : '';
    if ($token === '') {
        pimo_json_response(['status' => 'error', 'message' => 'Token em falta'], 400);
        return;
    }
    $users = pimo_load_users();
    $foundIndex = null;
    foreach ($users as $i => $u) {
        if (($u['emailVerificationToken'] ?? '') === $token) {
            $foundIndex = $i;
            break;
        }
    }
    if ($foundIndex === null) {
        pimo_json_response(['status' => 'error', 'message' => 'Link inválido ou já utilizado'], 404);
        return;
    }
    $users[$foundIndex]['emailVerified'] = true;
    unset($users[$foundIndex]['emailVerificationToken']);
    $users[$foundIndex]['emailVerifiedAt'] = gmdate('c');
    pimo_save_users($users);
    pimo_json_response([
        'status' => 'ok',
        'message' => 'Email confirmado. Já pode fazer login.',
        'user' => pimo_user_public($users[$foundIndex]),
    ]);
}

function pimo_auth_router(): void
{
    pimo_cors();
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        return;
    }

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = pimo_request_path();
    $endsRegister = str_ends_with($path, '/auth/register');
    $endsLogin = str_ends_with($path, '/auth/login');
    $endsDevLocal = str_ends_with($path, '/auth/dev-local');
    $endsVerifyEmail = str_ends_with($path, '/auth/verify-email') || str_contains($path, '/verify-email');
    $isMe = $path === '/me' || str_ends_with($path, '/me');
    $postToAuthScript = $method === 'POST'
        && str_contains($path, 'api/auth')
        && !$endsRegister
        && !$endsDevLocal
        && !$endsLogin;

    try {
        if ($method === 'POST' && $endsDevLocal) {
            pimo_auth_handle_dev_local();
            return;
        }
        if ($method === 'POST' && $endsRegister) {
            pimo_auth_handle_register();
            return;
        }
        if ($method === 'GET' && $endsVerifyEmail) {
            pimo_auth_handle_verify_email();
            return;
        }
        if ($method === 'POST' && ($endsLogin || $postToAuthScript)) {
            pimo_auth_handle_login();
            return;
        }
        if ($method === 'GET' && $isMe) {
            pimo_auth_handle_me();
            return;
        }
        pimo_json_response(['status' => 'error', 'message' => 'Rota não encontrada'], 404);
    } catch (Throwable $e) {
        pimo_json_response(['status' => 'error', 'message' => 'Erro interno'], 500);
    }
}

if (defined('PIMO_AUTH_ROUTER') && PIMO_AUTH_ROUTER) {
    pimo_auth_router();
}

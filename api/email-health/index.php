<?php
declare(strict_types=1);

/**
 * Health check dos proxies de email (quotes + final-report).
 * - Auth CI: header X-Pimo-Email-Health-Secret (= PIMO_EMAIL_HEALTH_SECRET)
 * - Auth admin: Authorization Bearer JWT + admin.full_access
 * Não chama o Render; não envia email; não revela valores de secrets.
 *
 * Entrada pública: public_html/api/email-health/index.php (ou dist stub).
 */

$pimoEmailHealthServerEnvFound = false;
(function () use (&$pimoEmailHealthServerEnvFound): void {
    $candidates = [
        // Prod (lib em public_html/api/_impl/email-health): ../../../../ = /files/
        __DIR__ . '/../../../../pimo-private/server-env.local.php',
        __DIR__ . '/../data/server-env.local.php',
    ];
    foreach ($candidates as $path) {
        if (is_file($path)) {
            require_once $path;
            $pimoEmailHealthServerEnvFound = true;
            return;
        }
    }
})();

(function (): void {
    $candidates = [
        __DIR__ . '/../authz/resourceAccess.php',
    ];
    foreach ($candidates as $path) {
        if (is_file($path)) {
            require_once $path;
            return;
        }
    }
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Authz library unavailable'], JSON_UNESCAPED_UNICODE);
    exit;
})();

function pimo_email_health_json(array $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function pimo_email_health_cors(): void
{
    $allowed = ['https://pimo.pro', 'https://www.pimo.pro'];
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    } elseif ($origin === '' || str_starts_with($origin, 'http://localhost') || str_starts_with($origin, 'http://127.0.0.1')) {
        if ($origin !== '') {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
        }
    }
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Pimo-Email-Health-Secret');
    header('Access-Control-Max-Age: 86400');
}

function pimo_email_health_request_header(string $name): ?string
{
    $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    if (isset($_SERVER[$serverKey]) && is_string($_SERVER[$serverKey])) {
        return $_SERVER[$serverKey];
    }
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            foreach ($headers as $k => $v) {
                if (is_string($k) && strcasecmp($k, $name) === 0 && is_string($v)) {
                    return $v;
                }
            }
        }
    }
    return null;
}

/** @return 'ci'|null */
function pimo_email_health_try_ci_auth(): ?string
{
    $expected = getenv('PIMO_EMAIL_HEALTH_SECRET');
    if (!is_string($expected) || $expected === '') {
        return null;
    }
    $provided = pimo_email_health_request_header('X-Pimo-Email-Health-Secret');
    if ($provided === null || $provided === '') {
        return null;
    }
    if (!hash_equals($expected, $provided)) {
        return null;
    }
    return 'ci';
}

/** JWT admin.full_access — reutiliza pimo_authz_* (sem duplicar JWT). */
function pimo_email_health_require_admin_jwt(): void
{
    $user = pimo_authz_require_jwt_user();
    if (!pimo_authz_is_platform_admin($user)) {
        pimo_email_health_json([
            'ok' => false,
            'error' => 'Sem permissão (requer admin.full_access)',
        ], 403);
    }
}

/** @return 'ci'|'admin' */
function pimo_email_health_require_auth(): string
{
    $ci = pimo_email_health_try_ci_auth();
    if ($ci !== null) {
        return 'ci';
    }
    $bearer = pimo_bearer_token();
    if ($bearer === null || $bearer === '') {
        pimo_email_health_json(['ok' => false, 'error' => 'Não autenticado'], 401);
    }
    pimo_email_health_require_admin_jwt();
    return 'admin';
}

function pimo_email_health_last_paths(): array
{
    return [
        __DIR__ . '/../../../../pimo-private/email-health-last.json',
        __DIR__ . '/../data/email-health-last.json',
    ];
}

function pimo_email_health_write_last(array $payload): void
{
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($json === false) {
        return;
    }
    foreach (pimo_email_health_last_paths() as $path) {
        $dir = dirname($path);
        if (!is_dir($dir)) {
            if (!@mkdir($dir, 0755, true) && !is_dir($dir)) {
                continue;
            }
        }
        if (@file_put_contents($path, $json, LOCK_EX) !== false) {
            return;
        }
    }
}

function pimo_email_health_read_last(): ?array
{
    foreach (pimo_email_health_last_paths() as $path) {
        if (!is_readable($path)) {
            continue;
        }
        $raw = file_get_contents($path);
        if ($raw === false || $raw === '') {
            continue;
        }
        $data = json_decode($raw, true);
        if (is_array($data)) {
            return $data;
        }
    }
    return null;
}

function pimo_email_health_internal_secret_configured(): bool
{
    $env = getenv('PIMO_INTERNAL_API_SECRET');
    return is_string($env) && $env !== '';
}

/**
 * @return array{
 *   ok: bool,
 *   checkedAt: string,
 *   serverEnvFileFound: bool,
 *   internalSecretConfigured: bool,
 *   curlAvailable: bool,
 *   proxies: array{quotes: string, finalReport: string}
 * }
 */
function pimo_email_health_build_payload(bool $serverEnvFileFound): array
{
    $internalSecretConfigured = pimo_email_health_internal_secret_configured();
    $curlAvailable = function_exists('curl_init');
    $ok = $internalSecretConfigured && $curlAvailable;
    $proxyState = $internalSecretConfigured ? 'ready' : 'not_ready';
    return [
        'ok' => $ok,
        'checkedAt' => gmdate('c'),
        'serverEnvFileFound' => $serverEnvFileFound,
        'internalSecretConfigured' => $internalSecretConfigured,
        'curlAvailable' => $curlAvailable,
        'proxies' => [
            'quotes' => $proxyState,
            'finalReport' => $proxyState,
        ],
    ];
}

function pimo_email_health_handle_view_last(): void
{
    pimo_email_health_require_admin_jwt();
    pimo_email_health_json([
        'ok' => true,
        'last' => pimo_email_health_read_last(),
    ]);
}

function pimo_email_health_handle_check(bool $serverEnvFileFound): void
{
    $authSource = pimo_email_health_require_auth();
    $payload = pimo_email_health_build_payload($serverEnvFileFound);

    if ($authSource === 'ci') {
        pimo_email_health_write_last([
            'checkedAt' => $payload['checkedAt'],
            'ok' => $payload['ok'],
            'internalSecretConfigured' => $payload['internalSecretConfigured'],
            'source' => 'ci',
        ]);
    }

    $code = $payload['ok'] ? 200 : 503;
    pimo_email_health_json($payload, $code);
}

function pimo_email_health_router(bool $serverEnvFileFound): void
{
    pimo_email_health_cors();
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
        pimo_email_health_json(['ok' => false, 'error' => 'Método não suportado'], 405);
    }

    $view = isset($_GET['view']) ? (string) $_GET['view'] : '';
    if ($view === 'last') {
        pimo_email_health_handle_view_last();
        return;
    }

    pimo_email_health_handle_check($serverEnvFileFound);
}

if (defined('PIMO_EMAIL_HEALTH_ROUTER') && PIMO_EMAIL_HEALTH_ROUTER) {
    pimo_email_health_router($pimoEmailHealthServerEnvFound);
}

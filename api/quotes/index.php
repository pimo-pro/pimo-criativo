<?php
declare(strict_types=1);

/**
 * Hostinger Shared: carrega env SERVER-ONLY se o ficheiro existir.
 * Mesmo padrão que api/auth/index.php (quotes em _impl/quotes = irmão de _impl/auth).
 */
(function (): void {
    $candidates = [
        // Prod (lib em public_html/api/_impl/quotes): ../../../../ = /files/
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
 * Proxy server-side para o serviço de email de orçamentos.
 * O secret NÃO vai para o bundle Vite — vive em PIMO_INTERNAL_API_SECRET (Hostinger).
 *
 * Entrada pública: public_html/api/quotes/index.php
 */

const PIMO_QUOTE_MAIL_URL = 'https://pimo-mail-service.onrender.com/send-quote-email';
const PIMO_QUOTE_TIMEOUT_SEC = 60;

function pimo_quotes_json(array $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function pimo_quotes_cors(): void
{
    $allowed = ['https://pimo.pro', 'https://www.pimo.pro'];
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    } elseif ($origin === '' || str_starts_with($origin, 'http://localhost') || str_starts_with($origin, 'http://127.0.0.1')) {
        // Dev local (Vite) — sem credenciais sensíveis na resposta.
        if ($origin !== '') {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
        }
    }
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Max-Age: 86400');
}

function pimo_quotes_internal_secret(): ?string
{
    $env = getenv('PIMO_INTERNAL_API_SECRET');
    if (is_string($env) && $env !== '') {
        return $env;
    }
    return null;
}

function pimo_quotes_handle_post(): void
{
    $secret = pimo_quotes_internal_secret();
    if ($secret === null) {
        pimo_quotes_json([
            'success' => false,
            'error' => 'Serviço de email não configurado (PIMO_INTERNAL_API_SECRET)',
        ], 503);
    }

    if (!function_exists('curl_init')) {
        pimo_quotes_json(['success' => false, 'error' => 'cURL indisponível no servidor'], 500);
    }

    $fields = [
        'customerName',
        'customerEmail',
        'customerPhone',
        'projectName',
        'designer',
        'materials',
        'notes',
        'pricingSummary',
    ];
    $postFields = [];
    foreach ($fields as $field) {
        $postFields[$field] = isset($_POST[$field]) ? (string) $_POST[$field] : '';
    }

    if (isset($_FILES['attachment']) && is_array($_FILES['attachment']) && (int) ($_FILES['attachment']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
        $tmp = (string) ($_FILES['attachment']['tmp_name'] ?? '');
        $name = (string) ($_FILES['attachment']['name'] ?? 'orcamento.jpg');
        $type = (string) ($_FILES['attachment']['type'] ?? 'application/octet-stream');
        if ($tmp !== '' && is_readable($tmp)) {
            $postFields['attachment'] = new CURLFile($tmp, $type, $name);
        }
    }

    $ch = curl_init(PIMO_QUOTE_MAIL_URL);
    if ($ch === false) {
        pimo_quotes_json(['success' => false, 'error' => 'Falha ao iniciar pedido'], 500);
    }
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $postFields,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => PIMO_QUOTE_TIMEOUT_SEC,
        CURLOPT_HTTPHEADER => [
            'x-internal-secret: ' . $secret,
        ],
    ]);
    $raw = curl_exec($ch);
    $errno = curl_errno($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($errno !== 0 || $raw === false) {
        pimo_quotes_json(['success' => false, 'error' => 'Falha de rede ao serviço de email'], 502);
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        pimo_quotes_json(['success' => false, 'error' => 'Resposta inválida do serviço de email'], 502);
    }

    http_response_code($status >= 100 && $status < 600 ? $status : 200);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function pimo_quotes_router(): void
{
    pimo_quotes_cors();
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        pimo_quotes_json(['success' => false, 'error' => 'Método não suportado'], 405);
    }
    pimo_quotes_handle_post();
}

if (defined('PIMO_QUOTES_ROUTER') && PIMO_QUOTES_ROUTER) {
    pimo_quotes_router();
}

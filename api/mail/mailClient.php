<?php
declare(strict_types=1);

/**
 * Cliente HTTP interno → pimo-mail-service (Brevo).
 * Só incluído server-side (auth/users). Secret: PIMO_INTERNAL_API_SECRET.
 */

if (defined('PIMO_MAIL_CLIENT_LOADED')) {
    return;
}
define('PIMO_MAIL_CLIENT_LOADED', true);

const PIMO_MAIL_SERVICE_BASE = 'https://pimo-mail-service.onrender.com';
const PIMO_MAIL_TIMEOUT_SEC = 8;

function pimo_mail_internal_secret(): ?string
{
    $env = getenv('PIMO_INTERNAL_API_SECRET');
    return is_string($env) && $env !== '' ? $env : null;
}

function pimo_mail_public_app_url(): string
{
    $env = getenv('PIMO_PUBLIC_APP_URL');
    if (is_string($env) && $env !== '') {
        return rtrim($env, '/');
    }
    return 'https://pimo.pro';
}

function pimo_mail_admin_notify_email(): ?string
{
    $env = getenv('PIMO_ADMIN_NOTIFY_EMAIL');
    return is_string($env) && $env !== '' ? trim($env) : null;
}

/**
 * POST JSON ao mail-service. Devolve true se enviado com sucesso; false se falhar (não lança).
 *
 * @param array<string,mixed> $payload
 */
function pimo_mail_post_json(string $path, array $payload): bool
{
    $secret = pimo_mail_internal_secret();
    if ($secret === null || !function_exists('curl_init')) {
        return false;
    }
    $url = PIMO_MAIL_SERVICE_BASE . $path;
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        return false;
    }
    $ch = curl_init($url);
    if ($ch === false) {
        return false;
    }
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $json,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => PIMO_MAIL_TIMEOUT_SEC,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-internal-secret: ' . $secret,
        ],
    ]);
    $raw = curl_exec($ch);
    $errno = curl_errno($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($errno !== 0 || $raw === false || $status < 200 || $status >= 300) {
        return false;
    }
    return true;
}

/** @param array<string,mixed> $user */
function pimo_mail_send_account_verification(array $user, string $verificationToken): bool
{
    $email = trim((string) ($user['email'] ?? ''));
    if ($email === '' || $verificationToken === '') {
        return false;
    }
    $verifyUrl = pimo_mail_public_app_url() . '/verify-email?token=' . rawurlencode($verificationToken);
    return pimo_mail_post_json('/send-account-verification', [
        'to' => $email,
        'username' => (string) ($user['username'] ?? ''),
        'verifyUrl' => $verifyUrl,
    ]);
}

/** @param array<string,mixed> $user */
function pimo_mail_send_admin_pending_account(array $user): bool
{
    $adminEmail = pimo_mail_admin_notify_email();
    if ($adminEmail === null) {
        return false;
    }
    $adminUrl = pimo_mail_public_app_url() . '/admin/users';
    return pimo_mail_post_json('/send-admin-pending-account', [
        'adminEmail' => $adminEmail,
        'username' => (string) ($user['username'] ?? ''),
        'userEmail' => (string) ($user['email'] ?? ''),
        'accountCategory' => (string) ($user['accountCategory'] ?? ''),
        'adminUrl' => $adminUrl,
    ]);
}

/** @param array<string,mixed> $user */
function pimo_mail_send_account_approved(array $user): bool
{
    $email = trim((string) ($user['email'] ?? ''));
    if ($email === '') {
        return false;
    }
    $meUrl = pimo_mail_public_app_url() . '/me';
    return pimo_mail_post_json('/send-account-approved', [
        'to' => $email,
        'username' => (string) ($user['username'] ?? ''),
        'role' => (string) ($user['role'] ?? 'pro'),
        'meUrl' => $meUrl,
    ]);
}

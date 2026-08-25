<?php
declare(strict_types=1);

/**
 * Carrega api/authz/resourceAccess.php a partir de um endpoint PHP.
 * Paths: dist (_impl) e monorepo (api/authz).
 */
function pimo_load_authz_lib(string $endpointDir): void
{
    if (defined('PIMO_AUTHZ_LIB_LOADED')) {
        return;
    }
    $candidates = [
        $endpointDir . '/../_impl/authz/resourceAccess.php',
        $endpointDir . '/../../_impl/authz/resourceAccess.php',
        $endpointDir . '/../../../api/authz/resourceAccess.php',
        $endpointDir . '/../../authz/resourceAccess.php',
    ];
    foreach ($candidates as $path) {
        if (is_file($path)) {
            require_once $path;
            return;
        }
    }
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'error',
        'message' => 'Authz library unavailable',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

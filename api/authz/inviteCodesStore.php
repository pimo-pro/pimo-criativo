<?php
declare(strict_types=1);

/**
 * Persistência de códigos de convite (SSOT: api/data/invite-codes.json).
 * Todas as mutações passam por flock(LOCK_EX).
 */

if (defined('PIMO_INVITE_CODES_STORE_LOADED')) {
    return;
}
define('PIMO_INVITE_CODES_STORE_LOADED', true);

const PIMO_INVITE_CODES_FILE = __DIR__ . '/../data/invite-codes.json';
const PIMO_INVITE_ROLES = ['pro', 'ultra', 'ultra+'];
const PIMO_INVITE_INVALID_MESSAGE = 'Código de convite inválido ou expirado';

function pimo_invite_normalize_code(string $code): string
{
    return strtoupper(trim($code));
}

function pimo_invite_is_usable(array $invite): bool
{
    if (($invite['active'] ?? false) !== true) {
        return false;
    }
    $mode = (string) ($invite['usageMode'] ?? 'single');
    $used = (int) ($invite['usedCount'] ?? 0);
    if ($mode === 'single') {
        return $used < 1;
    }
    $limit = $invite['usageLimit'] ?? null;
    if ($limit === null || $limit === '') {
        return true;
    }
    return $used < (int) $limit;
}

/**
 * @template T
 * @param callable(list<array<string,mixed>>):array{codes:list<array<string,mixed>>,value:T} $fn
 * @return T
 */
function pimo_invite_codes_mutate(callable $fn)
{
    $path = PIMO_INVITE_CODES_FILE;
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    if (!is_file($path)) {
        file_put_contents($path, "[]\n", LOCK_EX);
    }
    $fp = fopen($path, 'c+');
    if ($fp === false) {
        throw new RuntimeException('Não foi possível abrir invite-codes.json');
    }
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        throw new RuntimeException('Não foi possível bloquear invite-codes.json');
    }
    try {
        rewind($fp);
        $raw = stream_get_contents($fp);
        $codes = [];
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            $codes = is_array($decoded) ? $decoded : [];
        }
        $result = $fn($codes);
        if (!is_array($result) || !isset($result['codes'], $result['value'])) {
            throw new RuntimeException('Mutação invite-codes inválida');
        }
        $json = json_encode(
            $result['codes'],
            JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR
        ) . "\n";
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, $json);
        fflush($fp);
        return $result['value'];
    } finally {
        flock($fp, LOCK_UN);
        fclose($fp);
    }
}

/** @return list<array<string,mixed>> */
function pimo_load_invite_codes(): array
{
    return pimo_invite_codes_mutate(static function (array $codes): array {
        return ['codes' => $codes, 'value' => $codes];
    });
}

/**
 * Tenta consumir um código. Inválido → warning (registo continua sem aplicar).
 *
 * @return array{applied:bool,invite:?array<string,mixed>,warning:?string}
 */
function pimo_invite_try_consume(string $rawCode): array
{
    $normalized = pimo_invite_normalize_code($rawCode);
    if ($normalized === '') {
        return ['applied' => false, 'invite' => null, 'warning' => null];
    }

    return pimo_invite_codes_mutate(static function (array $codes) use ($normalized): array {
        $idx = null;
        foreach ($codes as $i => $c) {
            if (!is_array($c)) {
                continue;
            }
            if (pimo_invite_normalize_code((string) ($c['code'] ?? '')) === $normalized) {
                $idx = $i;
                break;
            }
        }
        if ($idx === null || !pimo_invite_is_usable($codes[$idx])) {
            return [
                'codes' => $codes,
                'value' => [
                    'applied' => false,
                    'invite' => null,
                    'warning' => PIMO_INVITE_INVALID_MESSAGE,
                ],
            ];
        }
        $invite = $codes[$idx];
        $invite['usedCount'] = (int) ($invite['usedCount'] ?? 0) + 1;
        $invite['lastUsedAt'] = gmdate('c');
        if (($invite['usageMode'] ?? '') === 'single') {
            $invite['active'] = false;
        }
        $codes[$idx] = $invite;
        return [
            'codes' => $codes,
            'value' => [
                'applied' => true,
                'invite' => $invite,
                'warning' => null,
            ],
        ];
    });
}

/** @param array<string,mixed> $invite */
function pimo_invite_public(array $invite): array
{
    $used = (int) ($invite['usedCount'] ?? 0);
    $mode = (string) ($invite['usageMode'] ?? 'single');
    $active = ($invite['active'] ?? false) === true;
    $status = 'desactivado';
    if ($active && pimo_invite_is_usable($invite)) {
        $status = 'activo';
    } elseif ($mode === 'single' && $used >= 1) {
        $status = 'usado';
    } elseif (!$active) {
        $status = 'desactivado';
    }

    return [
        'id' => (string) ($invite['id'] ?? ''),
        'code' => (string) ($invite['code'] ?? ''),
        'role' => (string) ($invite['role'] ?? ''),
        'usageMode' => $mode,
        'usageLimit' => array_key_exists('usageLimit', $invite) ? $invite['usageLimit'] : null,
        'usedCount' => $used,
        'active' => $active,
        'status' => $status,
        'createdAt' => (string) ($invite['createdAt'] ?? ''),
        'createdBy' => isset($invite['createdBy']) ? (string) $invite['createdBy'] : null,
        'disabledAt' => isset($invite['disabledAt']) ? (string) $invite['disabledAt'] : null,
        'disabledBy' => isset($invite['disabledBy']) ? (string) $invite['disabledBy'] : null,
        'lastUsedAt' => isset($invite['lastUsedAt']) ? (string) $invite['lastUsedAt'] : null,
    ];
}

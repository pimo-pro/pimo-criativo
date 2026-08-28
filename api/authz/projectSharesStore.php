<?php
declare(strict_types=1);

/**
 * Persistência de partilhas de projecto (SSOT: api/data/project-shares.json).
 */

if (defined('PIMO_PROJECT_SHARES_STORE_LOADED')) {
    return;
}
define('PIMO_PROJECT_SHARES_STORE_LOADED', true);

const PIMO_PROJECT_SHARES_FILE = __DIR__ . '/../data/project-shares.json';

/** @return list<array<string,mixed>> */
function pimo_load_project_shares(): array
{
    if (!is_readable(PIMO_PROJECT_SHARES_FILE)) {
        return [];
    }
    $raw = file_get_contents(PIMO_PROJECT_SHARES_FILE);
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** @param list<array<string,mixed>> $shares */
function pimo_save_project_shares(array $shares): void
{
    $dir = dirname(PIMO_PROJECT_SHARES_FILE);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    file_put_contents(
        PIMO_PROJECT_SHARES_FILE,
        json_encode($shares, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)
    );
}

/** @return list<array<string,mixed>> */
function pimo_find_shares_for_user(string $userId): array
{
    $uid = trim($userId);
    if ($uid === '') {
        return [];
    }
    return array_values(array_filter(
        pimo_load_project_shares(),
        static fn(array $s): bool => (string) ($s['userId'] ?? '') === $uid
    ));
}

/** @return list<array<string,mixed>> */
function pimo_find_shares_for_project(string $projectId): array
{
    $pid = trim($projectId);
    if ($pid === '') {
        return [];
    }
    return array_values(array_filter(
        pimo_load_project_shares(),
        static fn(array $s): bool => (string) ($s['projectId'] ?? '') === $pid
    ));
}

function pimo_find_project_share(string $projectId, string $userId): ?array
{
    $pid = trim($projectId);
    $uid = trim($userId);
    if ($pid === '' || $uid === '') {
        return null;
    }
    foreach (pimo_load_project_shares() as $share) {
        if ((string) ($share['projectId'] ?? '') === $pid && (string) ($share['userId'] ?? '') === $uid) {
            return $share;
        }
    }
    return null;
}

/** @return list<string> */
function pimo_shared_project_ids_for_user(string $userId): array
{
    $ids = [];
    foreach (pimo_find_shares_for_user($userId) as $share) {
        $pid = trim((string) ($share['projectId'] ?? ''));
        if ($pid !== '') {
            $ids[] = $pid;
        }
    }
    return array_values(array_unique($ids));
}

/**
 * @return array<string,mixed>
 */
function pimo_add_project_share(string $projectId, string $userId, string $grantedBy): array
{
    $existing = pimo_find_project_share($projectId, $userId);
    if ($existing !== null) {
        return $existing;
    }
    $share = [
        'id' => bin2hex(random_bytes(16)),
        'projectId' => trim($projectId),
        'userId' => trim($userId),
        'grantedBy' => trim($grantedBy),
        'access' => 'edit',
        'createdAt' => gmdate('c'),
    ];
    $shares = pimo_load_project_shares();
    $shares[] = $share;
    pimo_save_project_shares($shares);
    return $share;
}

function pimo_remove_project_share(string $shareId): bool
{
    $id = trim($shareId);
    if ($id === '') {
        return false;
    }
    $shares = pimo_load_project_shares();
    $next = array_values(array_filter($shares, static fn(array $s): bool => (string) ($s['id'] ?? '') !== $id));
    if (count($next) === count($shares)) {
        return false;
    }
    pimo_save_project_shares($next);
    return true;
}

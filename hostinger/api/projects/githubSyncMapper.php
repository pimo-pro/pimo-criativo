<?php
/**
 * Extrai fatias do PimoProjectData para o arquivo GitHub.
 * Não altera o JSON original em disco — apenas lê e devolve arrays.
 */
declare(strict_types=1);

/**
 * @param array<string, mixed> $project
 * @return array<string, mixed>
 */
function pimo_github_sync_state_from_project(array $project): array
{
    $settings = isset($project["settings"]) && is_array($project["settings"])
        ? $project["settings"]
        : [];
    $state = isset($settings["projectState"]) && is_array($settings["projectState"])
        ? $settings["projectState"]
        : [];
    return $state;
}

/**
 * @param array<string, mixed> $project
 * @return array{path: string, content: string, message: string}[]
 */
function pimo_github_sync_build_files(array $project, string $op): array
{
    $id = isset($project["id"]) ? trim((string)$project["id"]) : "";
    if ($id === "") {
        $id = "unknown";
    }
    $base = "projects/" . $id;
    $state = pimo_github_sync_state_from_project($project);
    $deleted = ($op === "delete");

    $contentSha = hash(
        "sha256",
        json_encode($project, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: ""
    );

    $metadata = [
        "id" => $project["id"] ?? null,
        "name" => $project["name"] ?? null,
        "ownerId" => $project["ownerId"] ?? null,
        "createdAt" => $project["createdAt"] ?? null,
        "updatedAt" => $project["updatedAt"] ?? null,
        "contentSha" => $contentSha,
        "deleted" => $deleted,
        "lastSyncOp" => $op,
        "lastSyncedAt" => gmdate("c"),
    ];

    $design = [
        "boxes" => $project["boxes"] ?? ($state["workspaceBoxes"] ?? $state["boxes"] ?? null),
        "shelves" => $project["shelves"] ?? null,
        "dividers" => $project["dividers"] ?? null,
        "design" => $state["design"] ?? null,
        "rules" => $state["rules"] ?? null,
        "material" => $state["material"] ?? ($project["materials"] ?? null),
        "workspaceBoxes" => $state["workspaceBoxes"] ?? null,
    ];

    $medidas = [
        "measurements" => $state["measurements"] ?? null,
        "room" => $project["room"] ?? ($state["room"] ?? null),
        "centerDisplay" => $project["centerDisplay"] ?? null,
    ];

    $precos = [
        "resultados" => $state["resultados"] ?? null,
        "precoTotalPecas" => $state["precoTotalPecas"] ?? null,
        "precoTotalAcessorios" => $state["precoTotalAcessorios"] ?? null,
        "precoTotalProjeto" => $state["precoTotalProjeto"] ?? null,
        "cutListComPreco" => $state["cutListComPreco"] ?? null,
        "financeiroOverrides" => $state["financeiroOverrides"] ?? null,
        "financeiroAdminSettings" => $state["financeiroAdminSettings"] ?? null,
        "acessorios" => $state["acessorios"] ?? null,
    ];

    $industrial = [
        "cutList" => $state["cutList"] ?? null,
        "holes" => $project["holes"] ?? null,
        "drillMarkers" => $project["drillMarkers"] ?? null,
        "industrialDocumentOverrides" => $state["industrialDocumentOverrides"] ?? null,
        "industrialDocumentHistory" => $state["industrialDocumentHistory"] ?? null,
        "industrialPieceEdits" => $state["industrialPieceEdits"] ?? null,
        "orla" => $state["orla"] ?? null,
        "remates" => $state["remates"] ?? null,
        "rodapes" => $state["rodapes"] ?? null,
    ];

    $viewer = [
        "viewerSnapshot" => $project["viewerSnapshot"] ?? ($state["viewerSettings"] ?? null),
        "roomSnapshot" => $state["room"] ?? ($project["room"] ?? null),
        "viewerSettings" => $state["viewerSettings"] ?? null,
    ];

    $files = [
        [
            "path" => $base . "/metadata.json",
            "content" => pimo_github_sync_pretty_json($metadata),
            "message" => "metadata {$id}",
        ],
        [
            "path" => $base . "/project.json",
            "content" => pimo_github_sync_pretty_json($deleted ? array_merge($project, ["_deleted" => true]) : $project),
            "message" => "project {$id}",
        ],
        [
            "path" => $base . "/design.json",
            "content" => pimo_github_sync_pretty_json($design),
            "message" => "design {$id}",
        ],
        [
            "path" => $base . "/medidas.json",
            "content" => pimo_github_sync_pretty_json($medidas),
            "message" => "medidas {$id}",
        ],
        [
            "path" => $base . "/precos.json",
            "content" => pimo_github_sync_pretty_json($precos),
            "message" => "precos {$id}",
        ],
        [
            "path" => $base . "/industrial.json",
            "content" => pimo_github_sync_pretty_json($industrial),
            "message" => "industrial {$id}",
        ],
        [
            "path" => $base . "/viewer.json",
            "content" => pimo_github_sync_pretty_json($viewer),
            "message" => "viewer {$id}",
        ],
    ];

    $reports = pimo_github_sync_extract_reports($project, $state);
    foreach ($reports as $reportFile) {
        $files[] = [
            "path" => $base . "/reports/" . $reportFile["name"],
            "content" => $reportFile["content"],
            "message" => "report {$id}/" . $reportFile["name"],
        ];
    }

    return $files;
}

/**
 * @param array<string, mixed> $project
 * @param array<string, mixed> $state
 * @return array{name: string, content: string}[]
 */
function pimo_github_sync_extract_reports(array $project, array $state): array
{
    $out = [];
    $candidates = [];

    if (isset($state["projectReport"]) && is_array($state["projectReport"])) {
        $candidates["report.json"] = $state["projectReport"];
    }
    if (isset($state["finalReport"]) && is_array($state["finalReport"])) {
        $candidates["final-report.json"] = $state["finalReport"];
    }
    if (isset($project["reports"]) && is_array($project["reports"])) {
        $candidates["reports.json"] = $project["reports"];
    }

    foreach ($candidates as $name => $payload) {
        $out[] = [
            "name" => $name,
            "content" => pimo_github_sync_pretty_json($payload),
        ];
    }

    // PDFs em base64 se presentes (ex.: { name, dataBase64 } ou data URLs)
    $pdfBags = [];
    if (isset($state["reportPdfs"]) && is_array($state["reportPdfs"])) {
        $pdfBags[] = $state["reportPdfs"];
    }
    if (isset($project["reportPdfs"]) && is_array($project["reportPdfs"])) {
        $pdfBags[] = $project["reportPdfs"];
    }
    $i = 0;
    foreach ($pdfBags as $bag) {
        foreach ($bag as $key => $item) {
            $i++;
            $fileName = is_string($key) && preg_match('/\.pdf$/i', $key)
                ? basename($key)
                : ("report-{$i}.pdf");
            if (is_string($item) && str_starts_with($item, "data:application/pdf")) {
                $parts = explode(",", $item, 2);
                if (isset($parts[1]) && $parts[1] !== "") {
                    $out[] = [
                        "name" => $fileName,
                        "content" => base64_decode($parts[1], true) ?: $parts[1],
                    ];
                }
            } elseif (is_array($item) && isset($item["dataBase64"]) && is_string($item["dataBase64"])) {
                $name = isset($item["name"]) && is_string($item["name"])
                    ? basename($item["name"])
                    : $fileName;
                if (!str_ends_with(strtolower($name), ".pdf")) {
                    $name .= ".pdf";
                }
                $decoded = base64_decode($item["dataBase64"], true);
                $out[] = [
                    "name" => $name,
                    "content" => $decoded !== false ? $decoded : $item["dataBase64"],
                ];
            }
        }
    }

    if ($out === []) {
        $out[] = [
            "name" => "README.txt",
            "content" => "Sem relatórios PDF no payload deste save. A restauração completa usa project.json.\n",
        ];
    }

    return $out;
}

/**
 * @param mixed $data
 */
function pimo_github_sync_pretty_json($data): string
{
    $json = json_encode(
        $data,
        JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
    );
    return $json === false ? "{}" : ($json . "\n");
}

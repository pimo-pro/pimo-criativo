# Viewer – Nunca sobrescrever posição inicial (catálogo)

## 1. Lista dos ficheiros modificados

- **`src/3d/core/Viewer.ts`**
- **`docs/VIEWER_NUNCA_SOBRESCREVER_POSICAO.md`** (este ficheiro)

---

## 2. Explicação do impacto

| Alteração | Impacto |
|-----------|---------|
| **Carregamento do modelo (addModelToBox)** | Para caixas com `manualPosition`, não se chama `centerObjectInGroup(object)` nem no fluxo de catálogo nem no fluxo CAD-only. Assim, nenhuma lógica no loader/onLoad altera a posição do **grupo** (entry.mesh). O modelo pode ficar só com escala aplicada, sem recentrar. |
| **applyCatalogModelScale** | Passa a receber `manualPosition` no `entry` e só chama `centerObjectInGroup(object)` quando `!entry.manualPosition`. Com `manualPosition` aplica apenas escala; não recentra. |
| **updateBox** | Bloco de dimensões: `entry.mesh.position.y = height/2` só quando `entry.cadOnly && !entry.manualPosition`. Bloco de posição: ramo explícito `if (entry.manualPosition && !opts.position)` em que não se altera `position.x/y/z`; só se aplica posição quando há `opts.position` ou quando não é `manualPosition`. |
| **reflowBoxes** | Ramo explícito `if (entry.manualPosition)` em que não se altera posição (apenas comentário); `position.x` e `position.z` só são definidos no `else`. Garante que caixas com posição do ProjectProvider nunca são movidas pelo reflow. |
| **addBox / getRightmostX** | Mantidos: posição aplicada imediatamente, registo em `this.boxes` antes de adicionar à cena, e `getRightmostX` com fallback `position + width/2` quando o bbox ainda não está disponível. |

Com isto:

- Nenhuma linha no Viewer altera `entry.mesh.position` (position.x/y/z da caixa) durante addBox (excepto a atribuição inicial), durante o carregamento do modelo, em centerObject/recenter, ou em reflow, quando a caixa tem `manualPosition` e não há `opts.position` explícito.
- A posição inicial (X = rightmost + 0.1 m, Y = altura/2, Z = 0) é aplicada uma vez em addBox e não é sobrescrita.
- clampTransform e colisão continuam a ser apenas em objectChange (arraste), não na criação.

---

## 3. Diff completo das mudanças

Ver output de:

```bash
git diff -- src/3d/core/Viewer.ts
```

Resumo das alterações no Viewer:

- **getRightmostX**: comentário e fallback com `position.x + width/2` quando bbox inválido/zero.
- **addBox**: posição aplicada imediatamente; registo em `this.boxes` antes de `sceneManager.add(box)`; comentários.
- **updateBox**: `position.y = height/2` apenas quando `entry.cadOnly && !entry.manualPosition`; ramo `if (entry.manualPosition && !opts.position)` sem alterar posição; resto da lógica de posição inalterada.
- **addModelToBox**: em CAD-only não-catálogo, `centerObjectInGroup(object)` só quando `!entry.manualPosition`.
- **applyCatalogModelScale**: tipo de `entry` com `manualPosition?: boolean`; `centerObjectInGroup(object)` só quando `!entry.manualPosition`.
- **reflowBoxes**: ramo `if (entry.manualPosition)` explícito sem alterar position; `else` com atribuição de `position.x` e `position.z`.

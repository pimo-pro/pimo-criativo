# Drawers Domain

Sistema completo e independente para gerenciamento de gavetas no PIMO-CRIATIVO.

## Modelo A vs Modelo B

| | Modelo A (atual) | Modelo B (europeu) |
|---|---|---|
| Local | este domínio (`src/core/drawers/**`) | `src/core/drawers/european/**` |
| Estado | implementado | **só estrutura** (sem regras/furos/medidas) |
| Flag | `drawerSystemFlags.ts` — default **ATIVO** | ainda sem flag de produção |
| Admin | **Produtos → Gavetas** (+ páginas legadas) | pré-visualização no hub Admin |

### Desativar Modelo A

Em **Admin → Produtos → Gavetas**, o toggle
**“Desativar Sistema Atual de Gavetas (Modelo A)”**:

- **Não apaga** código nem dados do projeto
- Torna o Modelo A invisível/inativo (UI, geração, furos, PDF, reconhecimento)
- O projeto continua funcional sem gavetas

Helpers: `isDrawerModeloAActive()`, `resolveActiveDrawersLayer()`, `resolveActiveGavetasCount()`.

---

## Regras de Marcenaria (Padrões Globais)

Este domínio implementa regras reais de marcenaria para gavetas:

### Estrutura de uma Gaveta Real

Uma gaveta é composta por **5 peças principais de madeira**:

1. **FRENTE** (face externa)
  - Cobre a abertura do box
  - Largura = `larguraInterna - 2mm` (1mm folga cada lado)
  - Altura = `alturaGaveta - 2mm` (1mm folga)
  - Espessura = 19mm (configurável)
  - Posição: avança 19mm para fora do box
  - **Colada ao corpo** (move-se junto)

2. **LATERAIS** (esquerda + direita)
  - Formam as paredes internas
  - Largura corpo = `larguraInterna - 14mm` (7mm cada lado para corrediças)
  - Altura = `alturaFrente × (1 − gavetaReducaoPercentual/100)` (default 25% → 0,75 — Admin)
  - Espessura = 16mm (configurável)
  - Profundidade = comprimento_corrediça − 10 mm
  - **Encostadas no fundo e traseira**

3. **FUNDO** (base interna)
  - Base da gaveta onde os objetos ficam
  - Espessura = 10mm
  - Largura = vão entre laterais + 10 + 10 (entradas nos rasgos)
  - Profundidade = profundidade_lateral + 10 + espessura_costa
  - **Entra nos rasgos das outras peças**
  - Fica embaixo do corpo

4. **TRASEIRA** (parede do fundo)
  - Fecha o fundo da gaveta
  - Largura = larguraCorpo − 2 × espessura_lateral
  - Altura = `alturaLaterais × (1 − gavetaReducaoPercentual/100)` (mesmo factor — Admin)
  - Espessura = 16mm (configurável)
  - **Encostada nas laterais**

### Ferragens (Hardware)

- **Corrediças telescópicas**: 2 por gaveta (uma cada lado)
- **Parafusos**: ~8 por gaveta (montagem)
- **Puxador**: 1 por gaveta (frente)

### Montagem

```
┌─────────────────────────┐
│       FRENTE            │ ← Avança 19mm
│    (width - 2mm)        │ ← Move com corpo
└─────────────────────────┘
      │
      ├─ 7mm gap (corrediça esquerda)
      │
   ┌────┴────────────┐
   │ LATERAL ESQ     │
   │                 │
   │    ┌──────┐     │
   │    │ FUNDO│     │ ← Entre 5mm em todas
   │    └──────┘     │
   │                 │
   │ TRASEIRA        │ ← 10mm mais curta
   └─────────────────┘
      │
      └─ 7mm gap (corrediça direita)
```

### Validações Críticas

✅ **OBRIGATÓRIAS:**
- Frente maior que corpo (diferença exata: 12mm total)
- Todas as peças encostadas (sem gaps irreais)
- Fundo entre 5mm nas outras peças
- Traseira 10mm mais curta (fundo passa por baixo)
- Abertura individual (uma gaveta por vez)
- Todas as peças na BOM

❌ **PROIBIDO:**
- Frente flutuando (deve estar colada ao corpo)
- Peças atravessando paredes do box
- Abrir gaveta abre outras (bug eliminado)
- Peças faltando na lista de corte

## Arquitetura

```
src/core/drawers/
├── DrawerParametrics.ts          # Cálculos de dimensões
├── Drawer.ts                      # Modelo de gaveta
├── DrawerGroup.ts                 # Agrupamento de gavetas
├── DrawerGenerationService.ts    # Geração automática
├── DrawerMotionService.ts        # Movimento e animação
├── DrawerBomService.ts           # Extração de peças para BOM
├── adapters/
│   └── drawerGroupToLayerItems.ts # Conversão para layers
└── index.ts                       # Barrel export
```

## Conceitos Fundamentais

### Dimensões

#### Frente (maior - cobre a abertura)
- **Largura:** `larguraInterna - 2mm` (1mm folga cada lado)
- **Altura:** `alturaGaveta - 2mm` (1mm folga cada lado)
- **Espessura:** 19mm (padrão)
- **Posição:** +19mm para fora do box

#### Corpo (menor - espaço para corrediças)
- **Largura:** `larguraInterna - 14mm` (7mm cada lado)
- **Altura:** alturaGaveta
- **Profundidade:** conforme disponibilidade (250-600mm)

#### Diferença
- **Gap frontal:** 6mm de cada lado entre frente e laterais
- **Gap lateral:** 7mm de cada lado entre laterais e paredes (corrediças)

### Movimento

A frente e o corpo se movem **juntos** como uma unidade rígida:
```
frente.z = corpo.z + 19mm
```

## Uso

### 1. Gerar Gavetas para um Box

```typescript
import { generateDrawerGroup, drawerGroupToLayerItems } from '@/core/drawers';

const config = {
  boxWidth: 600,
  boxHeight: 800,
  boxDepth: 450,
  boxThickness: 19,
  boxId: 'box-123',
  drawerCount: 3,
  drawerType: 'normal',
  heightMode: 'equal',
  availableDepths: [250, 300, 350, 400, 450, 500],
};

const drawerGroup = generateDrawerGroup(config);
const layerItems = drawerGroupToLayerItems(drawerGroup);
```

### 2. Controlar Abertura

```typescript
import { setDrawerOpenInGroup } from '@/core/drawers';

// Abrir uma gaveta
const updatedGroup = setDrawerOpenInGroup(drawerGroup, 'drawer-id', true);

// Fechar todas
const closedGroup = closeAllDrawers(drawerGroup);
```

### 3. Extrair Peças para BOM

```typescript
import {
  extractDrawerGroupPiecesForBom,
  extractDrawerGroupHardwareForBom,
  summarizeDrawerPieces,
  summarizeDrawerHardware,
} from '@/core/drawers';

// Todas as peças de madeira
const pieces = extractDrawerGroupPiecesForBom(drawerGroup);
// pieces[0] = { pieceType: 'front', width: 598, height: 298, ... }

// Todas as ferragens
const hardware = extractDrawerGroupHardwareForBom(drawerGroup);
// hardware[0] = { hardwareType: 'slide', quantity: 2, ... }

// Resumo agregado
const summary = summarizeDrawerPieces(pieces);
const hwSummary = summarizeDrawerHardware(hardware);
```

### 4. Animar Gaveta


```typescript
import { createDrawerAnimation, updateDrawerProgress } from '@/core/drawers';

const drawer = drawerGroup.drawers[0];
const animation = createDrawerAnimation(drawer, true, 1500);

// Em um loop de animação:
const progress = /* calcular progresso 0-1 */;
const animatedDrawer = updateDrawerProgress(drawer, progress);
```

### 5. Alterar Distribuição de Alturas

```typescript
import { updateHeightMode } from '@/core/drawers';

// Modo igual
const equalGroup = updateHeightMode(drawerGroup, 'equal');

// Modo progressivo
const progressiveGroup = updateHeightMode(drawerGroup, 'top_small_mid_medium_bottom_large');

// Modo custom
const customGroup = updateHeightMode(drawerGroup, 'custom', [100, 200, 300]);
```

## Validações

### Validar Specs
```typescript
import { validateDrawerSpecs } from '@/core/drawers';

if (!validateDrawerSpecs(specs)) {
  console.error('Specs inválidas!');
}
```

### Validar Box
```typescript
import { canBoxHaveDrawers } from '@/core/drawers';

const validation = canBoxHaveDrawers(600, 800, 450, 3);
if (!validation.valid) {
  console.error(validation.reason);
}
```

## Integração com Layers

O adaptador converte entre o domínio e o sistema de layers:

```typescript
import { 
  drawerGroupToLayerItems,
  drawerToLayerItem,
  updateDrawerGroupFromLayerItems 
} from '@/core/drawers';

// Domain -> Layers
const layerItems = drawerGroupToLayerItems(drawerGroup);

// Layers -> Domain (update)
const updatedGroup = updateDrawerGroupFromLayerItems(drawerGroup, layerItems);
```

## Princípios de Design

### 1. Separação de Responsabilidades
- **Domínio:** lógica de negócio (cálculos, validações, estados)
- **Adaptadores:** conversão de formatos
- **Renderizadores:** visualização (BoxBuilder)

### 2. Imutabilidade
Todas as operações retornam novas instâncias (sem mutação):
```typescript
const newDrawer = setDrawerOpen(drawer, true); // não muta drawer original
```

### 3. Type Safety
Tipos fortemente tipados para prevenir erros:
```typescript
type DrawerType = "normal" | "pro";
type HeightMode = "equal" | "top_small_mid_medium_bottom_large" | "custom";
```

### 4. Validação Explícita
Validações retornam objetos com razões:
```typescript
{ valid: false, reason: "Altura insuficiente: 40mm por gaveta (mínimo 50mm)" }
```

## Testes

### Validar Dimensões
```typescript
const specs = calculateDrawerSpecs(dimensions, [300, 400, 500]);

// Deve validar:
assert(specs.front.width === 598); // 600 - 2
assert(specs.body.width === 586);  // 600 - 14
assert(specs.front.width - specs.body.width === 12); // 6mm cada lado
```

### Validar Movimento
```typescript
const drawer = createDrawer(...);
const opened = setDrawerOpen(drawer, true);

assert(opened.motion.isOpen === true);
assert(opened.motion.openProgress === 1);
assert(opened.motion.currentOffset === drawer.specs.positioning.pullDistance);
```

## Exemplos Completos

### Box de Cozinha (3 gavetas progressivas)
```typescript
const kitchenGroup = generateDrawerGroup({
  boxWidth: 600,
  boxHeight: 800,
  boxDepth: 500,
  boxThickness: 19,
  boxId: 'kitchen-box',
  drawerCount: 3,
  drawerType: 'normal',
  heightMode: 'top_small_mid_medium_bottom_large',
  availableDepths: [300, 400, 500],
});

// Alturas resultantes: ~160mm, ~240mm, ~320mm
```

### Gaveta Pro (alumínio)
```typescript
const proGroup = generateDrawerGroup({
  ...config,
  drawerType: 'pro',
});

// Laterais: 0mm (alumínio)
// Fundo: 0mm (alumínio)
```

## Migração

### Antes (boxLayersService)
```typescript
// Cálculos misturados com geração de layers
const drawerWidth = boxWidth - 2 * thickness - 2 * sideGap;
const specs = { width: drawerWidth, ... };
```

### Depois (domínio)
```typescript
// Domínio puro
const group = generateDrawerGroup(config);

// Adaptador
const layerItems = drawerGroupToLayerItems(group);
```

## Vantagens

✅ **Testabilidade:** Lógica isolada e testável  
✅ **Reutilização:** Pode ser usado em múltiplos contextos  
✅ **Manutenibilidade:** Mudanças isoladas no domínio  
✅ **Type Safety:** Tipos fortes previnem erros  
✅ **Documentação:** Código autodocumentado  

## Referências

- [DrawerParametrics.ts](./DrawerParametrics.ts) - Fórmulas e cálculos
- [Drawer.ts](./Drawer.ts) - Modelo e operações
- [DrawerGroup.ts](./DrawerGroup.ts) - Agrupamento
- [DrawerGenerationService.ts](./DrawerGenerationService.ts) - Geração
- [DrawerMotionService.ts](./DrawerMotionService.ts) - Animação

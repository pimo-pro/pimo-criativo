# Novidades do Sistema

### Release — Sistema de Gavetas Industrial (Diff 1 + Diff 2 + Diff 3) · modelo gavita 8
Publicação completa das correções industriais das gavetas, validadas contra o módulo de referência gavita 8 (600×800×500, 3 gavetas).

**Diff 1 — Corrediças Y (pitch dinâmico)**
- `Y(0) = 41` · `Y(i) = 41 + i·(H/n) − T` (modo `pitch_H_sobre_n`)
- Confirmação gavita 8: **41 / 288,67 / 555,33**
- X das corrediças, NL e profundidade intocados

**Diff 2 — Corpo industrial**
- Laterais = frente − delta (85,5 lowest/single · 68,5 middle/highest)
- Costa = lateral − 23
- Elevação corpo unificada: **48 mm**
- Confirmação: laterais **177,17 / 196,17 / 196,17** · costas **154,17 / 173,17 / 173,17**

**Diff 3 — Stack das frentes (equal_quase)**
- B0 = 0 · gap = 4 · ajuste 1.ª frente = −2 mm
- `hEqual = (distributable − ajuste) / n` · modo `"equal"` usa equal_quase internamente
- Confirmação frentes: **262,67 / 264,67 / 264,67**

**Validação**
- Suite industrial gavetas/corpo/frente/corrediças: **97/97 OK**
- Sem impacto em NL, profundidade, X das corrediças, portas, DIV ou PI

### Release — P3.25 · Correção de preço no Relatório Final
- Relatório Final sincronizado com o Financeiro ADMIN (`computeFinanceiroUnificado`)
- Sem recalculo interno (qty×preço, IVA/total locais, fallbacks de chapas/Painéis/ferragens)
- Painéis = paineis + chapasReais (sem duplicação); Subtotal/IVA/Total = ADMIN

### Release — P3.24 · Correção do módulo Adicionar Chapa + preço dinâmico
- Modal «Adicionar chapa» com z-index e backdrop opaco correctos; selecção liga ao state
- Chapa adicionada aparece de imediato em Painéis (espelho em chapasReais, sem double-count)
- Preço dinâmico €/m e parcial recalculados ao alterar comprimento, largura ou €/m²

### Release — P3.23 · Correções finais da UI do Financeiro
- Correção de caracteres corrompidos (Painéis ▸, Portas ▸, Gavetas ▸)
- Remoção de «Prego para Costa» e de nomes de peças do caixa (CIMA/LADO/FRENTE/COSTA)
- Accordions fechados por defeito; sem duplicações; totais alinhados ao Financeiro Unificado (ADMIN)

### Release — P3.22 · Restauração completa da lógica original do Financeiro
- Relatório Final: fluxo original restaurado — state → financeiroAdapter → financeiroIndustrialRules → financeiroTotals → UI
- Página «Financeiro (custos dinâmicos)» com blocos, detalhes e painéis originais (accordions abertos, chapas editáveis)
- Unificado permanece SSOT dos totais oficiais; não constrói a UI detalhada
- Sem merge com Relatório simplificado P3.17–P3.20; sem esconder nem colapsar blocos

### Release — P3.21 · Restauração completa da página Financeiro
- Relatório Final: página «Financeiro (custos dinâmicos)» restaurada ao fluxo pré-P3.17
- Seed/merge antigo com chapas e orla; UI completa com todos os blocos e detalhes editáveis
- Sem live-overwrite P3.17; sem simplificação P3.18; sem bloco Painéis separado P3.19
- SSOT de cálculo permanece o Financeiro Unificado (não existem financeiroAdapter / financeiroIndustrialRules / financeiroTotals)

### Release — P3.20 · Restauração completa da UI do Financeiro (custos dinâmicos)
- Relatório Final: bloco «Financeiro (custos dinâmicos)» restaurado ao layout pré-P3.18
- Todos os blocos visíveis com accordions e detalhes (Painéis/Adicionar chapa, Portas, Gavetas, Ferragens, Orla, Remates, Ops, Desperdício, Serragem, MO, Logística, Ops avançadas, ADM, Montagem, Portes, IVA, Total)
- Sem alteração de pipelines industriais nem do Financeiro Unificado; Painéis dedicado mantém-se

### Release — P3.17 a P3.19 · Financeiro Unificado + Painéis Restaurados
Publicação completa das fases:
- P3.17 — Relatório Final live e alinhado ao Financeiro
- P3.18 — UI do Relatório Final reorganizada e sem duplicações
- P3.19 — Correções de UI no Financeiro ADMIN + Painéis editáveis
Sistema de preços totalmente alinhado, sem reprecificação, sem duplicações, com Painéis restaurado e Financeiro limpo.

### Release — P3.19 · Correções de UI (Financeiro + Painéis)
- Financeiro ADMIN: removido «€/chapa derivado»; Painéis mostra o custo total das chapas (sem duplicar Chapas reais)
- Relatório Final: bloco Painéis restaurado (chapas reais editáveis — nomes, medidas, €/m², totais)
- Totais oficiais continuam live do Financeiro Unificado (sem reprecificar pipelines industriais)

### Release — P3.17 + P3.18 · Preços alinhados + UI do Relatório Final
- P3.17 — Relatório Final espelha o Financeiro Unificado (ADMIN) em modo live: mesmos totais/IVA, sem reprecificação por chapas, sem sticky de preços
- P3.18 — Melhorias de interface: Financeiro no final com Total destacado, Subtotal/IVA/Total sem duplicação, detalhe de custos colapsado, painel com contagens úteis (sem tempo)
- Sem alteração de pipelines industriais nem fórmulas de preço do Unificado

### Release — P3.11 a P3.15 · Sistema de gaveteiro totalmente certificado
Publicação completa das fases:
- P3.11 — Independência total das prateleiras
- P3.12 — Correções industriais do gaveteiro
- P3.13 — SSOT gav_fundo
- P3.14 — Certificação industrial completa (42/42 testes)
- P3.15 — Meta XML completa, documentação alinhada, legado isolado
Sistema industrial do gaveteiro certificado e pronto para produção.

### Release — Independência das prateleiras + Correções industriais do gaveteiro
- P3.11 — Independência total das prateleiras (planos full/short, migração dinâmica, furação autónoma)
- P3.12 — Correções industriais do gaveteiro (orientação XML, cavilhas, coerência estrutural)
- P3.13 — SSOT gav_fundo (dimensões dinâmicas, offsets industriais, compatibilidade trilho)
- Validação total: prateleiras, gavetas, trilhos, XML, cutlist, técnico, 3D

### Correções industriais completas do gaveteiro — orientação, furação e dimensões dinâmicas
- Orientação XML da GAV_FRENTE_EXT_01 com datum base-esquerda (BL) e face tras
- Cavilhas de aresta restauradas em GAV_LAT_DIR_01 / GAV_LAT_ESQ_01 (Y=15)
- Corpos idênticos no stack equal; frente com folga ±2 mm; lowest/highest com cobertura base/topo
- Dimensões dinâmicas conforme caixa e trilho
- Furação de corrediças no LAT do módulo alinhada à posição da gaveta (setback 38, espelho L/R)
- Validação industrial P3.13 completa

### Correções industriais do gaveteiro — orientação, furação e coerência
- Orientação correcta de GAV_FRENTE_EXT_01 no XML (padrão alinhado a 02/03)
- Furos de cavilha de aresta restaurados em GAV_LAT_DIR_01 e GAV_LAT_ESQ_01
- Coerência estrutural: corpo idêntico em todas as gavetas (furação lateral 15 / H−35)
- Rasgo do fundo uniforme: elev + sideH − 13 (22 mm à cavilha superior)
- Validação de ligação corpo↔frente e produção CNC/DRILL

### Independência total das prateleiras — full/short dinâmico + furação autónoma
- Separação completa do comportamento das prateleiras face à geometria DIV/SEP
- Planos full/short dinâmicos conforme a área disponível
- Furação autónoma baseada apenas na direcção e na grelha
- Margens superiores/inferiores, grelha contínua ou segmentada, passo 32/64 mm
- Migração dinâmica sem mover SEP ou DIV
- Validação completa (74/74 testes)
- Comportamento final: prateleiras independentes, DIV/SEP fixos, furação correcta em todas as direcções

### Expansão Prateleiras DIV/SEP — Direção dinâmica + grelha segmentada + margens
- Direção configurável: Direita, Esquerda, Superior, Inferior (visível conforme DIV/SEP)
- Passo de grelha 32 mm (padrão) ou 64 mm (dobro)
- Grelha contínua ou segmentada (blocos 4–8 centrados no LAT)
- Margem superior/inferior com centragem automática da grelha
- Migração dinâmica com SEP parcial (furos + prateleiras + LAT)
- Integração total: 3D · cutlist · furação industrial
- Validação: 44 testes núcleo + integração cutlist/phaseG/drillingAdapter

### Quadro V6 — Furos Intermédios Industriais
- Regra: distância real do intermédio à face = **38 + b1(NL)** (frente e traseira espelhadas)
- Padrão por lado: `X1=38` · `X_mid_F=38+b1` · `X_mid_R=D−(38+b1)` · `X_last=D−38`
- Lookup SSOT `hettichQuadroV6B1Config.ts`: NL **250–500** com b1 oficial
- NL **550/600**: sem b1 confirmado → fallback proporcional (4/5) + TODO (não inventar valores)
- Removido o setback incorrecto `38+b1−1`; nunca usar b1 sozinho como distância
- Y=41 mm e espelhamento L/R mantidos; Adapter/Service intactos
- Alinhamento SSOT completo: Viewer / cutlist / DRILL / TCN / HXML
- **Versão estável de referência:** `v6.0805.1648`

### Folga vertical DIV ↔ SEP (mín. 5 mm)
- `DIV_SEP_VERTICAL_CLEARANCE_MM = 5`
- Altura DIV ligado: `floor(SEP.bottomY − T − 5)`
- NP26389 (T=19, pos=1519) → DIV **1504**, gap **5,5 mm**, furos LAT **1519** (centro do SEP)
- Viewer / cutlist / DRILL / TCN / HXML herdando a mesma altura SSOT

### gav_fundo — eixos industriais corrigidos
- Largura = vão entre laterais + 10 + 10 (encaixe nas laterais)
- Profundidade = sideDepth + 10 + T_costa (sideDepth = bodyDepth − 10)
- Caso 550×500 (T=19, laterais/costa 16) → **486 × 466 mm**
- Cutlist / Viewer / DRILL / TCN / HXML herdam as mesmas dimensões SSOT

### Furos SEP alinhados ao Viewer e ao DIV
- Y nas laterais: `absoluteY − T` (mesma convenção das prateleiras)
- Caso H=720 / T=19 / pos=600 → SEP 619 mm, Y LAT 600 mm, delta Viewer 0 mm
- DIV ligado: altura com folga vertical mínima de 5 mm sob o SEP
- Cutlist / DRILL / TCN / HXML partilham o mesmo `hole.y`

### Rasgo inferior da frente da gaveta (TypeNo=3)
- Width do rasgo: 13 → **11 mm** (fundo 10 mm, folga 1 mm)
- Depth permanece 11 mm; centro do rasgo (`BeginY`) inalterado
- IDs canónicos e pipeline CNC/TCN/cutlist/PI preservados

### Seleção de materiais alinhada ao SSOT
- Famílias com Nome novo padronizado (MDF Branco, HDF LACADO, etc.) — sem números no nome
- Espessuras escolhidas em campo próprio (10 / 16 / 17 / 19 mm…)
- Miniatura com textura real (`/textures/mdf/…`, `/textures/wood/…`) ou cor HEX
- Gestão de Materiais: cartas por família + upload de textura para o 3D
- IDs industriais canónicos preservados (CNC / nesting / TCN / cutlist / PI)

### Fase 5 — Chapas Reais (activação controlada)
- €/chapa derivado de €/m² × área da chapa (sem tarifa manual nova)
- Nesting estimado → Chapas reais = 0 € + avisos no Unificado
- Labels dinâmicos (N × €/chapa; Painéis substituídos)
- Default global permanece «Por peça»; activação só em Admin → Orçamentos
- Procedimento documentado na Ajuda (Orçamentos → Custos Industriais)

### Plano industrial/financeiro concluído
- Painéis SSOT (carcaça + portas de módulo + madeira de gavetas)
- Gavetas = montagem configurável (default 15 €)
- Ferragens estabilizadas (corrediças + dobradiças)
- Chapas reais = métrica industrial (sem monetização no default)
- Portas de módulo sem preço separado (linha Portas reservada a divisão)

### Atualização Industrial — Correções DRILL
- Furos Ø4 substituídos por Ø5
- Z centrado na espessura (T/2)
- Laterais de módulo alinhadas ao XML golden
- Gavetas protegidas (sem alterações)
- Sistema DRILL/Export totalmente estabilizado

### Atualizacao - Layout de Corte PRO
- Nome completo das pecas agora segue o padrao da etiqueta (Projeto_Caixa_Peca).
- Miniatura das pecas redesenhada em landscape, sem bordas.
- Colunas redistribuidas para melhor uso da largura da pagina.
- Altura das linhas ajustada para maior clareza visual.
- Preparacao para o novo modulo Layout de Corte manual.

### Nova funcionalidade - Layout de Corte manual
- PDF unico para todas as chapas.
- Furos com cores e tamanhos reais (cavilha, prateleira, fixacao, passante).
- Cotas inteligentes (borda -> primeiro, ultimo -> borda, espacamento unico).
- Rasgos/fresagens exibidos com profundidade e posicao.
- Botao dedicado em Gerar arquivo.
- Incluido em Gerar arquivo completo.

### Hotfix - Cotagem de trilho (Layout de Corte manual)
- Novo tipo trilho.
- Cotas externas: 38 / 204 / 41 mm.
- Sem repeticao.
- Trilho superior e inferior como sistemas independentes.
- Escala ajustada para leitura clara.

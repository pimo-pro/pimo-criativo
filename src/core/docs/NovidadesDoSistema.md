# Novidades do Sistema

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

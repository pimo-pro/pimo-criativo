# Política de Segurança

## Como reportar uma vulnerabilidade

Se identificar uma vulnerabilidade de segurança:

1. **Não** abra uma issue pública com detalhes sensíveis.
2. Use o mecanismo de **Private vulnerability reporting** do GitHub (Security Advisory), quando disponível.
3. Se não for possível usar o canal privado, abra uma issue pública apenas com descrição mínima e sem prova de exploração.

## O que incluir no reporte

- Componente afetado (ficheiro, módulo, rota ou workflow)
- Impacto potencial
- Passos de reprodução
- Proposta de mitigação (se existir)

## Processo de resposta

A equipa de manutenção irá:

1. Confirmar receção do reporte.
2. Avaliar severidade e impacto.
3. Preparar correção e validação.
4. Publicar patch e notas relevantes quando apropriado.

## Boas práticas para contribuidores

- Nunca commitar segredos (`.env`, tokens, chaves privadas).
- Rever alterações em workflows CI/CD e scripts de deploy.
- Evitar logs com dados sensíveis.

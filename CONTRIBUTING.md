# Contribuir para o PIMO Criativo

Obrigado por considerar contribuir para este projeto.

## Antes de começar

1. Leia o `README.md` para entender o contexto funcional e técnico.
2. Verifique documentação em `docs/` para decisões arquiteturais relevantes.
3. Crie sempre uma branch de trabalho a partir da branch principal.

## Fluxo recomendado

1. **Fork/branch**
   - Use nomes claros para branches (ex.: `feat/nome-curto`, `fix/nome-curto`).
2. **Implementação**
   - Mantenha mudanças focadas e pequenas.
   - Evite misturar refactors sem relação com a tarefa.
3. **Validação local**
   - `npm ci`
   - `npm run build`
   - `npm run test`
   - `npm run lint` (quando aplicável)
4. **Pull Request**
   - Preencha o template de PR.
   - Descreva impacto funcional e técnico.
   - Anexe evidências visuais quando a alteração tiver impacto na UI.

## Convenções gerais

- Linguagem principal do domínio: português.
- Medidas de domínio: milímetros (quando aplicável ao modelo).
- Não introduzir segredos em código, commits ou screenshots.
- Preserve compatibilidade com fluxos existentes (design, industrial e administração).

## Qualidade de código

- Prefira alterações incrementais e testáveis.
- Escreva testes para comportamentos novos ou regressões.
- Evite duplicação de lógica em módulos críticos.

## Reportar dúvidas

Se uma decisão arquitetural não estiver clara, abra uma issue antes de implementar alterações extensas.

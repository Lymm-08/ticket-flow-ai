# Decisões técnicas

## Banco SQL Server

O banco relacional representa chamados, categorias e mudanças de status com constraints e chaves estrangeiras. SQL Server foi escolhido por alinhar-se às integrações corporativas e ao perfil da vaga. O Compose usa a edição Developer para desenvolvimento; ela não é uma licença de produção.

## Mock como padrão

`CLASSIFIER_MODE=mock` evita exigir chave externa, custo ou conectividade para subir o sistema. Regras de palavras-chave determinísticas tornam a demonstração e os testes repetíveis. O modo Anthropic é opt-in e valida a resposta antes de gravá-la; timeout, rede, rate limit e respostas inválidas têm tratamento explícito.

## Deduplicação por hash

O robô remove espaços excedentes antes de calcular SHA-256. Esse hash está protegido por uma constraint única no banco, além da verificação prévia do robô. A constraint é a garantia final contra inserções simultâneas do mesmo conteúdo.

## Limite transacional

Cada chamado é persistido em uma transação própria, juntamente com seu registro de status inicial. Falhas são registradas nos logs da execução e o processamento segue para o próximo item. A entrega de alerta ocorre após a persistência para não perder o chamado caso o webhook falhe.

## API e interface

A API separa rotas, controllers, serviços e repositório. Valores de filtros e IDs são enviados por parâmetros SQL; apenas colunas e direções de ordenação são escolhidas de listas permitidas. O painel usa recursos nativos do navegador e compartilha o servidor da API, reduzindo etapas de build.

## Alerta conhecido na cadeia npm

Na versão das dependências verificada, `npm audit --omit=dev` reporta GHSA-hp3w-g68c-fv3c para `sprintf-js` (via `mssql` → `tedious`). O advisory marca `sprintf-js` até `1.1.3` como afetado, e `1.1.3` é a versão publicada consultada. A correção sugerida pelo npm rebaixa `mssql` para `4.2.0`, uma mudança principal incompatível. Não foi aplicado downgrade nem override que apenas escondesse o alerta. O Jest foi atualizado para a versão 30 para remover os alertas altos da árvore de desenvolvimento; permanecem alertas moderados transitivos no audit completo. O projeto deve atualizar as cadeias afetadas quando houver releases corrigidas compatíveis.

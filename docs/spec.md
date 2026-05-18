# StockBridge — Spec v0.1

## Resumo
Sistema single-tenant de gestão de estoque para operação de campo. 1 depósito central + 6 caminhões. Painel admin desktop para o gestor, PWA offline-first para motoristas.

## Atores
- **Admin**: configura artigos, locations, usuários. Vê tudo. Aprova ajustes.
- **Manager**: opera o depósito. Recebe entradas, despacha transferências.
- **Driver**: opera o caminhão. Consome itens em campo, recebe transferências, faz inventário.

## Casos de uso principais
1. Admin cadastra artigo (SKU, barcode, foto, ponto de reposição).
2. Manager registra entrada nova no depósito.
3. Manager cria transferência depósito → caminhão.
4. Driver recebe transferência no caminhão.
5. Driver consome item em campo (scan barcode, confirma quantidade).
6. Driver ajusta inventário com motivo + foto quando físico diverge.
7. Admin visualiza dashboard com saídas do dia, saldo por caminhão, alertas.
8. Admin filtra movimentações por data, location, user, artigo.
9. Admin exporta relatório CSV.

## Painel admin — telas mínimas v1
- Dashboard (saídas hoje, alertas, saldo resumido por location)
- Movimentações (tabela filtrável + export)
- Artigos (CRUD + import CSV)
- Locations (lista das 7, edição de atribuição)
- Caminhões (card por caminhão com motorista, saldo total, top 10 SKUs)
- Transferências (criar, acompanhar, conferir)
- Usuários (CRUD, atribuição de truck)
- Audit log (auditoria de tudo)

## PWA driver — telas mínimas v1
- Home (location atual, resumo)
- Scan & saída (consumption)
- Receber transferência
- Ajuste com foto
- Inventário cíclico
- Histórico do dia

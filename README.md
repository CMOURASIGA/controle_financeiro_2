📊 Financial Control Panel

Sistema de controle financeiro integrado ao Google Sheets, com frontend React (Vite + Tailwind) rodando dentro de um Google Apps Script Web App.

📌 Visão Geral

Este projeto permite registrar, consultar e visualizar transações financeiras utilizando uma interface moderna em React, enquanto o backend utiliza Google Apps Script para manipular dados em uma planilha Google Sheets.

A solução é ideal para quem quer:

Um sistema financeiro rápido e leve

Interface moderna, responsiva e fácil de usar

Armazenamento seguro e sem custo, usando Google Sheets como banco

Nenhum servidor externo (Render opcional)

Deploy via Web App (Google Apps Script)

🚀 Tecnologias Utilizadas
Frontend

React 19

Vite

TypeScript

TailwindCSS

Recharts (gráficos)

Google Apps Script Client API (google.script.run)

Backend

Google Apps Script

Google Sheets como banco de dados

🗂 Estrutura da Planilha Google

A planilha possui duas abas principais:

1. transacoes
Coluna	Nome	Descrição
A	id	ID único incremental
B	data	Data da transação
C	tipo	RECEITA ou DESPESA
D	categoria	Categoria da transação
E	descricao	Texto livre
F	valor	Valor numérico
G	status	PAGO ou PENDENTE
H	mes_ref	(opcional) Preenchido automaticamente
2. config
Coluna	Conteúdo
A	categorias_receita
B	categorias_despesa

Exemplo de conteúdo:

Salário              | Aluguel  
Freelancer           | Mercado  
Outros               | Assinaturas  
                     | Lazer  
                     | Outros  

🧠 Como funciona
1. Frontend

O frontend é construído com Vite e depois incorporado ao Apps Script via HtmlService.

Principais componentes:

Dashboard com resumo financeiro

Gráficos (pie, bar)

Tabela de transações

Formulário de cadastro

Seleção de mês

Integração assíncrona com backend via google.script.run

2. Backend – Google Apps Script

Funções principais expostas ao frontend:

Função	Descrição
getTransactionsByMonth(mes)	Retorna as transações filtradas pela coluna data (não dependemos de mes_ref)
getMonthlySummary(mes)	Calcula totais de receita, despesas e saldos
getCategories()	Carrega categorias da aba config
saveTransaction(tx)	Salva nova transação na aba transacoes

O backend foi otimizado para:

Tratar datas corretamente

Filtrar por intervalo de data (mês inteiro)

Logar execuções para depuração

Preencher automaticamente mes_ref com yyyy-MM

🔧 Estrutura de Arquivos (Frontend)
src/
 ├── components/
 │     ├── Header.tsx
 │     ├── SummaryCards.tsx
 │     ├── TransactionsTable.tsx
 │     ├── TransactionForm.tsx
 │     ├── Charts.tsx
 ├── services/
 │     └── googleScriptService.ts
 ├── types/
 │     └── index.ts
 ├── App.tsx
 ├── main.tsx

🌐 Deploy
Backend

Abrir Google Sheets → Extensões → Apps Script

Criar arquivos:

Código.gs (backend completo)

Index.html (bundle do React incorporado)

Publicar:

Deploy → Nova implantação → Aplicativo da Web

Executar como: você mesmo

Acesso: qualquer pessoa com o link

Frontend passa a rodar na própria URL do Web App.

💻 Desenvolvimento Local
Instalar dependências
npm install

Rodar local
npm run dev

Gerar build para Apps Script
npm run build


Esse build gera os arquivos em dist/ que serão copiados para dentro do Index.html no Apps Script.

🧪 Testes internos no Apps Script

Funções auxiliares incluídas para depuração:

testGetTransactions()
testGetSummary()
testGetCategories()


Elas escrevem logs no painel de execução e facilitam detectar problemas no backend.

📱 Interface

A interface é totalmente responsiva:

Layout desktop com cards, gráficos e tabela lado a lado

Layout mobile com componentes empilhados

Tailwind garante consistência visual em todos os dispositivos

📦 Status Atual do Projeto

✔ Backend concluído
✔ Frontend funcionando perfeitamente no Web App
✔ Filtro por data funcionando
✔ Resumo financeiro validado
✔ Categorias dinâmicas funcionando
✔ Logs ativados para depuração

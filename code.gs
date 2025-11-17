/***********************************************************************************
 * BACKEND – CONTROLE FINANCEIRO WEBAPP
 * Planilha: Controle Financeiro WebApp
 * Abas:
 *   - transacoes: id, data, tipo, categoria, descricao, valor, status, mes_ref
 *   - config: categorias_receita (col A), categorias_despesa (col B)
 ***********************************************************************************/

/**
 * CONFIGURAÇÕES GERAIS
 */
const SPREADSHEET_ID = '1i8DEPlvMDRbuRcWcVc3D5QmQVXuoOgywDan2ohtdSNw';
const SHEET_TRANSACOES = 'transacoes';
const SHEET_CONFIG = 'config';

// Índices de coluna (1-based para Apps Script)
const COL_ID      = 1; // A
const COL_DATA    = 2; // B
const COL_TIPO    = 3; // C
const COL_CATEG   = 4; // D
const COL_DESC    = 5; // E
const COL_VALOR   = 6; // F
const COL_STATUS  = 7; // G
const COL_MES_REF = 8; // H

function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('Controle Financeiro WebApp')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet_(name) {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName(name);
  if (!sh) {
    throw new Error('Aba "' + name + '" não encontrada.');
  }
  return sh;
}

/**
 * Helpers de resposta (ServerResponse<T> do frontend)
 */
function buildSuccessResponse_(data, extra) {
  const resp = { success: true };
  if (data !== undefined) resp.data = data;
  if (extra) {
    Object.keys(extra).forEach(k => resp[k] = extra[k]);
  }
  return resp;
}

function buildErrorResponse_(message) {
  return {
    success: false,
    error: message || 'Erro inesperado no servidor.'
  };
}

/**
 * Opcional: inicializar cabeçalhos
 * (Use apenas se a aba estiver vazia – no seu caso já está ok.)
 */
function initializeSheet() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(SHEET_TRANSACOES);
  if (!sh) {
    sh = ss.insertSheet(SHEET_TRANSACOES);
  }

  const header = [
    'id',
    'data',
    'tipo',
    'categoria',
    'descricao',
    'valor',
    'status',
    'mes_ref'
  ];

  const firstRow = sh.getRange(1, 1, 1, header.length).getValues()[0];
  const isEmpty = firstRow.every(v => v === '');
  if (isEmpty) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  }

  let config = ss.getSheetByName(SHEET_CONFIG);
  if (!config) {
    config = ss.insertSheet(SHEET_CONFIG);
    config.getRange(1, 1, 1, 2).setValues([['categorias_receita', 'categorias_despesa']]);
  }

  return buildSuccessResponse_(null);
}

/**
 * 1. Buscar transações por mês (getTransactionsByMonth no frontend)
 *    mesRef vem no formato "YYYY-MM"
 */
function getTransactionsByMonth(mesRef) {
  Logger.log('-------------------------------');
  Logger.log('getTransactionsByMonth chamado');
  Logger.log('mesRef recebido: %s', mesRef);

  try {
    const rangeInfo = getMonthRangeFromMesRef_(mesRef);
    if (!rangeInfo) {
      throw new Error('mesRef inválido: ' + mesRef);
    }

    const sh = getSheet_(SHEET_TRANSACOES);
    Logger.log('Aba usada: %s', sh.getName());

    const lastRow = sh.getLastRow();
    Logger.log('Última linha da aba: %s', lastRow);

    if (lastRow < 2) {
      Logger.log('Não há linhas de dados (apenas cabeçalho ou vazio).');
      const respVazio = buildSuccessResponse_([], { header: [] });
      Logger.log('Resposta (vazio): %s', JSON.stringify(respVazio));
      return respVazio;
    }

    const range = sh.getRange(1, 1, lastRow, COL_MES_REF);
    const values = range.getValues();

    const header = values[0];
    const dataRows = values.slice(1);

    Logger.log('Cabeçalho: %s', JSON.stringify(header));
    Logger.log('Qtd de linhas de dados: %s', dataRows.length);

    const transactions = [];

    dataRows.forEach((row, idx) => {
      const excelRow = idx + 2; // linha real na planilha
      const id = row[COL_ID - 1];
      const rawDate = row[COL_DATA - 1];

      if (!id || !rawDate) {
        Logger.log('Linha %s ignorada (sem id ou data).', excelRow);
        return;
      }

      const inRange = dateInRange_(rawDate, rangeInfo.start, rangeInfo.end);
      Logger.log(
        'Linha %s -> id: %s, data: %s, inRange: %s',
        excelRow,
        id,
        rawDate,
        inRange
      );

      if (!inRange) return;

      // Formata a data para yyyy-MM-dd
      let dataStr = '';
      if (rawDate instanceof Date) {
        dataStr = Utilities.formatDate(
          rawDate,
          Session.getScriptTimeZone(),
          'yyyy-MM-dd'
        );
      } else {
        const d = new Date(rawDate);
        dataStr = isNaN(d.getTime())
          ? String(rawDate)
          : Utilities.formatDate(
              d,
              Session.getScriptTimeZone(),
              'yyyy-MM-dd'
            );
      }

      // mesRef que o front vai enxergar
      const mesRefNormalized =
        Utilities.formatDate(
          new Date(rangeInfo.start),
          Session.getScriptTimeZone(),
          'yyyy-MM'
        );

      const tx = {
        id: Number(row[COL_ID - 1]),
        data: dataStr,
        tipo: String(row[COL_TIPO - 1] || ''),
        categoria: String(row[COL_CATEG - 1] || ''),
        descricao: String(row[COL_DESC - 1] || ''),
        valor: Number(row[COL_VALOR - 1] || 0),
        status: String(row[COL_STATUS - 1] || ''),
        mesRef: mesRefNormalized
      };

      Logger.log('Transação adicionada: %s', JSON.stringify(tx));
      transactions.push(tx);
    });

    const resp = buildSuccessResponse_(transactions, { header: header });
    Logger.log(
      'Resposta final getTransactionsByMonth: %s',
      JSON.stringify(resp)
    );
    return resp;
  } catch (e) {
    Logger.log('ERRO em getTransactionsByMonth: %s', e.stack || e.message);
    return buildErrorResponse_(e.message);
  }
}


function testGetTransactions() {
  const mesRef = '2025-11'; // você pode mudar aqui se quiser testar outro mês
  const resp = getTransactionsByMonth(mesRef);
  Logger.log('Resultado testGetTransactions: %s', JSON.stringify(resp));
}

/**
 * 2. Resumo mensal (getMonthlySummary no frontend)
 */
function getMonthlySummary(mesRef) {
  Logger.log('-------------------------------');
  Logger.log('getMonthlySummary chamado');
  Logger.log('mesRef recebido: %s', mesRef);

  try {
    const rangeInfo = getMonthRangeFromMesRef_(mesRef);
    if (!rangeInfo) {
      throw new Error('mesRef inválido: ' + mesRef);
    }

    const sh = getSheet_(SHEET_TRANSACOES);
    Logger.log('Aba usada: %s', sh.getName());

    const lastRow = sh.getLastRow();
    Logger.log('Última linha da aba: %s', lastRow);

    if (lastRow < 2) {
      Logger.log('Sem dados, devolvendo resumo zerado.');
      const emptySummary = {
        receitaTotal: 0,
        despesaPaga: 0,
        despesaPendente: 0,
        saldoPrevisto: 0,
        saldoRealizado: 0
      };
      return {
        success: true,
        resumo: emptySummary
      };
    }

    const range = sh.getRange(2, 1, lastRow - 1, COL_MES_REF);
    const values = range.getValues();

    Logger.log('Qtd de linhas de dados (summary): %s', values.length);

    let receitaTotal = 0;
    let despesaPaga = 0;
    let despesaPendente = 0;

    values.forEach((row, idx) => {
      const excelRow = idx + 2; // linha real
      const rawDate = row[COL_DATA - 1];
      const tipo = String(row[COL_TIPO - 1] || '');
      const valor = Number(row[COL_VALOR - 1] || 0);
      const status = String(row[COL_STATUS - 1] || '');

      const inRange = dateInRange_(rawDate, rangeInfo.start, rangeInfo.end);

      Logger.log(
        'Resumo - linha %s -> data: %s, tipo: %s, valor: %s, status: %s, inRange: %s',
        excelRow,
        rawDate,
        tipo,
        valor,
        status,
        inRange
      );

      if (!inRange) return;
      if (!valor) return;

      if (tipo === 'RECEITA') {
        receitaTotal += valor;
      } else if (tipo === 'DESPESA') {
        if (status === 'PAGO') {
          despesaPaga += valor;
        } else if (status === 'PENDENTE') {
          despesaPendente += valor;
        }
      }
    });

    const saldoPrevisto = receitaTotal - (despesaPaga + despesaPendente);
    const saldoRealizado = receitaTotal - despesaPaga;

    const summary = {
      receitaTotal: receitaTotal,
      despesaPaga: despesaPaga,
      despesaPendente: despesaPendente,
      saldoPrevisto: saldoPrevisto,
      saldoRealizado: saldoRealizado
    };

    Logger.log('Resumo calculado: %s', JSON.stringify(summary));

    // IMPORTANTE: aqui o front espera exatamente { success, resumo }
    return {
      success: true,
      resumo: summary
    };

  } catch (e) {
    Logger.log('ERRO em getMonthlySummary: %s', e.stack || e.message);
    return buildErrorResponse_(e.message);
  }
}


/**
 * 3. Categorias (getCategories no frontend)
 */
function getCategories() {
  Logger.log('-------------------------------');
  Logger.log('getCategories chamado');

  try {
    const sh = getSheet_(SHEET_CONFIG);
    Logger.log('Aba usada: %s', sh.getName());

    const lastRow = sh.getLastRow();
    Logger.log('Última linha da aba config: %s', lastRow);

    if (lastRow < 2) {
      Logger.log('Sem categorias, devolvendo listas vazias.');
      return {
        success: true,
        receitas: [],
        despesas: []
      };
    }

    const range = sh.getRange(2, 1, lastRow - 1, 2); // col A e B
    const values = range.getValues();

    Logger.log('Qtd linhas lidas em config: %s', values.length);

    const receitas = [];
    const despesas = [];

    values.forEach((row, idx) => {
      const rec = String(row[0] || '').trim();
      const desp = String(row[1] || '').trim();
      Logger.log(
        'Linha config %s -> receita: "%s", despesa: "%s"',
        idx + 2,
        rec,
        desp
      );
      if (rec) receitas.push(rec);
      if (desp) despesas.push(desp);
    });

    Logger.log(
      'Categorias montadas -> receitas: %s | despesas: %s',
      JSON.stringify(receitas),
      JSON.stringify(despesas)
    );

    return {
      success: true,
      receitas: receitas,
      despesas: despesas
    };
  } catch (e) {
    Logger.log('ERRO em getCategories: %s', e.stack || e.message);
    return buildErrorResponse_(e.message);
  }
}


/**
 * 4. Salvar transação (saveTransaction no frontend)
 *    tx: { data, tipo, categoria, descricao, valor, status, mesRef }
 */
function saveTransaction(tx) {
  try {
    if (!tx) {
      return {
        success: false,
        error: 'Objeto de transação não enviado.'
      };
    }

    const sh = getSheet_(SHEET_TRANSACOES);
    const lastRow = sh.getLastRow();

    // Garante cabeçalho se a aba estiver vazia
    if (lastRow === 0) {
      sh.getRange(1, 1, 1, 8).setValues([[
        'id', 'data', 'tipo', 'categoria', 'descricao', 'valor', 'status', 'mes_ref'
      ]]);
    }

    const lastDataRow = sh.getLastRow();
    let nextId = 1;
    if (lastDataRow >= 2) {
      const lastId = sh.getRange(lastDataRow, COL_ID).getValue();
      nextId = Number(lastId || 0) + 1;
    }

    // data: se vier string "2025-11-14", converte para Date
    const dataCell = tx.data
      ? new Date(tx.data)
      : new Date();

    const row = [
      nextId,
      dataCell,
      tx.tipo || '',
      tx.categoria || '',
      tx.descricao || '',
      Number(tx.valor || 0),
      tx.status || '',
      tx.mesRef || ''
    ];

    sh.appendRow(row);

    return {
      success: true,
      id: nextId
    };
  } catch (e) {
    return {
      success: false,
      error: e.message
    };
  }
}

function getMonthRangeFromMesRef_(mesRef) {
  if (!mesRef) return null;

  var parts = String(mesRef).split('-');
  if (parts.length < 2) return null;

  var year = Number(parts[0]);
  var month = Number(parts[1]); // 1–12

  if (!year || !month) return null;

  // Início do mês
  var start = new Date(year, month - 1, 1);
  // Início do próximo mês (intervalo exclusivo)
  var end = new Date(year, month, 1);

  return { start: start, end: end };
}

function dateInRange_(dateValue, start, end) {
  if (!dateValue) return false;

  var d;
  if (dateValue instanceof Date) {
    d = dateValue;
  } else {
    // tenta converter string/numero em Date
    d = new Date(dateValue);
    if (isNaN(d.getTime())) return false;
  }

  return d >= start && d < end;
}

function testGetSummary() {
  const mesRef = '2025-11';
  const resp = getMonthlySummary(mesRef);
  Logger.log('Resultado testGetSummary: %s', JSON.stringify(resp));
}

function testGetCategories() {
  const resp = getCategories();
  Logger.log('Resultado testGetCategories: %s', JSON.stringify(resp));
}


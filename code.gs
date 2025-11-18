/***********************************************************************************
 * BACKEND – CONTROLE FINANCEIRO WEBAPP
 ***********************************************************************************/

// Se quiser mover as planilhas para uma pasta específica do seu Drive,
// coloque aqui o ID da pasta. Se não quiser, deixe string vazia.
const PASTA_ID     = ''; 

// Prefixo do nome da planilha criada para cada usuário:
const PREFIXO_NOME = 'Controle Financeiro - ';

// Nomes das abas
const SHEET_TRANSACOES = 'transacoes';
const SHEET_CONFIG     = 'config';

// Índices de coluna
const COL_ID      = 1;
const COL_DATA    = 2;
const COL_TIPO    = 3;
const COL_CATEG   = 4;
const COL_DESC    = 5;
const COL_VALOR   = 6;
const COL_STATUS  = 7;
const COL_MES_REF = 8;


function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('Controle Financeiro WebApp')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * MULTI-USUÁRIO
 * - Dono (OWNER_EMAIL) → sempre usa a planilha fixa SPREADSHEET_ID
 * - Outros usuários    → planilha própria "Controle Financeiro - <email>"
 */

function getOrCreateUserSpreadsheet_() {
  const email = Session.getActiveUser().getEmail() || 'usuario';

  // Vamos guardar o ID da planilha deste usuário nas UserProperties
  const userProps = PropertiesService.getUserProperties();
  const KEY = 'CF_SPREADSHEET_ID';

  // 1) Tenta usar um ID já salvo
  const existingId = userProps.getProperty(KEY);
  if (existingId) {
    try {
      return SpreadsheetApp.openById(existingId);
    } catch (e) {
      Logger.log('ID salvo inválido, recriando planilha: ' + e.message);
      // segue para recriar
    }
  }

  // 2) Usa lock de usuário para evitar corrida entre múltiplas execuções
  const lock = LockService.getUserLock();
  lock.waitLock(30000); // espera até 30s se outro processo estiver criando

  try {
    // Confere de novo depois de pegar o lock,
    // pode ser que outra execução já tenha criado a planilha
    const idAfterLock = userProps.getProperty(KEY);
    if (idAfterLock) {
      return SpreadsheetApp.openById(idAfterLock);
    }

    const nomeArquivo = PREFIXO_NOME + email;
    let ss;

    // Verifica se já existe por nome (caso o usuário tenha apagado as props)
    const files = DriveApp.getFilesByName(nomeArquivo);
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
    } else {
      // Cria uma nova planilha para esse usuário
      ss = SpreadsheetApp.create(nomeArquivo);

      // (Opcional) move para uma pasta específica
      if (PASTA_ID && PASTA_ID.trim()) {
        try {
          const pasta = DriveApp.getFolderById(PASTA_ID);
          const file = DriveApp.getFileById(ss.getId());
          pasta.addFile(file);
          DriveApp.getRootFolder().removeFile(file);
        } catch (e) {
          Logger.log('Erro ao mover para pasta: ' + e.message);
        }
      }

      // Monta estrutura inicial (abas + cabeçalhos + categorias)
      inicializarEstrutura_(ss);
    }

    // Salva o ID para próximas execuções desse usuário
    userProps.setProperty(KEY, ss.getId());

    return ss;
  } finally {
    lock.releaseLock();
  }
}


/**
 * Inicialização da estrutura padrão para uma planilha nova
 */
function inicializarEstrutura_(ss) {
  // Remove aba padrão "Planilha1", se existir
  const sheetPadrao = ss.getSheets()[0];
  if (sheetPadrao && sheetPadrao.getName() === 'Planilha1') {
    ss.deleteSheet(sheetPadrao);
  }

  // Aba de transações
  let shTx = ss.getSheetByName(SHEET_TRANSACOES);
  if (!shTx) {
    shTx = ss.insertSheet(SHEET_TRANSACOES);
  }
  shTx.getRange(1, 1, 1, 8).setValues([[
    'id', 'data', 'tipo', 'categoria', 'descricao', 'valor', 'status', 'mes_ref'
  ]]);

  // Aba de config
  let shCfg = ss.getSheetByName(SHEET_CONFIG);
  if (!shCfg) {
    shCfg = ss.insertSheet(SHEET_CONFIG);
  }
  shCfg.getRange(1, 1, 1, 2).setValues([[
    'categorias_receita', 'categorias_despesa'
  ]]);
  shCfg.getRange(2, 1, 3, 1).setValues([
    ['Salário'],
    ['Freelancer'],
    ['Outros']
  ]);
  shCfg.getRange(2, 2, 6, 1).setValues([
    ['Aluguel'],
    ['Cartão de crédito'],
    ['Mercado'],
    ['Assinaturas'],
    ['Lazer'],
    ['Outros']
  ]);
}


/**
 * Pega a planilha correta:
 * - Se for o dono (OWNER_EMAIL) ou e-mail vazio → usa planilha mestre por ID
 * - Senão → usa/gera a planilha específica do usuário
 */
function getSpreadsheet_() {
  // Neste modelo, SEM dono fixo:
  // sempre pega (ou cria) a planilha do usuário logado.
  return getOrCreateUserSpreadsheet_();
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
 * Opcional: inicializar cabeçalhos na planilha atual
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

    const saldoPrevisto   = receitaTotal - (despesaPaga + despesaPendente);
    const saldoRealizado  = receitaTotal - despesaPaga;

    const summary = {
      receitaTotal: receitaTotal,
      despesaPaga: despesaPaga,
      despesaPendente: despesaPendente,
      saldoPrevisto: saldoPrevisto,
      saldoRealizado: saldoRealizado
    };

    Logger.log('Resumo calculado: %s', JSON.stringify(summary));

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

function parseLocalDate_(isoDateStr) {
  // Se não vier nada, usa a data de hoje
  if (!isoDateStr) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return hoje;
  }

  // Espera formato "yyyy-MM-dd"
  var parts = String(isoDateStr).split('-');
  if (parts.length === 3) {
    var year  = Number(parts[0]);
    var month = Number(parts[1]); // 1–12
    var day   = Number(parts[2]);

    if (year && month && day) {
      // new Date(ano, mes-1, dia) usa o fuso horário local do script
      var dLocal = new Date(year, month - 1, day);
      dLocal.setHours(0, 0, 0, 0);
      return dLocal;
    }
  }

  // Fallback: tenta parse normal
  var d = new Date(isoDateStr);
  if (!isNaN(d.getTime())) {
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Se nada der certo, devolve hoje
  var hoje2 = new Date();
  hoje2.setHours(0, 0, 0, 0);
  return hoje2;
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

    // >>> AQUI TROCAMOS <<<
    const dataCell = parseLocalDate_(tx.data);
    const tz = Session.getScriptTimeZone();
    const mesRefAuto = Utilities.formatDate(dataCell, tz, 'yyyy-MM');

    const row = [
      nextId,
      dataCell,
      tx.tipo || '',
      tx.categoria || '',
      tx.descricao || '',
      Number(tx.valor || 0),
      tx.status || '',
      tx.mesRef || mesRefAuto
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

  var year  = Number(parts[0]);
  var month = Number(parts[1]); // 1–12

  if (!year || !month) return null;

  var start = new Date(year, month - 1, 1); // início do mês
  var end   = new Date(year, month, 1);     // início do próximo mês

  return { start: start, end: end };
}

function dateInRange_(dateValue, start, end) {
  if (!dateValue) return false;

  var d;
  if (dateValue instanceof Date) {
    d = dateValue;
  } else {
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

function findRowById_(id) {
  const sh = getSheet_(SHEET_TRANSACOES);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;

  const idRange = sh.getRange(2, COL_ID, lastRow - 1, 1).getValues(); // coluna A
  for (var i = 0; i < idRange.length; i++) {
    const value = idRange[i][0];
    if (Number(value) === Number(id)) {
      return i + 2; // linha real na planilha
    }
  }
  return -1;
}

function updateTransaction(tx) {
  try {
    if (!tx || !tx.id) {
      return buildErrorResponse_('Transação inválida: id não informado.');
    }

    const sh = getSheet_(SHEET_TRANSACOES);
    const rowIndex = findRowById_(tx.id);

    if (rowIndex === -1) {
      return buildErrorResponse_('Transação não encontrada para o id: ' + tx.id);
    }

    // >>> AQUI TROCAMOS <<<
    const dataCell = parseLocalDate_(tx.data);
    const tz = Session.getScriptTimeZone();
    const mesRefAuto = Utilities.formatDate(dataCell, tz, 'yyyy-MM');

    const rowValues = [
      Number(tx.id),
      dataCell,
      tx.tipo || '',
      tx.categoria || '',
      tx.descricao || '',
      Number(tx.valor || 0),
      tx.status || '',
      tx.mesRef || mesRefAuto
    ];

    sh.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);

    return buildSuccessResponse_(null, { id: tx.id });
  } catch (e) {
    return buildErrorResponse_(e.message);
  }
}


function deleteTransaction(id) {
  try {
    if (!id) {
      return buildErrorResponse_('Id não informado para exclusão.');
    }

    const sh = getSheet_(SHEET_TRANSACOES);
    const rowIndex = findRowById_(id);

    if (rowIndex === -1) {
      return buildErrorResponse_('Transação não encontrada para o id: ' + id);
    }

    sh.deleteRow(rowIndex);

    return buildSuccessResponse_(null, { id: id });
  } catch (e) {
    return buildErrorResponse_(e.message);
  }
}
function _autorizarDrive_() {
  // só para pedir escopo de Drive
  DriveApp.getRootFolder();
}


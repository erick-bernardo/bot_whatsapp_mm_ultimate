// ==============================================================================
// FUNÇÃO 1: CARREGAMENTO RÁPIDO DO DASHBOARD (GERENCIAL - 6 MESES ENXUTA)
// ==============================================================================
function extraiBaseAgrupada() {
  var cache = CacheService.getScriptCache();
  var cacheKeyMaster = 'ultimate_bot_n_v10'; 
  var cacheKeyPrefix = 'ultimate_bot_part_v10_'; 
  var CHUNK_SIZE = 90000; 
  var CACHE_TIME = 21600; 
  
  try {
    var numParts = parseInt(cache.get(cacheKeyMaster) || '0');
    if (numParts > 0) {
      var keys = [];
      var fullJson = '';
      var cacheCompleto = true;
      for (var i = 0; i < numParts; i++) { keys.push(cacheKeyPrefix + i); }
      var parts = cache.getAll(keys);
      for (var i = 0; i < numParts; i++) {
        if (!parts[keys[i]]) { cacheCompleto = false; break; }
        fullJson += parts[keys[i]];
      }
      if (cacheCompleto && fullJson.length > 10) {
        Logger.log("Sucesso: Dados Gerenciais carregados do Cache.");
        return JSON.parse(fullJson);
      }
    }
  } catch (e) {
    Logger.log("Aviso ao ler cache gerencial: " + e.toString());
  }
  
  Logger.log("Iniciando consulta agrupada GERENCIAL no BigQuery (6 Meses Truncados com Paginação)...");
  const projectId = 'cust-exp-dp-curated-prd-52f1'; 
  
  const sqlQuery = `
    WITH base_antiga AS (
      SELECT 
        CAST(ult.conversation_id AS STRING) AS conversation_id,
        CAST(ult.bot_name AS STRING) AS bot_name,
        FORMAT_DATETIME('%Y-%m-%d', DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) AS conversation_start_date_br,
        FORMAT_DATETIME('%Y-W%V', DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) AS conversation_start_week,
        FORMAT_DATETIME('%Y-%m', DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) AS conversation_start_month,
        CAST(
          CASE
            WHEN (
              (EXTRACT(DAYOFWEEK FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) BETWEEN 2 AND 7 AND EXTRACT(HOUR FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) BETWEEN 8 AND 19)
              OR (EXTRACT(DAYOFWEEK FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) = 1 AND EXTRACT(HOUR FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) BETWEEN 9 AND 14)
            ) THEN 'Dentro do horário Atendimento'
            ELSE 'Fora do horário Atendimento'
          END 
        AS STRING) AS horario_atendimento,  
        REGEXP_REPLACE(CAST(ult.children_id AS STRING), r'[\\.,].*', '') AS id_pedido_filho,
        TIMESTAMP_DIFF(SAFE_CAST(ult.conversation_end_time AS TIMESTAMP), SAFE_CAST(ult.conversation_start_time AS TIMESTAMP), SECOND) AS tma_em_segundos, 
        CAST(CASE WHEN ult.conversation_status = 'botHandled' THEN 'Sim' ELSE 'Não' END AS STRING) AS retido,
        CAST(ult.is_llm_conversation AS STRING) AS is_llm_conversation,
        CAST(ult.use_case AS STRING) AS data_use_case,
        SAFE_CAST(ult.bot_messages_count AS INT64) AS bot_messages_count,
        SAFE_CAST(ult.visitor_messages_count AS INT64) AS visitor_messages_count,
        SAFE_CAST(ult.not_understood_messages_count AS INT64) AS not_understood_messages_count,
        CASE WHEN LOWER(CAST(ult.bsat_score AS STRING)) = 'passed' THEN NULL WHEN CAST(ult.bsat_score AS STRING) IN ('-1.0', '-1') THEN NULL ELSE SAFE_CAST(CAST(ult.bsat_score AS STRING) AS FLOAT64) END AS data_bsatscore
      FROM \`cust-exp-dp-curated-prd-52f1.gold.zendesk_ultimate\` AS ult
      WHERE DATE(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo") < '2026-07-01'
        AND DATE(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo") >= DATE_TRUNC(DATE_SUB(CURRENT_DATE("America/Sao_Paulo"), INTERVAL 6 MONTH), MONTH)
        AND LOWER(ult.bot_name) = 'madeiramadeira produção - chat'
        AND (LOWER(ult.use_case) NOT IN ('i want to buy', 'store address') OR ult.use_case IS NULL)
    ),
    base_nova AS (
      SELECT 
        CAST(ult.conversation_id AS STRING) AS conversation_id,
        CAST(ult.bot_name AS STRING) AS bot_name,
        FORMAT_DATETIME('%Y-%m-%d', DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) AS conversation_start_date_br,
        FORMAT_DATETIME('%Y-W%V', DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) AS conversation_start_week,
        FORMAT_DATETIME('%Y-%m', DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) AS conversation_start_month,
        CAST(
          CASE
            WHEN (
              (EXTRACT(DAYOFWEEK FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) BETWEEN 2 AND 7 AND EXTRACT(HOUR FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) BETWEEN 8 AND 19)
              OR (EXTRACT(DAYOFWEEK FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) = 1 AND EXTRACT(HOUR FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) BETWEEN 9 AND 14)
            ) THEN 'Dentro do horário Atendimento'
            ELSE 'Fora do horário Atendimento'
          END 
        AS STRING) AS horario_atendimento,  
        REGEXP_REPLACE(CAST(ult.children_id AS STRING), r'[\\.,].*', '') AS id_pedido_filho, 
        TIMESTAMP_DIFF(SAFE_CAST(ult.conversation_end_time AS TIMESTAMP), SAFE_CAST(ult.conversation_start_time AS TIMESTAMP), SECOND) AS tma_em_segundos,  
        CAST(CASE WHEN ult.conversation_status = 'botHandled' THEN 'Sim' ELSE 'Não' END AS STRING) AS retido,
        CAST(ult.has_knowledge_response_attempt AS STRING) AS is_llm_conversation, 
        CAST(ult.use_case AS STRING) AS data_use_case,    
        SAFE_CAST(ult.bot_messages_count AS INT64) AS bot_messages_count,
        SAFE_CAST(ult.visitor_messages_count AS INT64) AS visitor_messages_count,
        SAFE_CAST(ult.not_understood_messages_count AS INT64) AS not_understood_messages_count,
        CASE WHEN LOWER(CAST(ult.bsat_score AS STRING)) = 'passed' THEN NULL WHEN CAST(ult.bsat_score AS STRING) IN ('-1.0', '-1') THEN NULL ELSE SAFE_CAST(CAST(ult.bsat_score AS STRING) AS FLOAT64) END AS data_bsatscore
      FROM \`cust-exp-dp-curated-prd-52f1.gold.ultimate\` AS ult 
      WHERE ult.partition_date IS NOT NULL
        AND DATE(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo") >= '2026-07-01'
        AND DATE(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo") >= DATE_TRUNC(DATE_SUB(CURRENT_DATE("America/Sao_Paulo"), INTERVAL 6 MONTH), MONTH)
        AND LOWER(ult.bot_name) = 'madeiramadeira produção - chat'
        AND (LOWER(ult.use_case) NOT IN ('i want to buy', 'store address') OR ult.use_case IS NULL)
        AND (CAST(ult.test_mode AS STRING) = 'false' OR ult.test_mode IS FALSE OR ult.test_mode IS NULL)
    ),
    base_unificada AS (
      SELECT * FROM base_antiga UNION ALL SELECT * FROM base_nova
    ),
    dados_logistica AS (
      SELECT 
        id_pedido,
        CAST(MAX(tipo_venda) AS STRING) AS tipo_venda,
        CAST(MAX(CASE WHEN empresa_venda IN ('MM','MM_App','Guide Shop','CasaTema') THEN 'MadeiraMadeira' ELSE 'Marketplace' END) AS STRING) AS grupo_venda
      FROM \`logistics-dp-curated-prd-d443.silver_facade.looker_plan_looker_sales\`
      WHERE data_compra_date >= DATE_SUB(CURRENT_DATE("America/Sao_Paulo"), INTERVAL 720 DAY)
      GROUP BY id_pedido
    ),
    base_enriquecida AS (
      SELECT 
        u.*,
        v.tipo_venda,
        v.grupo_venda
      FROM base_unificada u
      LEFT JOIN dados_logistica v ON SAFE_CAST(u.id_pedido_filho AS INT64) = v.id_pedido
    )
    SELECT 
      bot_name, conversation_start_date_br, conversation_start_week, conversation_start_month, 
      horario_atendimento, retido, is_llm_conversation, data_use_case AS use_case,
      tipo_venda, grupo_venda,
      COUNT(DISTINCT conversation_id) AS qtd_conversas,
      COUNT(DISTINCT id_pedido_filho) AS qtd_pedidos,
      SUM(tma_em_segundos) AS sum_tma_segundos,
      SUM(bot_messages_count) AS sum_bot_messages_count,
      SUM(visitor_messages_count) AS sum_visitor_messages_count,
      SUM(not_understood_messages_count) AS sum_not_understood_messages_count,
      SUM(CASE WHEN data_bsatscore >= 4 THEN 1 ELSE 0 END) AS sum_promotores_bsat,
      SUM(CASE WHEN data_bsatscore <= 3 THEN 1 ELSE 0 END) AS sum_detratores_bsat,
      COUNT(data_bsatscore) AS qtd_respostas_bsat
    FROM base_enriquecida
    GROUP BY 
      bot_name, conversation_start_date_br, conversation_start_week, conversation_start_month, 
      horario_atendimento, retido, is_llm_conversation, use_case, tipo_venda, grupo_venda
    ORDER BY conversation_start_date_br DESC;
  `;

  const request = { query: sqlQuery, useLegacySql: false };

  try {
    let queryResults = BigQuery.Jobs.query(request, projectId);
    let jobId = queryResults.jobReference.jobId;
    let sleepTimeMs = 500;
    
    while (!queryResults.jobComplete) {
      Utilities.sleep(sleepTimeMs);
      sleepTimeMs *= 2;
      queryResults = BigQuery.Jobs.getQueryResults(projectId, jobId);
    }

    let dataOutput = [];
    let pageToken = queryResults.pageToken;
    let totalRowsExtracted = 0;

    let rows = queryResults.rows;
    let fields = queryResults.schema.fields;

    if (rows) {
      for (let i = 0; i < rows.length; i++) {
        let record = {};
        for (let j = 0; j < fields.length; j++) {
          record[fields[j].name] = rows[i].f[j].v !== null ? rows[i].f[j].v : '';
        }
        dataOutput.push(record);
      }
      totalRowsExtracted += rows.length;
    }

    while (pageToken) {
      queryResults = BigQuery.Jobs.getQueryResults(projectId, jobId, { pageToken: pageToken });
      pageToken = queryResults.pageToken;
      rows = queryResults.rows;
      if (rows) {
        for (let i = 0; i < rows.length; i++) {
          let record = {};
          for (let j = 0; j < fields.length; j++) {
            record[fields[j].name] = rows[i].f[j].v !== null ? rows[i].f[j].v : '';
          }
          dataOutput.push(record);
        }
        totalRowsExtracted += rows.length;
      }
    }
    
    Logger.log("Total de linhas GERENCIAIS extraídas: " + totalRowsExtracted);
    
    var jsonString = JSON.stringify(dataOutput);
    try {
      var totalParts = Math.ceil(jsonString.length / CHUNK_SIZE);
      var saveObj = {};
      for (var x = 0; x < totalParts; x++) {
        saveObj[cacheKeyPrefix + x] = jsonString.slice(x * CHUNK_SIZE, (x + 1) * CHUNK_SIZE);
      }
      cache.putAll(saveObj, CACHE_TIME);
      cache.put(cacheKeyMaster, String(totalParts), CACHE_TIME);
      Logger.log("Dados Gerenciais salvos no Cache em " + totalParts + " parte(s).");
    } catch (e) {
      Logger.log("Erro ao salvar cache gerencial: " + e.toString());
    }

    return dataOutput;
  } catch (err) {
    Logger.log('Erro na extração gerencial: ' + err.toString());
    throw new Error("Falha ao buscar dados gerenciais no BigQuery.");
  }
}

// ==============================================================================
// FUNÇÃO 2: CARREGAMENTO DA ABA OPERACIONAL (56 DIAS COM HORA E PAGINAÇÃO)
// ==============================================================================
function extraiBaseOperacional() {
  var cache = CacheService.getScriptCache();
  var cacheKeyMaster = 'ultimate_bot_oper_n_v2'; 
  var cacheKeyPrefix = 'ultimate_bot_oper_part_v2_'; 
  var CHUNK_SIZE = 90000; 
  var CACHE_TIME = 21600; 
  
  try {
    var numParts = parseInt(cache.get(cacheKeyMaster) || '0');
    if (numParts > 0) {
      var keys = [];
      var fullJson = '';
      var cacheCompleto = true;
      for (var i = 0; i < numParts; i++) { keys.push(cacheKeyPrefix + i); }
      var parts = cache.getAll(keys);
      for (var i = 0; i < numParts; i++) {
        if (!parts[keys[i]]) { cacheCompleto = false; break; }
        fullJson += parts[keys[i]];
      }
      if (cacheCompleto && fullJson.length > 10) {
        Logger.log("Sucesso: Dados Operacionais carregados do Cache.");
        return JSON.parse(fullJson);
      }
    }
  } catch (e) {
    Logger.log("Aviso ao ler cache operacional: " + e.toString());
  }
  
  Logger.log("Iniciando consulta OPERACIONAL no BigQuery (Últimos 56 Dias com Hora)...");
  const projectId = 'cust-exp-dp-curated-prd-52f1'; 
  
  const sqlQuery = `
    WITH base_antiga AS (
      SELECT 
        CAST(ult.conversation_id AS STRING) AS conversation_id,
        CAST(ult.bot_name AS STRING) AS bot_name,
        FORMAT_DATETIME('%Y-%m-%d', DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) AS conversation_start_date_br,
        FORMAT_DATETIME('%Y-W%V', DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) AS conversation_start_week,
        FORMAT_DATETIME('%Y-%m', DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) AS conversation_start_month,
        EXTRACT(HOUR FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) AS conversation_start_hora,
        CAST(
          CASE
            WHEN (
              (EXTRACT(DAYOFWEEK FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) BETWEEN 2 AND 7 AND EXTRACT(HOUR FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) BETWEEN 8 AND 19)
              OR (EXTRACT(DAYOFWEEK FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) = 1 AND EXTRACT(HOUR FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) BETWEEN 9 AND 14)
            ) THEN 'Dentro do horário Atendimento'
            ELSE 'Fora do horário Atendimento'
          END 
        AS STRING) AS horario_atendimento,  
        REGEXP_REPLACE(CAST(ult.children_id AS STRING), r'[\\.,].*', '') AS id_pedido_filho,
        TIMESTAMP_DIFF(SAFE_CAST(ult.conversation_end_time AS TIMESTAMP), SAFE_CAST(ult.conversation_start_time AS TIMESTAMP), SECOND) AS tma_em_segundos, 
        CAST(CASE WHEN ult.conversation_status = 'botHandled' THEN 'Sim' ELSE 'Não' END AS STRING) AS retido,
        CAST(ult.is_llm_conversation AS STRING) AS is_llm_conversation,
        CAST(ult.use_case AS STRING) AS data_use_case,
        SAFE_CAST(ult.bot_messages_count AS INT64) AS bot_messages_count,
        SAFE_CAST(ult.visitor_messages_count AS INT64) AS visitor_messages_count,
        SAFE_CAST(ult.not_understood_messages_count AS INT64) AS not_understood_messages_count,
        CASE WHEN LOWER(CAST(ult.bsat_score AS STRING)) = 'passed' THEN NULL WHEN CAST(ult.bsat_score AS STRING) IN ('-1.0', '-1') THEN NULL ELSE SAFE_CAST(CAST(ult.bsat_score AS STRING) AS FLOAT64) END AS data_bsatscore
      FROM \`cust-exp-dp-curated-prd-52f1.gold.zendesk_ultimate\` AS ult
      WHERE DATE(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo") < '2026-07-01'
        AND DATE(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo") >= DATE_SUB(CURRENT_DATE("America/Sao_Paulo"), INTERVAL 56 DAY)
        AND LOWER(ult.bot_name) = 'madeiramadeira produção - chat'
        AND (LOWER(ult.use_case) NOT IN ('i want to buy', 'store address') OR ult.use_case IS NULL)
    ),
    base_nova AS (
      SELECT 
        CAST(ult.conversation_id AS STRING) AS conversation_id,
        CAST(ult.bot_name AS STRING) AS bot_name,
        FORMAT_DATETIME('%Y-%m-%d', DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) AS conversation_start_date_br,
        FORMAT_DATETIME('%Y-W%V', DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) AS conversation_start_week,
        FORMAT_DATETIME('%Y-%m', DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) AS conversation_start_month,
        EXTRACT(HOUR FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) AS conversation_start_hora,
        CAST(
          CASE
            WHEN (
              (EXTRACT(DAYOFWEEK FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) BETWEEN 2 AND 7 AND EXTRACT(HOUR FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) BETWEEN 8 AND 19)
              OR (EXTRACT(DAYOFWEEK FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) = 1 AND EXTRACT(HOUR FROM DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) BETWEEN 9 AND 14)
            ) THEN 'Dentro do horário Atendimento'
            ELSE 'Fora do horário Atendimento'
          END 
        AS STRING) AS horario_atendimento,  
        REGEXP_REPLACE(CAST(ult.children_id AS STRING), r'[\\.,].*', '') AS id_pedido_filho, 
        TIMESTAMP_DIFF(SAFE_CAST(ult.conversation_end_time AS TIMESTAMP), SAFE_CAST(ult.conversation_start_time AS TIMESTAMP), SECOND) AS tma_em_segundos,  
        CAST(CASE WHEN ult.conversation_status = 'botHandled' THEN 'Sim' ELSE 'Não' END AS STRING) AS retido,
        CAST(ult.has_knowledge_response_attempt AS STRING) AS is_llm_conversation, 
        CAST(ult.use_case AS STRING) AS data_use_case,    
        SAFE_CAST(ult.bot_messages_count AS INT64) AS bot_messages_count,
        SAFE_CAST(ult.visitor_messages_count AS INT64) AS visitor_messages_count,
        SAFE_CAST(ult.not_understood_messages_count AS INT64) AS not_understood_messages_count,
        CASE WHEN LOWER(CAST(ult.bsat_score AS STRING)) = 'passed' THEN NULL WHEN CAST(ult.bsat_score AS STRING) IN ('-1.0', '-1') THEN NULL ELSE SAFE_CAST(CAST(ult.bsat_score AS STRING) AS FLOAT64) END AS data_bsatscore
      FROM \`cust-exp-dp-curated-prd-52f1.gold.ultimate\` AS ult 
      WHERE ult.partition_date IS NOT NULL
        AND DATE(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo") >= '2026-07-01'
        AND DATE(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo") >= DATE_SUB(CURRENT_DATE("America/Sao_Paulo"), INTERVAL 56 DAY)
        AND LOWER(ult.bot_name) = 'madeiramadeira produção - chat'
        AND (LOWER(ult.use_case) NOT IN ('i want to buy', 'store address') OR ult.use_case IS NULL)
        AND (CAST(ult.test_mode AS STRING) = 'false' OR ult.test_mode IS FALSE OR ult.test_mode IS NULL)
    ),
    base_unificada AS (
      SELECT * FROM base_antiga UNION ALL SELECT * FROM base_nova
    ),
    dados_logistica AS (
      SELECT 
        id_pedido,
        CAST(MAX(tipo_venda) AS STRING) AS tipo_venda,
        CAST(MAX(CASE WHEN empresa_venda IN ('MM','MM_App','Guide Shop','CasaTema') THEN 'MadeiraMadeira' ELSE 'Marketplace' END) AS STRING) AS grupo_venda
      FROM \`logistics-dp-curated-prd-d443.silver_facade.looker_plan_looker_sales\`
      WHERE data_compra_date >= DATE_SUB(CURRENT_DATE("America/Sao_Paulo"), INTERVAL 360 DAY)
      GROUP BY id_pedido
    ),
    base_enriquecida AS (
      SELECT 
        u.*,
        v.tipo_venda,
        v.grupo_venda
      FROM base_unificada u
      LEFT JOIN dados_logistica v ON SAFE_CAST(u.id_pedido_filho AS INT64) = v.id_pedido
    )
    SELECT 
      bot_name, conversation_start_date_br, conversation_start_week, conversation_start_month, conversation_start_hora,
      horario_atendimento, retido, is_llm_conversation, data_use_case AS use_case,
      tipo_venda, grupo_venda,
      COUNT(DISTINCT conversation_id) AS qtd_conversas,
      COUNT(DISTINCT id_pedido_filho) AS qtd_pedidos,
      SUM(tma_em_segundos) AS sum_tma_segundos,
      SUM(bot_messages_count) AS sum_bot_messages_count,
      SUM(visitor_messages_count) AS sum_visitor_messages_count,
      SUM(not_understood_messages_count) AS sum_not_understood_messages_count,
      SUM(CASE WHEN data_bsatscore >= 4 THEN 1 ELSE 0 END) AS sum_promotores_bsat,
      SUM(CASE WHEN data_bsatscore <= 3 THEN 1 ELSE 0 END) AS sum_detratores_bsat,
      COUNT(data_bsatscore) AS qtd_respostas_bsat
    FROM base_enriquecida
    GROUP BY 
      bot_name, conversation_start_date_br, conversation_start_week, conversation_start_month, conversation_start_hora, 
      horario_atendimento, retido, is_llm_conversation, use_case, tipo_venda, grupo_venda
    ORDER BY conversation_start_date_br DESC;
  `;

  const request = { query: sqlQuery, useLegacySql: false };

  try {
    let queryResults = BigQuery.Jobs.query(request, projectId);
    let jobId = queryResults.jobReference.jobId;
    let sleepTimeMs = 500;
    
    while (!queryResults.jobComplete) {
      Utilities.sleep(sleepTimeMs);
      sleepTimeMs *= 2;
      queryResults = BigQuery.Jobs.getQueryResults(projectId, jobId);
    }

    let dataOutput = [];
    let pageToken = queryResults.pageToken;
    let totalRowsExtracted = 0;

    let rows = queryResults.rows;
    let fields = queryResults.schema.fields;

    if (rows) {
      for (let i = 0; i < rows.length; i++) {
        let record = {};
        for (let j = 0; j < fields.length; j++) {
          record[fields[j].name] = rows[i].f[j].v !== null ? rows[i].f[j].v : '';
        }
        dataOutput.push(record);
      }
      totalRowsExtracted += rows.length;
    }

    while (pageToken) {
      queryResults = BigQuery.Jobs.getQueryResults(projectId, jobId, { pageToken: pageToken });
      pageToken = queryResults.pageToken;
      rows = queryResults.rows;
      if (rows) {
        for (let i = 0; i < rows.length; i++) {
          let record = {};
          for (let j = 0; j < fields.length; j++) {
            record[fields[j].name] = rows[i].f[j].v !== null ? rows[i].f[j].v : '';
          }
          dataOutput.push(record);
        }
        totalRowsExtracted += rows.length;
      }
    }
    
    Logger.log("Total de linhas OPERACIONAIS extraídas: " + totalRowsExtracted);
    
    var jsonString = JSON.stringify(dataOutput);
    try {
      var totalParts = Math.ceil(jsonString.length / CHUNK_SIZE);
      var saveObj = {};
      for (var x = 0; x < totalParts; x++) {
        saveObj[cacheKeyPrefix + x] = jsonString.slice(x * CHUNK_SIZE, (x + 1) * CHUNK_SIZE);
      }
      cache.putAll(saveObj, CACHE_TIME);
      cache.put(cacheKeyMaster, String(totalParts), CACHE_TIME);
      Logger.log("Dados Operacionais salvos no Cache em " + totalParts + " parte(s).");
    } catch (e) {
      Logger.log("Erro ao salvar cache operacional: " + e.toString());
    }

    return dataOutput;
  } catch (err) {
    Logger.log('Erro na extração operacional: ' + err.toString());
    throw new Error("Falha ao buscar dados operacionais no BigQuery.");
  }
}

// ==============================================================================
// FUNÇÃO 3: EXTRAÇÃO SOB DEMANDA (BASE DETALHADA PARA CSV)
// ==============================================================================
function extraiBaseDetalhada(dataInicio, dataFim) {
  const projectId = 'cust-exp-dp-curated-prd-52f1'; 
  
  if (!dataInicio || !dataFim) {
    throw new Error("Datas de início e fim são obrigatórias.");
  }

  const sqlQueryDetalhada = `
    WITH base_antiga AS (
      SELECT 
        CAST(ult.conversation_id AS STRING) AS conversation_id,
        FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) AS conversation_start_time_br,
        REGEXP_REPLACE(CAST(ult.children_id AS STRING), r'[\\.,].*', '') AS id_pedido_filho,
        CAST(CASE WHEN ult.conversation_status = 'botHandled' THEN 'Sim' ELSE 'Não' END AS STRING) AS retido,
        CAST(ult.use_case AS STRING) AS use_case,
        CAST(ult.is_llm_conversation AS STRING) AS is_llm_conversation,
        CAST(ult.bsat_score AS STRING) AS bsat_score
      FROM \`cust-exp-dp-curated-prd-52f1.gold.zendesk_ultimate\` AS ult
      WHERE DATE(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo") BETWEEN '${dataInicio}' AND '${dataFim}'
        AND DATE(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo") < '2026-07-01'
        AND LOWER(ult.bot_name) = 'madeiramadeira produção - chat'
        AND (CAST(ult.test_mode AS STRING) = 'false' OR ult.test_mode IS FALSE OR ult.test_mode IS NULL)
    ),
    base_nova AS (
      SELECT 
        CAST(ult.conversation_id AS STRING) AS conversation_id,
        FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', DATETIME(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo")) AS conversation_start_time_br,
        REGEXP_REPLACE(CAST(ult.children_id AS STRING), r'[\\.,].*', '') AS id_pedido_filho,
        CAST(CASE WHEN ult.conversation_status = 'botHandled' THEN 'Sim' ELSE 'Não' END AS STRING) AS retido,
        CAST(ult.use_case AS STRING) AS use_case,
        CAST(ult.has_knowledge_response_attempt AS STRING) AS is_llm_conversation,
        CAST(ult.bsat_score AS STRING) AS bsat_score
      FROM \`cust-exp-dp-curated-prd-52f1.gold.ultimate\` AS ult
      WHERE ult.partition_date IS NOT NULL
        AND DATE(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo") BETWEEN '${dataInicio}' AND '${dataFim}'
        AND DATE(CAST(ult.conversation_start_time AS TIMESTAMP), "America/Sao_Paulo") >= '2026-07-01'
        AND LOWER(ult.bot_name) = 'madeiramadeira produção - chat'
        AND (CAST(ult.test_mode AS STRING) = 'false' OR ult.test_mode IS FALSE OR ult.test_mode IS NULL)
    ),
    base_unificada AS (
      SELECT * FROM base_antiga UNION ALL SELECT * FROM base_nova
    ),
    dados_logistica AS (
      SELECT 
        id_pedido,
        CAST(MAX(tipo_venda) AS STRING) AS tipo_venda,
        CAST(MAX(CASE WHEN empresa_venda IN ('MM','MM_App','Guide Shop','CasaTema') THEN 'MadeiraMadeira' ELSE 'Marketplace' END) AS STRING) AS grupo_venda
      FROM \`logistics-dp-curated-prd-d443.silver_facade.looker_plan_looker_sales\`
      WHERE data_compra_date >= DATE_SUB(CURRENT_DATE("America/Sao_Paulo"), INTERVAL 360 DAY)
      GROUP BY id_pedido
    )
    SELECT 
      u.*,
      v.tipo_venda,
      v.grupo_venda
    FROM base_unificada u
    LEFT JOIN dados_logistica v ON SAFE_CAST(u.id_pedido_filho AS INT64) = v.id_pedido
    ORDER BY conversation_start_time_br DESC
    LIMIT 50000;
  `;

  const request = { query: sqlQueryDetalhada, useLegacySql: false };

  try {
    const queryResults = BigQuery.Jobs.query(request, projectId);
    let sleepTimeMs = 500;
    while (!queryResults.jobComplete) {
      Utilities.sleep(sleepTimeMs);
      sleepTimeMs *= 2;
    }

    const rows = queryResults.rows;
    const fields = queryResults.schema.fields;
    const dataOutput = [];

    if (rows) {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const record = {};
        for (let j = 0; j < fields.length; j++) {
          record[fields[j].name] = row.f[j].v !== null ? row.f[j].v : '';
        }
        dataOutput.push(record);
      }
    }
    return dataOutput;
  } catch (err) {
    Logger.log('Erro na extração detalhada: ' + err.toString());
    throw new Error("Falha ao processar extração detalhada.");
  }
}
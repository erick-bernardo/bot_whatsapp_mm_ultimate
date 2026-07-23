# bot_whatsapp_mm_ultimate

---

## 🏗️ Visão Geral da Arquitetura

O aplicativo segue um modelo similar ao MVC (Model-View-Controller), adaptado para as limitações e boas práticas do Apps Script:

* **Back-end (`.gs`):** Atua como o servidor. Comunica-se com o banco de dados (BigQuery), faz o tratamento pesado, gerencia o cache e envia pacotes limpos para o cliente.


* **Front-end (`.html`):** Atua como o cliente. É dividido em arquivos separados para estrutura (HTML), design (CSS) e interatividade (JS), que são "injetados" em uma página única.



---

## 📂 Estrutura de Arquivos e Suas Funções

A organização do código foi feita em múltiplos arquivos para facilitar a manutenção. Abaixo está a divisão lógica:

### 1. Back-end (Motor e Lógica de Servidor)

* **`codigo.gs`**: É o roteador principal do Web App.


* A função `doGet()` é obrigatória no GAS para Web Apps; ela constrói a página chamando o `index.html` e aplica configurações de responsividade.


* A função `include(filename)` é a "cola" do projeto; ela permite que os códigos separados nos arquivos HTML sejam injetados no documento principal, evitando um arquivo gigante e ilegível.




* **`extraibase.gs`**: É o núcleo de dados. Responsável por toda a comunicação com o BigQuery.


* `extraiBaseAgrupada()`: Extrai uma base gerencial sumarizada (últimos 6 meses). Usa paginação para evitar limites de tempo de execução e salva os dados no `CacheService` global em partes menores (chunks de 90.000 caracteres) para contornar o limite de tamanho do cache do Google.


* `extraiBaseOperacional()`: Semelhante à anterior, mas foca em uma visão tática de curto prazo (últimos 56 dias) trazendo granularidade de hora. Também utiliza o sistema de cache em chunks.


* `extraiBaseDetalhadaAltaPerformance(dataInicio, dataFim)`: Criada para gerar exportações. Consulta até 60.000 linhas detalhadas e já monta a estrutura de um arquivo CSV diretamente no back-end (para garantir performance e não travar o navegador do usuário).





### 2. Front-end (Interface Visual)

* **`index.html`**: O esqueleto mestre do dashboard. Usa as tags de script criadas no `codigo.gs` para importar os estilos, as abas e os scripts.


* **`estilos.html`**: Centraliza todo o código CSS do dashboard, garantindo que a identidade visual (cores, botões, tabelas) seja consistente em todas as páginas.


* **Abas (Views)**:
* `aba_gerencial.html`: O código HTML que desenha a interface da visão macro de negócio.


* `aba_operacional.html`: O código HTML focado na visão diária e acompanhamento de métricas de curto prazo.


* `aba_dados.html`: O código HTML responsável pela tela onde o usuário filtra e faz download de dados brutos.





### 3. Front-end (Scripts de Controle do Navegador)

* **`script_global.html`**: Guarda funções JavaScript genéricas que servem para todo o dashboard, como transição entre abas, alertas ou formatação de números.


* **`script_gerencial.html`**: A inteligência da aba gerencial. Solicita os dados para o back-end via `google.script.run` e renderiza os gráficos/tabelas daquela visão.


* **`script_operacional.html`**: Similar ao gerencial, mas aciona os dados e constrói as visualizações específicas da rotina operacional.


* **`script_dados.html`**: Gerencia a interação do usuário ao extrair bases. Ele coleta as datas preenchidas na interface, envia para o back-end gerar o CSV e cria o gatilho de download no navegador.


* **`appsscript.json`**: O arquivo de manifesto que guarda as configurações de fuso horário, dependências e permissões (escopos OAuth) que o script exige para rodar.



---

## 🔄 Como os dados fluem? (Passo a Passo)

Para entender a performance do dash, é vital compreender este fluxo de ponta a ponta:

1. **Abertura:** O usuário acessa a URL do aplicativo. O servidor do Google executa o `doGet()` no arquivo `codigo.gs`.


2. **Renderização Inicial:** O `index.html` é carregado e puxa imediatamente o `estilos.html` e os arquivos de aba e script correspondentes.


3. **Chamada de Dados (Assíncrona):** O script do lado do cliente (ex: `script_gerencial.html`) aciona a função `extraiBaseAgrupada()` de forma invisível para o usuário.


4. **Verificação de Cache:** No arquivo `extraibase.gs`, o sistema verifica se alguém acessou o painel nas últimas 6 horas. Se os dados já estiverem no cache, ele remonta as partes divididas (chunks) e as devolve imediatamente, reduzindo o tempo de carregamento de dezenas de segundos para milissegundos.


5. **Consulta ao BigQuery (Fallback):** Se o cache estiver vazio, o script aciona a API do BigQuery. Ele roda a query SQL em loop (paginando os resultados caso a tabela seja grande) até extrair tudo.


6. **Armazenamento e Retorno:** Os dados frescos são salvos no cache para os próximos usuários e retornados ao `script_gerencial.html`, que desenha as informações na tela.

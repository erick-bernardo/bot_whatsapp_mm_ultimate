/**
 * Roteador principal: Renderiza a interface do Web App
 */
function doGet() {
  var template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('Dashboard Bot Ultimate')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); 
}

/**
 * Função Mágica: Permite injetar (incluir) arquivos HTML dentro do index.html
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
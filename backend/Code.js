// ==============================================================================
// OZZI WEIRD BEATS - BACKEND (Google Apps Script)
// ==============================================================================

// Configurações - PREENCHA COM SEUS DADOS
const CONFIG = {
  SPREADSHEET_ID: 'COLE_AQUI_O_ID_DA_PLANILHA',
  MP_ACCESS_TOKEN: 'COLE_AQUI_O_ACCESS_TOKEN_DO_MERCADO_PAGO',
  TEMPLATE_DOC_ID: 'COLE_AQUI_O_ID_DO_DOC_MODELO',
  PDF_FOLDER_ID: 'COLE_AQUI_O_ID_DA_PASTA_DOS_PDFS',
  NOME_PRODUTOR: 'Ozzi Weird',
  EMAIL_REMETENTE: 'seu_email@gmail.com' // Seu email do Gmail para enviar
};

// ==========================================
// MÉTODOS DE ENTRADA (API)
// ==========================================

function doGet(e) {
  // ---- Consulta de status de pagamento ----
  if (e.parameter && e.parameter.action === 'status' && e.parameter.id_pedido) {
    return checarStatusPedido(e.parameter.id_pedido);
  }

  // ---- Proxy de áudio: lê o arquivo do Drive e retorna como base64 ----
  if (e.parameter && e.parameter.action === 'stream' && e.parameter.id) {
    return streamAudio(e.parameter.id);
  }

  // ---- Catálogo de beats ----
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName('catalogo');
  const data = sheet.getDataRange().getValues();
  
  const headers = data[0];
  const beats = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let beat = {};
    for (let j = 0; j < headers.length; j++) {
      beat[headers[j]] = row[j];
    }
    // Não retornar URLs privadas de WAV publicamente!
    delete beat.wav_url;
    
    // Converter capa do Drive para thumbnail
    if (beat.capa_url) {
      beat.capa_url = convertDriveUrlToThumbnail(beat.capa_url);
    }
    
    beats.push(beat);
  }
  
  return ContentService.createTextOutput(JSON.stringify(beats))
    .setMimeType(ContentService.MimeType.JSON);
}

// Checa o status do pedido na planilha
function checarStatusPedido(idPedido) {
  const sheetPed = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName('pedidos');
  const data = sheetPed.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[headers.indexOf('id_pedido')] == idPedido) {
      return ContentService.createTextOutput(JSON.stringify({
        status: row[headers.indexOf('status')],
        pdf_url: row[headers.indexOf('pdf_url')] || '',
        links_drive: row[headers.indexOf('links_drive')] || ''
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'nao_encontrado' })).setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// OUTRAS FUNÇÕES ... (MANTIDO)
// ==========================================

function processarEntrega(idPedido) {
  const sheetPed = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName('pedidos');
  const data = sheetPed.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[headers.indexOf('id_pedido')]) === String(idPedido) && row[headers.indexOf('status')] !== 'entregue') {
      
      const nome = String(row[headers.indexOf('nome')] || '');
      const email = String(row[headers.indexOf('email')] || '');
      const cpf = String(row[headers.indexOf('cpf')] || '');
      const beatsList = String(row[headers.indexOf('beats')] || '');
      const assinatura = String(row[headers.indexOf('assinatura')] || '');
      
      try {
        // 1. Cria uma pasta exclusiva para esse cliente no Drive
        const rootFolder = DriveApp.getFolderById(CONFIG.PDF_FOLDER_ID);
        const orderIdStr = String(idPedido);
        const orderFolder = rootFolder.createFolder(`Entrega: ${nome} - Pedido ${orderIdStr.substring(0,6)}`);
        orderFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        
        // 2. Gerar o PDF do Contrato DENTRO dessa pasta
        const pdfUrl = gerarContratoPDF(nome, cpf, beatsList, assinatura, orderFolder);
        if (!pdfUrl) throw new Error("A função gerarContratoPDF falhou e retornou vazio.");
        
        // 3. Buscar no Catálogo os arquivos correspondentes aos beats comprados
        const sheetCat = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName('catalogo');
        const catData = sheetCat.getDataRange().getValues();
        const catHeaders = catData[0];
        
        const boughtBeats = beatsList.split(',').map(b => b.trim());
        
        boughtBeats.forEach(b => {
          // Extrai o nome do beat e o formato (mp3 ou wav) usando regex
          const match = b.match(/(.+?)\s+\((mp3|wav)\)$/i);
          if (match) {
            const beatName = match[1].trim();
            const tier = match[2].toLowerCase();
            
            // Acha o beat no catálogo
            const catRow = catData.find(r => r[catHeaders.indexOf('nome')] === beatName);
            if (catRow) {
              const fileUrl = catRow[catHeaders.indexOf(`${tier}_url`)];
              
              if (fileUrl) {
                const strUrl = fileUrl.toString();
                // 1. Tenta extrair ID do Google Drive (formatos /d/ID ou ?id=ID)
                let fileIdMatch = strUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (!fileIdMatch) fileIdMatch = strUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                
                if (fileIdMatch) {
                  // É um arquivo do Google Drive: Cópia nativa (muito rápido, suporta arquivos grandes como WAV)
                  try {
                    const fileId = fileIdMatch[1];
                    const originalFile = DriveApp.getFileById(fileId);
                    // Pega a extensão original do arquivo
                    const mimeType = originalFile.getMimeType();
                    let ext = '';
                    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) ext = '.mp3';
                    else if (mimeType.includes('wav')) ext = '.wav';
                    else if (mimeType.includes('zip')) ext = '.zip';
                    
                    originalFile.makeCopy(`${beatName} (${tier.toUpperCase()})${ext}`, orderFolder);
                  } catch(err) {
                    Logger.log(`Erro ao copiar o arquivo Drive ${beatName}: ${err}`);
                  }
                } else if (strUrl.includes('dropbox.com')) {
                  // É um arquivo do Dropbox: Baixa o arquivo e salva no Drive do cliente
                  try {
                    const directUrl = strUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
                    const response = UrlFetchApp.fetch(directUrl);
                    const blob = response.getBlob();
                    
                    // Se for tier MP3, garante a extensão, caso contrário mantém a do blob
                    let ext = tier.toLowerCase() === 'mp3' ? '.mp3' : (tier.toLowerCase() === 'wav' ? '.wav' : '');
                    blob.setName(`${beatName} (${tier.toUpperCase()})${ext}`);
                    
                    orderFolder.createFile(blob);
                  } catch(err) {
                    Logger.log(`Erro ao baixar arquivo Dropbox ${beatName}: ${err}`);
                  }
                }
              }
            }
          }
        });
        
        const linksDrive = orderFolder.getUrl();
        
        // 4. Enviar o Email
        enviarEmailEntrega(nome, email, beatsList, linksDrive, pdfUrl);
        
        // 5. Atualizar status na planilha
        sheetPed.getRange(i + 1, headers.indexOf('status') + 1).setValue('entregue');
        
        // Atualiza colunas de URL
        let colPdf = headers.indexOf('pdf_url');
        let colLinks = headers.indexOf('links_drive');
        if (colPdf === -1) { colPdf = headers.length; sheetPed.getRange(1, colPdf + 1).setValue('pdf_url'); headers.push('pdf_url'); }
        if (colLinks === -1) { colLinks = headers.length; sheetPed.getRange(1, colLinks + 1).setValue('links_drive'); headers.push('links_drive'); }
        
        sheetPed.getRange(i + 1, colPdf + 1).setValue(pdfUrl);
        sheetPed.getRange(i + 1, colLinks + 1).setValue(linksDrive);
      } catch (masterErr) {
        Logger.log('Erro master ao processar entrega: ' + masterErr);
        try {
          MailApp.sendEmail({
            to: CONFIG.EMAIL_REMETENTE,
            subject: '⚠️ ERRO no Backend do Ozzi Weird',
            body: 'Ocorreu um erro ao processar o pedido ' + idPedido + '.\n\nDetalhes do erro:\n' + masterErr.toString() + '\n\nStack Trace:\n' + (masterErr.stack || '')
          });
        } catch(e) {}
      }
      
      break;
    }
  }
}

// Lê o arquivo de áudio do Drive e retorna como base64 (proxy anti-CORS)
function streamAudio(fileId) {
  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var base64 = Utilities.base64Encode(blob.getBytes());
    return ContentService.createTextOutput(JSON.stringify({
      audio: base64,
      type: blob.getContentType()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({
      error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Converte link do Drive para thumbnail (para imagens/capas)
function convertDriveUrlToThumbnail(url) {
  if (!url) return '';
  var match = url.toString().match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return 'https://drive.google.com/thumbnail?id=' + match[1] + '&sz=w800';
  }
  return url;
}

// Converte link do Drive para stream direto (para áudio)
function convertDriveUrlToStream(url) {
  if (!url) return '';
  var match = url.toString().match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return 'https://drive.google.com/uc?export=download&id=' + match[1];
  }
  return url;
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    
    if (payload.action === 'checkout') {
      return handleCheckout(payload);
    } 
    
    if (payload.action === 'webhook' || payload.type === 'payment') {
      return handleWebhook(payload);
    }
    
    if (payload.action === 'contato') {
      return handleContato(payload);
    }

    return responseJson({ error: 'Ação desconhecida' }, 400);

  } catch (error) {
    return responseJson({ error: error.message }, 500);
  }
}

// ==========================================
// FUNÇÕES DE CONTATO
// ==========================================
function handleContato(payload) {
  try {
    const htmlBody = `
      <h2>Nova Mensagem pelo Site (Ozzi Weird)</h2>
      <p><strong>De:</strong> ${payload.name} (${payload.email})</p>
      <p><strong>Assunto:</strong> ${payload.subject}</p>
      <hr>
      <p><strong>Mensagem:</strong></p>
      <p>${payload.message.replace(/\n/g, '<br>')}</p>
    `;
    
    MailApp.sendEmail({
      to: CONFIG.EMAIL_REMETENTE,
      replyTo: payload.email,
      subject: `[Contato Site] ${payload.subject}`,
      htmlBody: htmlBody
    });
    
    return responseJson({ status: 'ok', message: 'Mensagem enviada com sucesso!' });
  } catch(e) {
    return responseJson({ error: 'Erro ao enviar mensagem: ' + e.message }, 500);
  }
}

// ==========================================
// FUNÇÕES DE CHECKOUT
// ==========================================

function handleCheckout(data) {
  const { nome, email, cpf, whats, artista, itens, assinaturaBase64 } = data;
  
  // 1. Puxar preços da planilha para calcular total (segurança: não confiar no front)
  const sheetCat = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName('catalogo');
  const catData = sheetCat.getDataRange().getValues();
  const headers = catData[0];
  
  let valorTotal = 0;
  let nomesBeats = [];
  
  itens.forEach(item => {
    // Busca o beat pelo ID
    const row = catData.find(r => r[headers.indexOf('id')] == item.id);
    if (row) {
      nomesBeats.push(`${row[headers.indexOf('nome')]} (${item.tier})`);
      const precoCol = `preco_${item.tier.toLowerCase()}`;
      valorTotal += parseFloat(row[headers.indexOf(precoCol)]);
    }
  });

  // 2. Gerar PIX no Mercado Pago
  const idPedido = Utilities.getUuid();
  const pixData = criarPixMercadoPago(valorTotal, email, cpf, nome, idPedido);
  
  // 3. Salvar pedido na aba 'pedidos'
  const sheetPed = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName('pedidos');
  // Ordem: id_pedido | data | nome | cpf | email | whats | artista | beats | valor_total | status | id_mp | assinatura
  sheetPed.appendRow([
    idPedido,
    new Date(),
    nome,
    cpf,
    email,
    whats || '',
    artista || '',
    nomesBeats.join(', '),
    valorTotal,
    'pendente',
    pixData.id,
    assinaturaBase64
  ]);

  return responseJson({
    sucesso: true,
    id_pedido: idPedido,
    qr_code: pixData.point_of_interaction.transaction_data.qr_code,
    qr_code_base64: pixData.point_of_interaction.transaction_data.qr_code_base64
  });
}

function criarPixMercadoPago(valor, email, cpf, nome, idPedido) {
  const url = 'https://api.mercadopago.com/v1/payments';
  
  const payload = {
    transaction_amount: parseFloat(valor.toFixed(2)),
    description: `Compra de Beats - Ozzi Weird`,
    payment_method_id: 'pix',
    payer: {
      email: email,
      first_name: nome.split(' ')[0],
      last_name: nome.split(' ').slice(1).join(' ') || 'Sobrenome',
      identification: {
        type: 'CPF',
        number: cpf.replace(/\D/g, '')
      }
    },
    external_reference: idPedido,
    notification_url: ScriptApp.getService().getUrl()
  };

  const options = {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${CONFIG.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idPedido // Evita pagamentos duplicados
    },
    payload: JSON.stringify(payload)
  };

  const res = UrlFetchApp.fetch(url, options);
  return JSON.parse(res.getContentText());
}

// ==========================================
// FUNÇÕES DE WEBHOOK E ENTREGA
// ==========================================

function handleWebhook(data) {
  // O MP manda o ID do pagamento no webhook
  const paymentId = data.data ? data.data.id : null;
  if (!paymentId) return responseJson({ ok: true });

  // 1. Consulta o status real do pagamento na API
  const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;
  const options = {
    headers: { 'Authorization': `Bearer ${CONFIG.MP_ACCESS_TOKEN}` }
  };
  const res = UrlFetchApp.fetch(url, options);
  const payment = JSON.parse(res.getContentText());

  // Se foi aprovado, vamos entregar os beats
  if (payment.status === 'approved') {
    processarEntrega(payment.external_reference); // ID do pedido
  }

  return responseJson({ ok: true });
}



// ==========================================
// GERAÇÃO DE PDF E EMAIL
// ==========================================

function gerarContratoPDF(nome, cpf, beats, assinaturaBase64, orderFolder) {
  try {
    // Faz uma cópia do modelo do Docs
    const template = DriveApp.getFileById(CONFIG.TEMPLATE_DOC_ID);
    const docCopy = template.makeCopy(`Contrato_Licenca_${nome}`, orderFolder);
    const doc = DocumentApp.openById(docCopy.getId());
    const body = doc.getBody();
    
    // Substitui as variáveis no texto
    const dataAtual = Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy");
    body.replaceText("{{NOME_CLIENTE}}", nome);
    body.replaceText("{{CPF}}", cpf);
    body.replaceText("{{BEATS}}", beats);
    body.replaceText("{{DATA}}", dataAtual);
    
    // Embutir a assinatura no final do documento
    if (assinaturaBase64 && assinaturaBase64.indexOf('base64,') !== -1) {
      const base64Data = assinaturaBase64.split('base64,')[1];
      const imageBlob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/png', 'assinatura.png');
      body.appendParagraph("Assinatura do Cliente:");
      body.appendImage(imageBlob).setWidth(200).setHeight(75);
    }
    
    doc.saveAndClose();
    
    // Converte para PDF e exclui a cópia do Doc (mantendo só o PDF na pasta do pedido)
    const pdfBlob = docCopy.getAs(MimeType.PDF);
    const pdfFile = orderFolder.createFile(pdfBlob);
    
    docCopy.setTrashed(true); // Joga a cópia editável no lixo
    
    return pdfFile.getUrl();
  } catch (e) {
    Logger.log("Erro ao gerar PDF: " + e);
    return "";
  }
}

function enviarEmailEntrega(nome, email, beats, linksDrive, pdfUrl) {
  const subject = `Seus beats chegaram! 🔥 - Ozzi Weird`;
  
  const htmlBody = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #050505; color: #e8e8e8; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 40px auto; background-color: #141414; border: 1px solid #1f1f1f; border-radius: 12px; overflow: hidden; }
      .header { background-color: #0d0d0d; padding: 30px 20px; text-align: center; border-bottom: 2px solid #39ff14; }
      .header h1 { margin: 0; color: #39ff14; font-size: 28px; text-transform: uppercase; letter-spacing: 2px; }
      .content { padding: 30px; }
      .greeting { font-size: 20px; font-weight: bold; margin-bottom: 10px; color: #fff; }
      .message { font-size: 16px; color: #aaaaaa; line-height: 1.6; margin-bottom: 25px; }
      .beats-list { background-color: #0a0a0a; border-left: 4px solid #39ff14; padding: 15px; margin-bottom: 30px; color: #ddd; font-family: monospace; font-size: 15px; }
      .button-primary { display: block; width: 100%; text-align: center; background-color: #39ff14; color: #000 !important; font-weight: bold; font-size: 16px; text-decoration: none; padding: 15px 0; border-radius: 8px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; }
      .button-secondary { display: block; width: 100%; text-align: center; background-color: transparent; border: 1px solid #39ff14; color: #39ff14 !important; font-weight: bold; font-size: 14px; text-decoration: none; padding: 12px 0; border-radius: 8px; margin-bottom: 30px; }
      .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #1f1f1f; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>OZZI WEIRD</h1>
      </div>
      <div class="content">
        <div class="greeting">Eaí ${nome}, tudo certo? 🤘</div>
        <div class="message">
          Seu pagamento foi confirmado com sucesso. Abaixo estão os acessos oficiais aos seus arquivos originais e ao seu contrato de licenciamento.
        </div>
        
        <div class="beats-list">
          <strong>Beats Adquiridos:</strong><br><br>
          ${beats.replace(/,/g, '<br>')}
        </div>
        
        <a href="${linksDrive}" class="button-primary">🎵 Baixar Arquivos (WAV/Projeto)</a>
        <a href="${pdfUrl}" class="button-secondary">📄 Baixar Contrato de Licença (PDF)</a>
        
        <div class="message" style="margin-bottom: 0;">
          Qualquer dúvida sobre a mixagem, uso dos arquivos ou se precisar de um suporte, é só responder esse e-mail.<br><br>Tmj e bons trampos! 🔥
        </div>
      </div>
      <div class="footer">
        © ${new Date().getFullYear()} Ozzi Weird Beats. Todos os direitos reservados.
      </div>
    </div>
  </body>
  </html>
  `;
  
  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: htmlBody
  });
}

// Helper para resposta JSON
function responseJson(data, code = 200) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

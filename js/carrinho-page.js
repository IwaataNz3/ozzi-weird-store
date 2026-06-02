/* ===================================
   OZZI WEIRD BEATS — Carrinho Page JS
   ================================= */

document.addEventListener('DOMContentLoaded', () => {
  renderCartPage();

  // Escuta mudanças no carrinho
  window.addEventListener('cartUpdated', renderCartPage);

  // Verifica se veio do banner "Retomar Pagamento"
  const params = new URLSearchParams(window.location.search);
  if (params.get('retomar') === '1') {
    resumePendingPayment();
  }
});

function renderCartPage() {
  const itemsContainer = document.getElementById('cart-items');
  const summaryContainer = document.getElementById('cart-summary');
  const emptyState = document.getElementById('cart-empty');
  const cartContent = document.getElementById('cart-content');
  const countEl = document.getElementById('cart-item-count');

  const cart = getCart();

  if (cart.length === 0) {
    if (cartContent) cartContent.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    if (countEl) countEl.innerHTML = '<span>0</span> itens';
    return;
  }

  if (cartContent) cartContent.style.display = 'grid';
  if (emptyState) emptyState.style.display = 'none';
  if (countEl) countEl.innerHTML = `<span>${cart.length}</span> ite${cart.length === 1 ? 'm' : 'ns'}`;

  // Renderiza itens
  if (itemsContainer) {
    itemsContainer.innerHTML = '';
    cart.forEach(item => {
      const coverStyle = item.capa_url
        ? `background-image: url('${item.capa_url}'); background-size: cover; background-position: center;`
        : `background: ${getPlaceholderCover(item.beatId)};`;

      const el = document.createElement('div');
      el.className = 'cart-item';
      el.innerHTML = `
        <div class="cart-item-cover" style="${coverStyle}; width: 64px; height: 64px; border-radius: 8px; flex-shrink: 0;"></div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.nome}</div>
          <div class="cart-item-tier">${getTierLabel(item.tier)}</div>
          <select class="cart-tier-select" data-beat-id="${item.beatId}">
            <option value="mp3" ${item.tier === 'mp3' ? 'selected' : ''}>MP3 — ${formatarPreco(item.preco_mp3)}</option>
            <option value="wav" ${item.tier === 'wav' ? 'selected' : ''}>WAV — ${formatarPreco(item.preco_wav)}</option>
          </select>
        </div>
        <span class="cart-item-price">${formatarPreco(item.preco)}</span>
        <button class="cart-item-remove" data-beat-id="${item.beatId}" aria-label="Remover">
          <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      `;
      itemsContainer.appendChild(el);
    });

    // Event: trocar tier
    itemsContainer.querySelectorAll('.cart-tier-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const beatId = parseInt(e.target.dataset.beatId);
        updateCartTier(beatId, e.target.value);
      });
    });

    // Event: remover item
    itemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const beatId = parseInt(e.currentTarget.dataset.beatId);
        removeFromCart(beatId);
      });
    });
  }

  // Renderiza resumo
  if (summaryContainer) {
    const total = getCartTotal();
    summaryContainer.innerHTML = `
      <div class="cart-summary-row">
        <span>Itens (${cart.length})</span>
        <span>${formatarPreco(total)}</span>
      </div>
      <div class="cart-summary-row cart-summary-total">
        <span>Total</span>
        <span>${formatarPreco(total)}</span>
      </div>
    `;
  }
}

// ---- Checkout Modal Logic ----

// Timer do PIX dentro do modal
let _pixModalTimer = null;

function openCheckoutModal() {
  const cart = getCart();
  if (cart.length === 0) return;

  const overlay = document.getElementById('checkout-modal');
  if (!overlay) return;

  // Popula o resumo do checkout
  const summaryEl = document.getElementById('checkout-order-summary');
  if (summaryEl) {
    const total = getCartTotal();
    let html = '';
    cart.forEach(item => {
      html += `
        <div class="checkout-summary-item">
          <span>${item.nome} (${getTierLabel(item.tier)})</span>
          <span>${formatarPreco(item.preco)}</span>
        </div>
      `;
    });
    html += `
      <div class="checkout-summary-total">
        <span>Total</span>
        <span>${formatarPreco(total)}</span>
      </div>
    `;
    summaryEl.innerHTML = html;
  }

  // Mostra step 1 (formulário)
  showCheckoutStep('step-form');

  // Abre o modal
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCheckoutModal() {
  const overlay = document.getElementById('checkout-modal');
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  // Para o timer do modal (o banner continua contando)
  if (_pixModalTimer) {
    clearInterval(_pixModalTimer);
    _pixModalTimer = null;
  }
}

function showCheckoutStep(stepId) {
  document.querySelectorAll('.checkout-step').forEach(s => s.classList.remove('active'));
  const step = document.getElementById(stepId);
  if (step) step.classList.add('active');
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();

  const nome = document.getElementById('checkout-nome').value.trim();
  const email = document.getElementById('checkout-email').value.trim();
  let cpf = document.getElementById('checkout-cpf').value.trim();
  cpf = cpf.replace(/\D/g, ''); // Remove a máscara (deixa só números)
  const whats = document.getElementById('checkout-whats').value.trim();
  const artista = document.getElementById('checkout-artista').value.trim();
  const termosChecked = document.getElementById('checkout-termos').checked;

  if (!nome || !email || !cpf || !termosChecked) return;
  if (cpf.length !== 11) {
    showToast('Por favor, informe um CPF válido.');
    return;
  }

  // Mostra step de loading
  showCheckoutStep('step-loading');

  const cart = getCart();
  const payload = {
    action: 'checkout',
    nome,
    email,
    cpf,
    whats,
    artista,
    itens: cart.map(item => ({ id: item.beatId, tier: item.tier })),
    assinaturaBase64: window._signatureData || ''
  };

  try {
    const result = await criarPagamento(payload);

    // Salva como pagamento pendente (5 min)
    savePendingPayment({
      id_pedido: result.id_pedido,
      copia_e_cola: result.qr_code || result.copia_e_cola,
      qr_code_base64: result.qr_code_base64 || '',
      nome,
      email,
      itens: cart,
      total: getCartTotal()
    });

    // Mostra o PIX no modal
    showPixStep(result);

  } catch (err) {
    console.error('Erro no checkout:', err);
    showCheckoutStep('step-form');
    showToast('Erro ao processar pagamento. Tente novamente.');
  }
}

/**
 * Exibe o step do PIX no modal com os dados do pagamento.
 */
function showPixStep(data) {
  showCheckoutStep('step-pix');

  // Popula dados do PIX
  const pixCodeEl = document.getElementById('pix-code-text');
  if (pixCodeEl) pixCodeEl.textContent = data.qr_code || data.copia_e_cola;

  const qrImg = document.getElementById('pix-qr-img');
  if (qrImg && data.qr_code_base64) {
    qrImg.src = `data:image/png;base64,${data.qr_code_base64}`;
    qrImg.style.display = 'block';
  } else if (qrImg) {
    qrImg.style.display = 'none';
  }

  const pedidoEl = document.getElementById('pix-pedido-id');
  if (pedidoEl) pedidoEl.textContent = data.id_pedido;

  // Inicia countdown dentro do modal
  startPixModalTimer();
}

/**
 * Countdown timer e Polling de Status dentro do step do PIX no modal.
 */
function startPixModalTimer() {
  if (_pixModalTimer) clearInterval(_pixModalTimer);

  const statusEl = document.getElementById('pix-status');
  let lastPollTime = 0;

  async function tick() {
    const payment = getPendingPayment();

    if (!payment) {
      // Expirou
      if (statusEl) {
        statusEl.className = 'pix-status';
        statusEl.innerHTML = `
          <span style="color: var(--danger);">⏰ PIX expirado.</span>
          <br><small style="color: var(--text-secondary);">Feche este modal e gere um novo pagamento.</small>
        `;
      }
      clearInterval(_pixModalTimer);
      return;
    }

    // Atualiza o timer visual
    const remaining = payment.expires_at - Date.now();
    if (remaining > 0 && statusEl && statusEl.className === 'pix-status') {
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      statusEl.textContent = `Aguardando pagamento... ${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Polling na API a cada 5 segundos
    const now = Date.now();
    if (now - lastPollTime > 5000) {
      lastPollTime = now;
      const res = await verificarStatusPagamento(payment.id_pedido);
      
      if (res && res.status === 'entregue') {
        // PAGAMENTO APROVADO!
        clearInterval(_pixModalTimer);
        clearPendingPayment();
        clearCart();
        
        // Popula os links no modal de sucesso
        const btnBeats = document.getElementById('success-download-beats');
        const btnPdf = document.getElementById('success-download-pdf');
        
        if (btnBeats && res.links_drive) btnBeats.href = res.links_drive;
        if (btnPdf && res.pdf_url) btnPdf.href = res.pdf_url;
        
        // Exibe o modal de sucesso
        showCheckoutStep('step-success');
      }
    }
  }

  tick();
  _pixModalTimer = setInterval(tick, 1000);
}


/**
 * Força a verificação do status do pagamento quando o usuário clica no botão "Já paguei!".
 */
window.forceCheckPayment = async function() {
  const btn = document.querySelector('button[onclick="forceCheckPayment()"]');
  if (btn) {
    btn.innerHTML = 'Verificando... ⏳';
    btn.style.opacity = '0.7';
    btn.disabled = true;
  }

  const payment = getPendingPayment();
  if (payment) {
    const res = await verificarStatusPagamento(payment.id_pedido);
    
    if (res && res.status === 'entregue') {
      // Deu bom!
      if (_pixModalTimer) clearInterval(_pixModalTimer);
      clearPendingPayment();
      clearCart();
      
      const btnBeats = document.getElementById('success-download-beats');
      const btnPdf = document.getElementById('success-download-pdf');
      
      if (btnBeats && res.links_drive) btnBeats.href = res.links_drive;
      if (btnPdf && res.pdf_url) btnPdf.href = res.pdf_url;
      
      showCheckoutStep('step-success');
    } else {
      // Ainda não processou
      showToast('Ainda não detectamos o pagamento. Aguarde alguns segundos.');
      if (btn) {
        btn.innerHTML = 'Já realizei o pagamento!';
        btn.style.opacity = '1';
        btn.disabled = false;
      }
    }
  }
}

/**
 * Retoma um pagamento pendente: abre o modal direto no step do PIX.
 */
function resumePendingPayment() {
  const payment = getPendingPayment();
  if (!payment) {
    showToast('Nenhum pagamento pendente encontrado.');
    // Limpa o parametro da URL
    window.history.replaceState({}, '', 'carrinho.html');
    return;
  }

  const overlay = document.getElementById('checkout-modal');
  if (!overlay) return;

  // Abre o modal
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Vai direto para o step do PIX
  showPixStep({
    copia_e_cola: payment.copia_e_cola,
    qr_code_base64: payment.qr_code_base64,
    id_pedido: payment.id_pedido
  });

  // Limpa o parametro da URL
  window.history.replaceState({}, '', 'carrinho.html');
}

function copyPixCode() {
  const code = document.getElementById('pix-code-text')?.textContent;
  if (code) {
    navigator.clipboard.writeText(code).then(() => {
      showToast('Código PIX copiado!');
    }).catch(() => {
      // Fallback: select the text
      const el = document.getElementById('pix-code-text');
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      showToast('Selecione e copie o código manualmente.');
    });
  }
}

/**
 * Cancela o pagamento PIX gerado e reseta o modal.
 */
function handleCancelPayment() {
  clearPendingPayment();
  if (_pixModalTimer) {
    clearInterval(_pixModalTimer);
    _pixModalTimer = null;
  }
  showCheckoutStep('step-form');
  showToast('Pagamento cancelado com sucesso.');
}

/**
 * Aplica a máscara de CPF (XXX.XXX.XXX-XX)
 */
function maskCPF(input) {
  let v = input.value.replace(/\D/g, ""); // Remove tudo o que não é dígito
  if (v.length > 11) v = v.slice(0, 11); // Limita a 11 dígitos
  
  // Coloca os pontos e traço
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  
  input.value = v;
}

/**
 * Mostra o step de termos.
 */
function showTerms(e) {
  e.preventDefault();
  showCheckoutStep('step-terms');
}

/**
 * Lida com o clique direto no checkbox de termos.
 */
function handleCheckboxClick(e) {
  const checkbox = e.target;
  // Se o usuário está tentando marcar, previne e mostra a confirmação
  if (checkbox.checked) {
    e.preventDefault();
    showTermsConfirmation();
  }
}

/**
 * Mostra o aviso legal de confirmação antes de aceitar.
 */
function showTermsConfirmation() {
  showCheckoutStep('step-confirm-terms');
}

/**
 * Marca o checkbox como checked e volta pro form, se a assinatura for válida.
 */
function acceptTermsAndGoBack() {
  if (isCanvasBlank()) {
    showToast('Por favor, faça sua assinatura antes de prosseguir.');
    return;
  }
  
  // Pega a imagem da assinatura em verde neon
  const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = originalImageData.data;
  
  // Converte todos os pixels visíveis para PRETO
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) { // Se não for transparente
      data[i] = 0;     // Red
      data[i + 1] = 0; // Green
      data[i + 2] = 0; // Blue
    }
  }
  
  // Cria um canvas invisível só para exportar a imagem preta
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.putImageData(originalImageData, 0, 0);
  
  // Salva a assinatura globalmente para enviar depois (agora em preto)
  window._signatureData = tempCanvas.toDataURL('image/png');

  const checkbox = document.getElementById('checkout-termos');
  if (checkbox) checkbox.checked = true;
  showCheckoutStep('step-form');
}

// ==========================================
// LÓGICA DA LOUSA DIGITAL (ASSINATURA)
// ==========================================
let canvas, ctx;
let drawing = false;

function initSignaturePad() {
  canvas = document.getElementById('signature-pad');
  if (!canvas) return;
  
  ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#39ff14'; // Verde neon
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Eventos de Mouse
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);

  // Eventos de Touch (Celular)
  canvas.addEventListener('touchstart', startDrawing, {passive: false});
  canvas.addEventListener('touchmove', draw, {passive: false});
  canvas.addEventListener('touchend', stopDrawing);
}

function getCoordinates(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  let clientX, clientY;
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function startDrawing(e) {
  e.preventDefault();
  drawing = true;
  const { x, y } = getCoordinates(e);
  ctx.beginPath();
  ctx.moveTo(x, y);
}

function draw(e) {
  if (!drawing) return;
  e.preventDefault();
  const { x, y } = getCoordinates(e);
  ctx.lineTo(x, y);
  ctx.stroke();
}

function stopDrawing() {
  drawing = false;
  ctx.closePath();
}

function clearSignature() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function isCanvasBlank() {
  const blank = document.createElement('canvas');
  blank.width = canvas.width;
  blank.height = canvas.height;
  return canvas.toDataURL() === blank.toDataURL();
}

// Inicializa o canvas assim que a página carrega
document.addEventListener('DOMContentLoaded', () => {
  initSignaturePad();
});


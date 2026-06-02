/* ===================================
   OZZI WEIRD BEATS — Cart Logic
   ===================================
   Carrinho de compras com localStorage.
   Dispara eventos customizados para
   que qualquer página possa reagir a
   mudanças no carrinho.
   ================================= */

const CART_KEY = 'ozziWeirdCart';

/**
 * Retorna o carrinho atual (array de itens).
 * Cada item: { beatId, nome, capa_url, tier, preco }
 */
function getCart() {
  try {
    const data = localStorage.getItem(CART_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Salva o carrinho no localStorage e dispara evento.
 */
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart } }));
}

/**
 * Adiciona um beat ao carrinho.
 * Se o beat já estiver no carrinho, atualiza o tier.
 */
function addToCart(beat, tier) {
  const cart = getCart();
  const existing = cart.find(item => item.beatId === beat.id);

  if (existing) {
    existing.tier = tier;
    existing.preco = getPrecoByTier(beat, tier);
  } else {
    cart.push({
      beatId: beat.id,
      nome: beat.nome,
      capa_url: beat.capa_url,
      tier: tier,
      preco: getPrecoByTier(beat, tier),
      // Guardar todos os preços para permitir trocar o tier no carrinho
      preco_mp3: beat.preco_mp3,
      preco_wav: beat.preco_wav,
      preco_fl: beat.preco_fl
    });
  }

  saveCart(cart);
  showToast(`"${beat.nome}" adicionado ao carrinho!`);
}

/**
 * Remove um beat do carrinho pelo beatId.
 */
function removeFromCart(beatId) {
  let cart = getCart();
  cart = cart.filter(item => item.beatId !== beatId);
  saveCart(cart);
}

/**
 * Atualiza o tier de um item no carrinho.
 */
function updateCartTier(beatId, newTier) {
  const cart = getCart();
  const item = cart.find(i => i.beatId === beatId);
  if (item) {
    item.tier = newTier;
    switch (newTier) {
      case 'mp3': item.preco = item.preco_mp3; break;
      case 'wav': item.preco = item.preco_wav; break;
      case 'fl':  item.preco = item.preco_fl;  break;
    }
    saveCart(cart);
  }
}

/**
 * Verifica se um beat está no carrinho.
 */
function isInCart(beatId) {
  return getCart().some(item => item.beatId === beatId);
}

/**
 * Retorna o tier selecionado de um beat no carrinho, ou null.
 */
function getCartTier(beatId) {
  const item = getCart().find(i => i.beatId === beatId);
  return item ? item.tier : null;
}

/**
 * Limpa todo o carrinho.
 */
function clearCart() {
  saveCart([]);
}

/**
 * Retorna o total do carrinho.
 */
function getCartTotal() {
  return getCart().reduce((sum, item) => sum + item.preco, 0);
}

/**
 * Retorna a quantidade de itens no carrinho.
 */
function getCartCount() {
  return getCart().length;
}

/**
 * Atualiza o badge do carrinho no header.
 * Deve ser chamado em todas as páginas.
 */
function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  const count = getCartCount();
  badge.textContent = count;
  if (count > 0) {
    badge.classList.add('visible');
  } else {
    badge.classList.remove('visible');
  }
}

// ---- Toast Notification ----

/**
 * Exibe uma notificação toast temporária.
 */
function showToast(message) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  // Remove após a animação
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ====================================
//  PAGAMENTO PENDENTE (5 min expiry)
// ====================================

const PENDING_PAYMENT_KEY = 'ozziWeirdPendingPayment';
const PAYMENT_EXPIRY_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Salva um pagamento pendente no localStorage.
 * @param {Object} data — dados do pagamento (PIX, itens, cliente)
 */
function savePendingPayment(data) {
  const payment = {
    ...data,
    created_at: Date.now(),
    expires_at: Date.now() + PAYMENT_EXPIRY_MS
  };
  localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(payment));
  showPendingBanner();
}

/**
 * Retorna o pagamento pendente se ainda não expirou, ou null.
 */
function getPendingPayment() {
  try {
    const raw = localStorage.getItem(PENDING_PAYMENT_KEY);
    if (!raw) return null;
    const payment = JSON.parse(raw);
    if (Date.now() > payment.expires_at) {
      clearPendingPayment();
      return null;
    }
    return payment;
  } catch {
    return null;
  }
}

/**
 * Limpa o pagamento pendente.
 */
function clearPendingPayment() {
  localStorage.removeItem(PENDING_PAYMENT_KEY);
  removePendingBanner();
}

// ---- Banner de Pagamento Pendente ----

let _pendingTimerInterval = null;

/**
 * Mostra o banner de pagamento pendente (fixo abaixo do header).
 * Funciona em qualquer página.
 */
function showPendingBanner() {
  removePendingBanner(); // remove anterior se existir

  const payment = getPendingPayment();
  if (!payment) return;

  const banner = document.createElement('div');
  banner.className = 'pending-payment-banner';
  banner.id = 'pending-payment-banner';
  banner.innerHTML = `
    <div class="container pending-payment-inner">
      <div class="pending-payment-info">
        <span class="pending-payment-dot"></span>
        <span>Pagamento PIX pendente</span>
        <span class="pending-payment-timer" id="pending-timer"></span>
      </div>
      <a href="carrinho.html?retomar=1"
         class="pending-payment-btn"
         onclick="return _handleResumeClick(event)">
        Retomar Pagamento
      </a>
    </div>
  `;

  // Insere logo após o header
  const header = document.querySelector('.header');
  if (header && header.nextSibling) {
    header.parentNode.insertBefore(banner, header.nextSibling);
  } else {
    document.body.prepend(banner);
  }

  document.body.classList.add('has-pending-payment');
  _startPendingTimer();
}

/**
 * Lida com o clique no botão de retomar pagamento.
 * Se já estivermos na página do carrinho, previne o reload e chama a função global.
 */
function _handleResumeClick(event) {
  if (window.location.pathname.endsWith('carrinho.html') || window.location.pathname.endsWith('carrinho')) {
    event.preventDefault();
    if (typeof resumePendingPayment === 'function') {
      resumePendingPayment();
    } else {
      console.error("Função resumePendingPayment não encontrada.");
    }
    return false;
  }
  return true; // Deixa o link agir normalmente se estiver em outra página
}

/**
 * Remove o banner e para o timer.
 */
function removePendingBanner() {
  const banner = document.getElementById('pending-payment-banner');
  if (banner) banner.remove();
  document.body.classList.remove('has-pending-payment');
  if (_pendingTimerInterval) {
    clearInterval(_pendingTimerInterval);
    _pendingTimerInterval = null;
  }
}

/**
 * Inicia o countdown no banner.
 */
function _startPendingTimer() {
  if (_pendingTimerInterval) clearInterval(_pendingTimerInterval);

  function tick() {
    const payment = getPendingPayment();
    const timerEl = document.getElementById('pending-timer');

    if (!payment) {
      removePendingBanner();
      return;
    }

    const remaining = payment.expires_at - Date.now();
    if (remaining <= 0) {
      clearPendingPayment();
      showToast('Pagamento PIX expirou. Gere um novo.');
      return;
    }

    if (timerEl) {
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      timerEl.textContent = `— expira em ${mins}:${secs.toString().padStart(2, '0')}`;
    }
  }

  tick();
  _pendingTimerInterval = setInterval(tick, 1000);
}

// ---- Inicialização ----
// Atualiza o badge sempre que o carrinho mudar
window.addEventListener('cartUpdated', updateCartBadge);

// Atualiza o badge e verifica pagamento pendente no carregamento da página
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  // Mostra banner se houver pagamento pendente
  const pending = getPendingPayment();
  if (pending) {
    showPendingBanner();
  }
});

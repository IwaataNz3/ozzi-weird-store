/* ===================================
   OZZI WEIRD BEATS — API Layer
   ===================================
   Comunicação com o Google Apps Script.
   Enquanto o backend não estiver pronto,
   usamos dados mock para desenvolver o front.
   ================================= */

// ---- Configuração ----
// Substitua pela URL do seu Google Apps Script quando estiver pronto
const API_URL = 'https://script.google.com/macros/s/AKfycbxLzQjY1z8qpMkMjnCJ9enGs2oPEQOExE6lDX6tlq4zSZtR3HDIAADooPSBGUAQSxFs9Q/exec';

// ---- Utilitários ----

/**
 * Extrai o File ID de qualquer formato de URL do Google Drive.
 * Suporta /d/FILE_ID/ e ?id=FILE_ID
 */
function extractDriveFileId(url) {
  if (!url) return null;
  // Formato: /d/FILE_ID/
  let match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Formato: ?id=FILE_ID ou &id=FILE_ID
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return null;
}

/**
 * Converte um link padrão do Dropbox em um link de streaming direto (dl.dropboxusercontent.com)
 */
function extractDropboxDirectUrl(url) {
  if (!url || !url.includes('dropbox.com')) return null;
  return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
}

/**
 * Converte um link de compartilhamento do Google Drive
 * para um link direto de stream.
 */
function convertDriveUrl(shareUrl) {
  if (!shareUrl) return '';
  const match = shareUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  }
  return shareUrl;
}

function convertDriveImageUrl(shareUrl) {
  if (!shareUrl) return '';
  const match = shareUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
  }
  return shareUrl;
}

// ---- Dados Mock ----
// Mock de dados dos beats para testar o front-end
const MOCK_BEATS = [
  {
    id: 1,
    nome: 'Night Terror',
    bpm: 140,
    tom: 'Am',
    genero: 'Trap',
    type_beat: 'Travis Scott, Drake',
    preco_mp3: 29.90,
    preco_wav: 59.90,
    capa_url: 'assets/cover-night-terror.png',
    destaque: true
  },
  {
    id: 2,
    nome: 'Phantom Drip',
    bpm: 155,
    tom: 'Cm',
    genero: 'Drill',
    type_beat: 'Pop Smoke',
    preco_mp3: 39.90,
    preco_wav: 79.90,
    capa_url: 'assets/cover-phantom-drip.png',
    destaque: true
  },
  {
    id: 3,
    nome: 'Manifesto',
    bpm: 90,
    tom: 'Dm',
    genero: 'Boom Bap',
    type_beat: 'Wu-Tang Clan',
    preco_mp3: 24.90,
    preco_wav: 49.90,
    capa_url: '',
    destaque: false
  },
  {
    id: 4,
    nome: 'Acid Rain',
    bpm: 130,
    tom: 'Gm',
    genero: 'Trap',
    type_beat: 'Playboi Carti',
    preco_mp3: 29.90,
    preco_wav: 59.90,
    capa_url: 'assets/cover-acid-rain.png',
    destaque: true
  },
  {
    id: 5,
    nome: 'Toxic Wave',
    bpm: 160,
    tom: 'Fm',
    genero: 'Phonk',
    type_beat: 'Kordhell',
    preco_mp3: 44.90,
    preco_wav: 89.90,
    capa_url: 'assets/cover-toxic-wave.png',
    destaque: true
  },
  {
    id: 6,
    nome: 'Shadow Step',
    bpm: 145,
    tom: 'Ebm',
    genero: 'Drill',
    type_beat: 'Central Cee',
    preco_mp3: 34.90,
    preco_wav: 69.90,
    capa_url: '',
    destaque: false
  }
];

// ---- Funções da API ----

/**
 * Busca todos os beats do catálogo.
 * Quando o Apps Script estiver pronto, faz fetch real.
 * Por agora, retorna os dados mock.
 */
async function fetchBeats() {
  if (API_URL) {
    try {
      const res = await fetch(`${API_URL}?action=listar`);
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Erro ao buscar beats da API:', err);
      return MOCK_BEATS;
    }
  }
  // Simula um pequeno delay de rede
  await new Promise(r => setTimeout(r, 600));
  return MOCK_BEATS;
}

/**
 * Verifica o status de um pagamento pendente
 */
async function verificarStatusPagamento(idPedido) {
  if (API_URL) {
    try {
      // O "&t=" evita que o navegador faça cache da requisição
      const res = await fetch(`${API_URL}?action=status&id_pedido=${idPedido}&t=${Date.now()}`);
      return await res.json();
    } catch (err) {
      console.error('Erro ao verificar status:', err);
      return { status: 'erro' };
    }
  }
  return { status: 'pendente' };
}

/**
 * Busca apenas os beats em destaque (para a Home).
 */
async function fetchFeaturedBeats() {
  const beats = await fetchBeats();
  return beats.filter(b => b.destaque);
}

/**
 * Busca um beat por ID.
 */
async function fetchBeatById(id) {
  const beats = await fetchBeats();
  return beats.find(b => b.id === id) || null;
}

/**
 * Cria um pagamento PIX via Apps Script / Mercado Pago.
 * @param {Object} payload - { nome, email, itens: [{ id, tier }] }
 * @returns {Object} - { qr_code_base64, copia_e_cola, id_pedido }
 */
async function criarPagamento(payload) {
  if (API_URL) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        // Usa text/plain para evitar erro de CORS (preflight OPTIONS) no Google Apps Script
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (err) {
      console.error('Erro ao criar pagamento:', err);
      throw err;
    }
  }
  // Mock: simula resposta do pagamento
  await new Promise(r => setTimeout(r, 1500));
  return {
    qr_code_base64: '',
    copia_e_cola: '00020126580014br.gov.bcb.pix0136mock-pix-key-ozzi-weird-beats520400005303986540' + payload.itens.length + '.005802BR5913OZZI WEIRD6008SAO PAULO62070503***6304MOCK',
    id_pedido: 'PED-' + Date.now()
  };
}

/**
 * Formata um valor numérico como moeda BRL.
 */
function formatarPreco(valor) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

/**
 * Retorna o preço do beat com base no tier selecionado.
 */
function getPrecoByTier(beat, tier) {
  switch (tier) {
    case 'mp3': return beat.preco_mp3;
    case 'wav': return beat.preco_wav;
    default:    return beat.preco_mp3;
  }
}

/**
 * Retorna o nome legível do tier.
 */
function getTierLabel(tier) {
  switch (tier) {
    case 'mp3': return 'MP3';
    case 'wav': return 'WAV';
    default:    return tier.toUpperCase();
  }
}

// Gera uma cor/gradiente placeholder para capas sem imagem
function getPlaceholderCover(id) {
  const gradients = [
    'linear-gradient(135deg, #0a2e0a 0%, #1a1a1a 50%, #0d3d05 100%)',
    'linear-gradient(135deg, #1a0a2e 0%, #1a1a1a 50%, #0d0d3d 100%)',
    'linear-gradient(135deg, #2e0a0a 0%, #1a1a1a 50%, #3d0d0d 100%)',
    'linear-gradient(135deg, #0a2e2e 0%, #1a1a1a 50%, #0d3d3d 100%)',
    'linear-gradient(135deg, #2e2e0a 0%, #1a1a1a 50%, #3d3d0d 100%)',
    'linear-gradient(135deg, #1a0a0a 0%, #0d3d05 50%, #0a0a0a 100%)',
    'linear-gradient(135deg, #0d0d0d 0%, #1a7a0a 30%, #050505 100%)',
    'linear-gradient(135deg, #050505 0%, #39ff14 5%, #0d0d0d 40%, #050505 100%)'
  ];
  return gradients[(id - 1) % gradients.length];
}

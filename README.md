# Ozzi Weird Beats | Loja Oficial 🎵🦇

Uma plataforma moderna de e-commerce e portfólio para venda de instrumentais (Beats), focada nos subgêneros **Trap, Drill e Dark Trap**. 

Este projeto foi construído para entregar uma experiência premium, rápida e sem fricções para o usuário (MCs e Artistas), com  **100% autônoma e com custo zero de infraestrutura**.

---

## ✨ Funcionalidades Principais

* **🎧 Audio Player Global Contínuo:** Um player de áudio fixo no rodapé que permite ao cliente escutar as prévias dos beats enquanto navega pelo catálogo, sem interrupções de áudio entre as trocas de página (Home/Loja).
* **⚡ Streaming via Dropbox (CDN):** Sistema de proxy inteligente em JavaScript que converte links padrão do Dropbox em links de streaming de alta velocidade, evitando bloqueios de cross-origin e reproduzindo as faixas instantaneamente.
* **🛒 E-commerce "Serverless" & Guest Checkout:** Carrinho de compras integrado diretamente via **Google Apps Script**. Os clientes podem selecionar diferentes tiers de licenciamento (MP3, WAV, Trackout) e gerar pagamentos via PIX/MercadoPago sem precisarem criar contas chatas.
* **❤️ Sistema de Favoritos:** O usuário pode favoritar beats na loja. As curtidas são salvas no `localStorage` do navegador para manter o site rápido e evitar a necessidade de bancos de dados pesados.
* **📬 Formulário de Contato Integrado:** Mensagens enviadas pela página de Contato são roteadas pelo Apps Script e caem diretamente na caixa de entrada do Gmail do produtor.

## 🧠 Como Funciona a Arquitetura (Serverless & JAMstack)

A loja foi projetada para ter **Custo Zero** de infraestrutura, eliminando a necessidade de bancos de dados tradicionais (como SQL) e aluguel de servidores. A arquitetura se divide em três pilares:

1. **Frontend (A Vitrine):** Feito em HTML, CSS Vanilla e Javascript. O estado da aplicação (como os itens no Carrinho e os Beats Favoritados) é gerenciado integralmente no cliente via `localStorage`. Isso dispensa a necessidade de um sistema de Login/Cadastro, diminuindo o atrito na hora da compra.
2. **O Banco de Dados (Google Sheets):** O catálogo de beats (nomes, links do Drive, BPM, preços) é gerenciado através de uma simples Planilha do Google. O produtor só precisa adicionar uma nova linha na planilha para que a loja seja atualizada em tempo real.
3. **O Backend e Logística (Google Apps Script):** Toda a inteligência do servidor roda "por debaixo dos panos" na infraestrutura gratuita do Google:
   * Funciona como uma API que lê a planilha e entrega os dados para o Frontend.
   * **Automação de Entrega:** Quando um pagamento é aprovado, o Apps Script intercepta o evento, cria uma pasta no Google Drive do produtor (ex: *"Entrega: João"*), copia os arquivos WAV/MP3 e o Contrato de Licença em PDF para dentro dela, e envia automaticamente o link de acesso para o e-mail do cliente usando o serviço do Gmail.

---

## 🛠️ Tecnologias Utilizadas (Stack)

* **Frontend:** HTML5, CSS3 (Vanilla) e JavaScript (ES6+).
* **Backend (API Mockada / Integrações):** Google Apps Script (Javascript no lado do servidor) para roteamento de checkout e envio de e-mails.
* **Banco de Dados (Estoque de Beats):** Google Sheets (Lido através de API).
* **Hospedagem de Áudio:** Dropbox e Google Drive.
* **Deploy Frontend:** Vercel / GitHub Pages.

---

## 💻 Como Rodar o Projeto Localmente

Se você quiser baixar e testar a interface na sua máquina:

1. Clone o repositório:
```bash
git clone https://github.com/IwaataNz3/ozzi-weird-store.git
```
2. Entre na pasta:
```bash
cd ozzi-weird-store
```
3. Inicie um servidor local (você precisará do Node.js instalado):
```bash
npx serve -p 3000
```
4. Acesse `http://localhost:3000` no seu navegador.

---

## 👨‍💻 Autor

Desenvolvido por **Júlio Iwata**. 


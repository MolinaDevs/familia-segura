# Design System: Família Segura — "Azul Confiança"

Tirado do logo oficial (`artifacts/familia-segura/assets/brand/logo-original.png`): escudo azul-marinho, casa
conectada e uma família abraçada em azul e laranja, sobre fundo creme. Os valores vivem em
`artifacts/familia-segura/constants/colors.ts` e nos componentes `components/brand/*`, `components/Icon.tsx`,
`components/auth/AuthKit.tsx` e `components/ui.tsx`. Se este documento divergir do código, o código é a
verdade — e este documento deve ser corrigido.

## 1. Atmosfera

Confiável, acolhedor e transparente. Os pais abrem o app para resolver algo em segundos; a criança também
o vê, então nada de visual de vigilância. O azul-marinho do escudo passa segurança; o laranja da família
passa calor humano; o creme do fundo é a casa. Densidade de app do dia a dia, títulos à esquerda,
movimento curto e calmo.

## 2. Paleta e papéis

> **Tom claro é superfície. Nunca texto.** Todo par de texto foi medido: WCAG AA (≥ 4,5:1) contra o cartão e
> contra as três paradas do fundo, nos dois temas.

| Nome | Claro | Escuro | Papel |
|---|---|---|---|
| Creme (fundo) | `#FDFAF4 → #FCF8F0 → #EEF4FA` | `#0C1A2E → #0D1C31 → #12233D` | Fundo. O creme é o do logo; o azul entra só no pé |
| Cartão | `#FFFFFF` | `#13243D` | Cartões, formulários, barra de abas |
| Tinta | `#142B4D` | `#EAF1F9` | Texto principal |
| Tinta 2 | `#56657A` | `#9FB1C8` | Texto de apoio |
| **Azul do escudo (ação)** | `#1C5A96` | `#7DB6EC` | Botão principal, link, foco, item ativo, gráficos |
| Marinho | `#15457A` | `#9CCBF3` | Letreiro "FAMÍLIA SEGURA", ícones em bolha |
| **Laranja da família (assinatura)** | `#A14912` (texto) / `#F6A46E` (superfície) | `#F6A46E` | Selo, costura do formulário, linha de limite |
| Bolhas | azul `#E3EFFA`, pêssego `#FDEBDD`, menta `#E0F2E8`, sol `#FFF1D2` | tons escuros equivalentes | Fundo de ícone |
| Sucesso / Atenção / Perigo | `#1D7A52` / `#855700` / `#B8322F` | `#72D3A4` / `#F5C46A` / `#F08A83` | Estados |

**Divisão de trabalho:** azul é ação, laranja é assinatura. O selo laranja aparece no máximo uma vez por tela.

## 3. Tipografia

- **Títulos e letreiro:** Montserrat 700/800 — a mesma geometria em caixa alta do logo.
- **Texto e interface:** Nunito Sans 400–800 — neutra, amigável e legível em tamanho pequeno.
- **Banida:** Inter, fontes genéricas do sistema e serifas.
- Escala: título de tela 27/33, título de seção 19, corpo 15–16 (entrelinha ~1,5), rótulos 13–14, selo
  10,5–11,5 em caixa alta com espaçamento.

## 4. Marca

- **Emblema** (`assets/brand/emblem.png`, componentes `Emblem`, `BreathingEmblem` e `Logo`): o escudo com a
  casa e a família, recortado do logo, com fundo creme `#FCF8F0`. No tema claro ele se funde ao fundo; no
  escuro fica sobre uma placa creme arredondada (como um ícone de app). A vitrine das boas-vindas usa o
  mesmo creme para o emblema não mostrar "quadrado".
- **Assinatura:** emblema + "FAMÍLIA SEGURA" em Montserrat 800 marinho; linha de apoio "CONTROLE PARENTAL ·
  IPHONE E ANDROID".
- **Ícones do app:** emblema sobre creme (loja/iOS), adaptativo Android com fundo `#FCF8F0` e o emblema na zona
  segura; splash creme nos dois temas; tela de pausa nativa com `fs_brand_emblem.png`.
- **Fonte do logo:** o arquivo enviado tem 512 px. Para a loja, trocar por uma versão vetorial (SVG/PDF) ou
  ≥ 2048 px e regenerar `emblem.png` e os ícones.

## 5. Ícones

`components/Icon.tsx` (Phosphor). Padrão **duotone** (traço + preenchimento suave), como o escudo em dois
azuis; setas, fechar e marcar em **bold**; abas: **fill** quando ativa, **regular** quando não. Os nomes são
os mesmos que o app e o catálogo do servidor já usam — nome desconhecido cai num ícone genérico de app.
Ícone de conteúdo vai numa bolha colorida (44 px, raio 14) com o ícone em marinho.

## 6. Componentes

- **Botão principal:** azul cheio, raio 14–16, altura ≥ 54, Nunito Sans 800. Ao apertar: afunda de leve
  (`scale 0.98`).
- **Secundário:** contorno sobre cartão, ou só texto azul.
- **Cartão:** branco, raio 20–24, borda 1 px, sombra azul-marinho translúcida. Listas de valor usam divisórias.
- **Campo:** rótulo em cima, ícone à esquerda, foco = borda azul 2 px (sem contorno padrão do navegador), erro
  embaixo com ícone, dica opcional, senha com mostrar/ocultar.
- **Costura:** fio laranja no topo do formulário — marca uma abertura, não é moldura.
- **Chips e selos:** pílula. **Interruptor:** `Toggle` (trilho azul, botão branco).
- **Estado vazio:** ícone em bolha azul, título em Montserrat, orientação do que fazer.
- **Carregamento:** `BrandLoading` (emblema que respira + letreiro + barra deslizante). Spinner só dentro de botão.

## 7. Texto (copywriting)

- Fale com os pais em frases curtas e verbos concretos: "Limite o tempo de cada app", "Aprove os downloads".
- Com a criança, explique o porquê e o próximo passo, sem bronca: "Seu tempo de hoje em Roblox acabou.
  Amanhã recomeça — ou peça mais pelo Família Segura."
- Transparência é o diferencial: repita que a criança vê as mesmas regras.
- Proibido: jargão ("dispositivo vinculado"), clichês ("eleve", "revolucione", "sem esforço"), emojis, "role
  para explorar".

## 8. Movimento

- O emblema **respira** (sobe 3% e volta, ~3 s) na abertura e nos cabeçalhos de conta.
- Entrada em cascata que **move, não revela** (`translateY` sem `opacity: 0`).
- Tudo desliga com "reduzir movimento". Só `transform` e `opacity`.

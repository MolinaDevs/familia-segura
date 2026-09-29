# Design System: Família Segura — "Algodão & Mochi"

Herdado do conceito da loja Sensorial Squishy Kids (Squitch) e adaptado a um app de controle parental.
Os valores vivem em `artifacts/familia-segura/constants/colors.ts` (tokens) e nos componentes
`components/brand/*`, `components/auth/AuthKit.tsx` e `components/ui.tsx`. Se este documento divergir do
código, o código é a verdade — e este documento deve ser corrigido.

## 1. Atmosfera

Macio, confiável e sem vigilância. Um app que os pais abrem para resolver algo em segundos e que a criança
também vê — então nada de "painel de espionagem" escuro e frio. Densidade de app do dia a dia (4), variação
moderada com títulos à esquerda (6), movimento fluido e curto (5): **o squish** é a única assinatura de
movimento.

## 2. Paleta e papéis

> **Pastel é superfície. Nunca texto.** Cada acento tem uma forma clara (fundo, bolha, ícone) e uma forma
> profunda, a única que carrega texto, ícone de ação ou borda de foco.

| Nome | Claro | Escuro | Papel |
|---|---|---|---|
| Céu (topo → 62% → pé) | `#EFF8F2 → #E6F4EB → #F0ECFA` | `#16121F → #171722 → #1D1630` | Fundo. Verde de bebê é a casa; lilás é só nuance no pé |
| Algodão | `#FAFDFB` | `#201A2C` | Cartões, formulários, barra de abas |
| Tinta | `#2E2545` | `#EDE8F7` | Texto principal |
| Tinta 2 | `#675C80` | `#A99FBF` | Texto de apoio |
| **Lavanda (ação)** | `#6D3FD1` | `#B9A2FB` | Botão principal, link, foco, item ativo, gráfico |
| Lavanda clara | `#CDBDFB` / `#F2ECFB` | `#CDBDFB` / `#2A2140` | Costura, bolhas, avisos neutros |
| **Mochi (assinatura)** | `#C2185B` (texto) / `#FF8FA9` (superfície) | `#FF8FA9` | Selo, bochechas do mascote, linha de limite |
| Menta | `#0F7A66` (texto) / `#7FD8C3` | `#7FD8C3` | Sucesso, broto do mascote |
| Manteiga | `#87610A` (texto) / `#FFD97D` | `#FFD97D` | Atenção |
| Perigo | `#C32B41` | `#F58A9C` | Erro, bloqueio |

**Divisão de trabalho:** lavanda é ação, rosa é assinatura. Se os dois disputarem o mesmo papel, a cor vira
ruído. O selo rosa (`eyebrow`) aparece no máximo uma vez por tela.

**Contraste medido, não presumido:** todos os pares de texto acima passam WCAG AA (≥ 4,5:1) contra o
cartão e contra as três paradas do fundo, nos dois temas (menor valor: menta sobre o pé do céu, 4,53:1).
Cor nova só entra depois de medir.

## 3. Tipografia

- **Títulos e marca:** Fredoka 600 (500 em títulos de estado vazio). Arredondada e cheia, como a marca.
- **Texto e interface:** Nunito 400–800. Arredondada e legível em tamanho pequeno.
- **Banida:** Inter e fontes genéricas do sistema. Nada de serifa.
- Escala: título de tela 30/36, título de seção 19, corpo 15–16 com entrelinha 1,45–1,5, rótulos 13–14,
  selo 11 em caixa alta com espaçamento 1,6–2,6.

## 4. Marca

**O escudo squishy** (`assets/brand/mark.svg`, `components/brand/Logo.tsx`, `res/drawable/fs_brand_mark.xml`):
um escudo sem quinas (proteção), rosto sereno com olhos fechados e bochechas (cuidado, não vigilância) e um
broto (a criança crescendo). Os três arquivos são o mesmo desenho: ao mudar um, mude os três.

- Contorno, corpo e brilho vêm de `markInk`/`markBody`/`markShine`: no escuro o contorno fica claro.
- Versões: colorida, `mark-mono-ink.svg`, `mark-mono-cloud.svg`; assinaturas `logo-horizontal` e `logo-full`
  (com "CONTROLE PARENTAL" em mochi).
- Ícone do app: marca sobre o céu; ícone adaptativo Android com fundo `#E6F4EB` e a marca na zona segura.
- Respiro mínimo: a altura do broto. Nunca esticar em um eixo — o squish é animação, não licença para
  deformar a marca parada.

## 5. Componentes

- **Botão principal:** lavanda cheio, raio 16, altura ≥ 54, texto Nunito 800. Ao apertar: squish
  (`scaleX 1.02, scaleY 0.96`). Sem brilho externo.
- **Botão secundário:** contorno (`outline`) sobre algodão, ou "quieto" (só texto lavanda).
- **Cartão:** algodão, raio 24 (formulários e vitrines 28–36), borda 1 px, sombra verde translúcida. Usar só
  quando a elevação diz algo; listas de valor usam divisórias.
- **Campo:** rótulo em cima; ícone à esquerda; foco = borda lavanda de 2 px (sem o contorno padrão do
  navegador); erro em vermelho embaixo, com ícone; dica opcional embaixo; senha com mostrar/ocultar.
- **Costura:** fio lavanda na borda superior do formulário. Marca uma abertura, não é moldura.
- **Chips e selos:** pílula (raio 999).
- **Interruptor:** `Toggle` — trilho lavanda, botão algodão.
- **Carregamento:** a tela da marca (`BrandLoading`) com a barra deslizante; nada de spinner genérico em
  tela cheia. Spinner só dentro de botão ocupado.
- **Tela de pausa (Android nativo):** mesma paleta e mascote, cartão algodão, ação lavanda.

## 6. Layout

- Coluna única no celular; conteúdo limitado a 480 px (conta) e 560–760 px (app). Margem lateral 20.
- Títulos alinhados à esquerda. A única composição centralizada é a tela de abertura (marca + nome).
- Boas-vindas: vitrine com o mascote e os "combinados" reais do produto (não ilustração genérica), título,
  dois diferenciais em lista e as ações por último.
- Nada de três cartões iguais lado a lado.

## 7. Movimento

- **O squish:** achata e alarga, assenta com mola. Na marca, em loop lento (a cada ~2 s); em botões e
  cartões, no toque.
- Entrada em cascata que **move, não revela**: `translateY` sem `opacity: 0` — animação que não roda (aba em
  segundo plano) não pode esconder conteúdo.
- Tudo desliga com "reduzir movimento". Só `transform` e `opacity`.

## 8. Proibido

Emojis; Inter; preto puro; brilho neon; texto em tom pastel; gradiente em texto; três cartões iguais em
linha; spinner genérico em tela cheia; nomes genéricos ("João da Silva", "Acme"); números redondos
inventados; clichês ("eleve", "revolucione", "sem esforço"); "role para explorar", setas pulando.

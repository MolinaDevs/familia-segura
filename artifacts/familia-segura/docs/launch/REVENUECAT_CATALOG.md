# Catálogo de assinatura

## Fonte de verdade

RevenueCat é a única fonte de verdade para produtos, ofertas, preços e entitlement. O aplicativo consulta a oferta `default` em tempo real e nunca fixa preços no código.

## Identificadores

- Projeto: `Família Segura`
- Entitlement: `premium`
- Oferta atual: `default`
- Pacotes: `$rc_monthly` e `$rc_annual`
- iOS/Test Store: `familia_segura_premium_monthly` e `familia_segura_premium_annual`
- Google Play: assinatura `familia_segura_premium` com planos base `monthly` e `annual`

## Acesso

- `verified`: entitlement Premium confirmado pelo RevenueCat.
- `grace`: confirmação anterior mantida por até 72 horas durante falha temporária, nunca além da expiração informada pela loja.
- `basic` (plano grátis): todas as proteções; até 5 apps com limite, 2 rotinas, 7 dias de relatório, anúncio
  discreto no app do responsável. Ao sair do Premium nada é apagado: o que passa do limite continua valendo,
  só não dá para criar mais; a trava de tela fica guardada e volta com o Premium.

## Sugestão de preço (decisão do dono)

Benchmark (set/2026): Qustodio US$ 54,95–99,95/ano, OurPact US$ 6,99–9,99/mês, Norton US$ 49,99/ano,
Kaspersky ~US$ 28/ano, Family Link grátis. Proposta para o Brasil em `docs/COMERCIAL.md` (R$ 19,90/mês ou
R$ 149,90/ano, 7 dias grátis). O servidor não depende do preço — só do entitlement `premium`.

Os valores usados no Test Store são apenas para sandbox. Preços finais, testes gratuitos e promoções devem ser definidos nas lojas após pesquisa de mercado e aprovação do proprietário.
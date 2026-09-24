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
- `basic`: leitura e proteções já configuradas permanecem; alterações Premium de limites, bloqueios e rotinas ficam indisponíveis.

Os valores usados no Test Store são apenas para sandbox. Preços finais, testes gratuitos e promoções devem ser definidos nas lojas após pesquisa de mercado e aprovação do proprietário.
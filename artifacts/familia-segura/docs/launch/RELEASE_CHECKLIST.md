# Gate de lançamento

## Novo nesta versão (verificar antes do envio)

- [ ] `LEGAL_CONTROLLER_NAME`, `LEGAL_CONTROLLER_CNPJ`, `LEGAL_DPO_EMAIL` preenchidos na API de produção.
- [ ] Revisão jurídica da Política (`/api/legal/privacy`), Termos e RIPD (`docs/legal/RIPD_RASCUNHO.md`).
- [ ] Declarações Google Play: Accessibility (vídeo da divulgação), Device Admin, Data safety atualizado.
- [ ] Apple: privacy manifest (já em `app.json`), App Privacy conforme `STORE_PRIVACY_AND_RATINGS.md`.
- [ ] `eas init` feito (projectId no `app.json`) — necessário para push.
- [ ] Matriz de testes de `docs/TESTE_BETA.md` concluída (iPhone↔Android, 10 aparelhos, anti-desinstalação).
- [ ] CI verde, incluindo `android-native` e `ios-native`.

Itens marcados como externos não podem ser concluídos apenas no código.

## Comercial e jurídico

- [ ] Proprietário aprova preços finais mensal/anual após pesquisa de mercado.
- [ ] Proprietário confirma nome legal, canal de suporte e dados do controlador.
- [ ] Assessoria jurídica revisa Política de Privacidade e Termos.
- [ ] Contratos e políticas de Clerk, RevenueCat, Apple, Google e Replit são aceitos.
- [ ] Apple Small Business Program avaliado após ativação da conta Apple Developer.

## Contas e lojas

- [ ] Apple Developer e App Store Connect ativos.
- [ ] Google Play Console ativo e verificação concluída.
- [ ] Contratos bancários/fiscais e dados de pagamento preenchidos nas lojas.
- [ ] Produtos RevenueCat sincronizados com App Store Connect após o primeiro TestFlight.
- [ ] Assinatura e planos base criados na Google Play com os mesmos identificadores.
- [ ] URLs públicas de privacidade, termos, suporte e exclusão apontam para a implantação de produção.

## Build e assinatura

- [ ] Variáveis `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` e `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` disponíveis no ambiente de build de produção.
- [ ] `REVENUECAT_PROJECT_ID` e a conexão RevenueCat disponíveis na implantação da API.
- [ ] Apple Team ID adicionado à configuração Expo.
- [ ] Entitlement Family Controls aprovado para distribuição.
- [ ] Build iOS candidato enviado ao TestFlight pelo fluxo de publicação do Replit.
- [ ] Keystore Android de produção criado e armazenado fora do repositório.
- [ ] AAB Android release assinado e validado com Play App Signing.
- [ ] `version`/`buildNumber`/`versionCode` incrementados para cada candidato.

## Testes em aparelhos reais

- [ ] Compra mensal sandbox no iPhone.
- [ ] Compra anual sandbox no Android.
- [ ] Restauração após reinstalação e em segundo aparelho.
- [ ] Cancelamento, expiração e perda de acesso Premium.
- [ ] Falha temporária de verificação mantém a janela limitada de acesso.
- [ ] iOS: limite cruza enquanto o app permanece aberto.
- [ ] Android: limite e rotina iniciam enquanto o app permanece aberto.
- [ ] Reinício, modo offline por 72 horas, bateria e revogação do dispositivo.
- [ ] Exclusão remove a família e não cancela silenciosamente a assinatura.
- [ ] Links legais e suporte abrem no build de produção.

## Metadados

- [ ] Ícone revisado em 1024×1024 sem transparência indevida.
- [ ] Screenshots finais capturadas com preços reais e sem dados pessoais.
- [ ] Descrições, palavras-chave e notas de revisão inseridas.
- [ ] Apple App Privacy e Google Data Safety conferidos contra o build.
- [ ] Classificação etária concluída nas duas lojas.
- [ ] Testadores e instruções privadas adicionados.

## Liberação

- [ ] Monitoramento de API e suporte acompanhados durante lançamento gradual.
- [ ] Critério de rollback definido para falhas de compra ou proteção.
- [ ] Lançamento gradual aprovado pelo proprietário.
- [ ] Google Play permanece preparado para envio externo; não há upload automatizado pelo Replit.
# App Store Connect — preenchimento passo a passo

Respostas prontas para a Apple. Os textos da ficha estão em `STORE_LISTING_PT_BR.md`; as imagens, em
`store-assets/` (as capturas 1290×2796 servem para o tamanho 6,7"; a Apple reaproveita para os demais).

## 0. Antes de tudo: autorização Family Controls

Sem ela não há TestFlight nem App Store. Pedir em
`https://developer.apple.com/contact/request/family-controls-distribution` (conta da empresa, "Account Holder").
É preciso pedir para **4 identificadores**: o app e as 3 extensões.

| Bundle ID | O que é |
|---|---|
| `com.familiasegura.app` | App |
| `com.familiasegura.app.ActivityMonitorExtension` | Extensão de monitoramento (DeviceActivity) |
| `com.familiasegura.app.ShieldAction` | Ação da tela de bloqueio |
| `com.familiasegura.app.ShieldConfiguration` | Aparência da tela de bloqueio |

(Conferir os sufixos gerados em `targets/` depois do primeiro `expo prebuild` no iOS.)

Texto para o campo de justificativa (colar):

> Família Segura is a parental control app for families in Brazil, aligned with the Brazilian child online
> protection law (ECA Digital, Law 15.211/2025) and the LGPD. A parent creates the family in the app and pairs
> the child's iPhone or iPad. On the child's device, the app requests FamilyControls authorization for a child
> (the child must be in the parent's Family Sharing group and the parent approves with their Apple ID). We use
> ManagedSettings to shield the apps and categories the parent selected with FamilyActivityPicker, to apply
> schedules (bedtime, school) and to deny app installation and app removal until the parent allows it; and
> DeviceActivity to enforce daily time limits and schedules on the device. Usage stays on the device: only
> aggregated minute thresholds per rule are sent to our server so the parent can see reports. The child always
> sees which rules are active and can request more time. We do not read messages, photos, browsing history or
> location, and the child's device never shows ads.

## 1. Informações do app

| Campo | Resposta |
|---|---|
| Nome | Família Segura: Controle Parental |
| Subtítulo | Tempo de tela e apps sob controle |
| Idioma principal | Português (Brasil) |
| Bundle ID | `com.familiasegura.app` |
| SKU | `familia-segura-ios` |
| Categoria principal / secundária | Estilo de vida / Educação |
| Direitos de conteúdo | Não contém conteúdo de terceiros |
| URL da Política de Privacidade | `https://familia-segura-api.onrender.com/api/legal/privacy` |
| URL de suporte | `https://familia-segura-api.onrender.com/api/legal/support` |

## 2. Classificação etária (questionário)

Tudo **Nenhum/Não**: violência, conteúdo sexual, linguagem, drogas, terror, jogos de azar, concursos, acesso
irrestrito à web, conteúdo gerado por usuários. "Controles parentais" → **Sim**. Resultado esperado: **4+**.
Feito para crianças (Kids Category): **Não** — o app é para o responsável.

## 3. Privacidade do app (App Privacy)

Rastreamento: **Não** (sem ATT; anúncios não personalizados).

| Tipo de dado | Coletado | Vinculado ao usuário | Finalidade |
|---|---|---|---|
| Informações de contato → Nome | Sim | Sim | Funcionalidade do app |
| Informações de contato → E-mail | Sim | Sim | Funcionalidade do app (login) |
| Identificadores → ID do usuário | Sim | Sim | Funcionalidade do app |
| Identificadores → ID do dispositivo | Sim | Sim | Funcionalidade do app; Publicidade de terceiros (AdMob, plano grátis) |
| Compras → Histórico de compras | Sim | Sim | Funcionalidade do app |
| Dados de uso → Interações com o produto | Sim | Sim | Funcionalidade do app (tempo por app, pedidos); Publicidade de terceiros (interação com o anúncio) |
| Diagnóstico → Dados de falhas | Sim | Não | Funcionalidade do app (correção de erros) |
| Diagnóstico → Dados de desempenho / outros | Sim | Não | Funcionalidade do app |

Não coletados: localização, contatos, fotos, áudio, mensagens, histórico de navegação e de buscas, dados
sensíveis, saúde, informações financeiras além da compra.

## 4. Conformidade de exportação

"O app usa criptografia?" → só a padrão do sistema (HTTPS). `ITSAppUsesNonExemptEncryption = false` já está no
build: a pergunta não aparece a cada envio.

## 5. Assinaturas (Monetização → Assinaturas)

- Grupo: `Família Segura Premium`.
- Produtos: `familia_segura_premium_monthly` (1 mês) e `familia_segura_premium_annual` (1 ano), com nome e
  descrição em pt-BR, preço e eventual teste grátis (decisão do dono).
- Captura de tela para revisão da assinatura: a tela de planos do app.
- RevenueCat: App Store Connect API → **In-App Purchase Key** (.p8, Key ID, Issuer ID) em Project settings →
  Apps → Família Segura iOS (o painel da RevenueCat já avisa que falta).
- Contrato "Apps pagos", dados bancários e fiscais preenchidos (sem isso as compras não funcionam nem em teste).

## 6. Informações para a revisão (App Review Information)

- Conta de demonstração: usuário e senha da **conta de revisão** (responsável com família pronta e PIN definido).
- Notas: colar o texto em inglês de `REVIEW_NOTES.md`. Acrescentar: "Two devices are needed to see rules being
  enforced: sign in on device A with the demo account, generate a pairing code in Família → Parear, and on
  device B choose 'Este é o celular do seu filho?' on the first screen. Device B must be signed in to iCloud as
  a child in Family Sharing to grant Screen Time authorization."
- Contato: nome, telefone e e-mail de quem responde à Apple.

## 7. Envio

1. Build pelo EAS (`eas build -p ios --profile production`) e envio (`eas submit -p ios`): ver `SO_VOCE_FAZ.md`.
2. TestFlight: grupo interno (equipe) e depois grupo externo (famílias do beta) — o primeiro build externo passa
   por uma revisão rápida.
3. Com o beta aprovado: adicionar o build à versão 1.0, enviar para revisão, lançamento manual.

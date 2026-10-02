# Instruções para revisão das lojas

## Conta de revisão

Criar uma conta de responsável exclusiva para revisão, com família de demonstração, **PIN definido** e sem dados
reais. Registrar usuário, senha e o PIN no campo privado da loja ("App Review Information" / "Instruções de
acesso"), nunca neste repositório. Se possível, deixar um aparelho de teste já pareado.

## Texto sugerido para o campo de notas (colar e ajustar)

> Família Segura is a parental-control app. The parent app (sign in with the demo account) manages children,
> devices, app limits, schedules and approvals. The child device is set up by choosing "Este é o celular do seu filho?" on the first screen and entering a pairing code generated in the parent app
> (Família → Aparelhos → Parear). Guardian PIN for protected actions on the child device: see private field.
> The child always sees which rules are active and what data is shared; emergency calls are never blocked.

## Fluxo principal

1. Entrar como responsável (conta de revisão).
2. Família → Parear aparelho → gerar código.
3. Em outro aparelho: primeira tela → "Este é o celular do seu filho?" → informar o código.
4. No aparelho da criança: Área do responsável (PIN) → Configurar a proteção → conceder permissões.
5. No responsável: Apps → Adicionar app → escolher um app e um limite; Rotina → Nova rotina.
6. No aparelho da criança: conferir as regras visíveis e fazer "Pedir mais tempo".
7. No responsável: Home → aprovar o pedido ("Liberar hoje"); Relatórios → gráficos.

## Assinatura

- Família → Premium: planos mensal e anual da oferta atual da loja; compra com conta sandbox.
- Restaurar compra no segundo aparelho; "Gerenciar assinatura" abre a loja.
- Após expirar, nada é apagado nem desbloqueado; só não é possível adicionar crianças, aparelhos, apps com
  limite ou rotinas além do plano grátis. A trava de tela (Android) fica guardada e para de valer.
- Plano grátis mostra um banner não personalizado só no app do responsável (fim de Relatórios e Apps). O modo
  criança (aparelho pareado) nunca mostra anúncios nem inicializa o SDK.

## Google Play — declarações

- **AccessibilityService** (uso: controle parental): identifica o app em primeiro plano para aplicar limites,
  bloqueios e rotinas; nas telas de Configurações/instalador verifica apenas se tratam de desligar ou
  desinstalar o Família Segura ou apps, para exigir o PIN do responsável. Não lê mensagens, senhas nem o que é
  digitado. Divulgação proeminente exibida antes de abrir as configurações (gravar vídeo dela).
- **Device Admin**: política `force-lock` (travar a tela na rotina de dormir) e, por estar ativo, impede
  desinstalar o app sem o PIN do responsável. Nenhuma outra política (apagar dados, senha, câmera) é usada.
- **Package visibility**: `<queries>` com LAUNCHER; **não** usamos `QUERY_ALL_PACKAGES`.
- **Usage access** (`PACKAGE_USAGE_STATS`): tempo por app para limites e relatórios.
- Público-alvo: adultos (responsáveis). O modo criança só funciona após pareamento feito por um adulto.

## Apple — observações

- Family Controls (Distribution) aprovado para o app e as 3 extensões; autorização do tipo **child**
  (a criança precisa estar no Compartilhamento Familiar).
- ManagedSettings usados: bloqueio por app/categoria, rotinas, `denyAppRemoval`, `denyAppInstallation`,
  filtro de conteúdo adulto. Nenhum dado de uso sai do aparelho além de faixas agregadas de minutos.
- Para revisar a aplicação real das regras são necessários dois aparelhos (responsável e criança).

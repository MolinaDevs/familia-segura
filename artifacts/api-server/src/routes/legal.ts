import { Router, type IRouter, type Response } from "express";

const router: IRouter = Router();
const updatedAt = "1º de outubro de 2026";

type LegalPage = {
  title: string;
  summary: string;
  sections: Array<{ title: string; body: string }>;
};

// Dados do controlador vêm do ambiente (preencher antes de publicar nas lojas).
const controller = process.env.LEGAL_CONTROLLER_NAME ?? "[razão social a definir]";
const controllerId = process.env.LEGAL_CONTROLLER_CNPJ ?? "[CNPJ a definir]";
const dpoEmail = process.env.LEGAL_DPO_EMAIL ?? "[e-mail do encarregado a definir]";
// Canal de atendimento mostrado em Suporte e Exclusão (exigência das lojas); sem valor próprio, usa o do encarregado.
const supportEmail = process.env.LEGAL_SUPPORT_EMAIL ?? dpoEmail;

const pages: Record<string, LegalPage> = {
  privacy: {
    title: "Política de Privacidade",
    summary: "Como o Família Segura trata dados de responsáveis, crianças e adolescentes e de seus aparelhos, conforme a LGPD (Lei 13.709/2018) e o ECA Digital (Lei 15.211/2025).",
    sections: [
      {
        title: "Quem somos",
        body: `O Família Segura é operado por ${controller} (${controllerId}), controladora dos dados. Encarregado pelo tratamento de dados (DPO): ${dpoEmail}.`,
      },
      {
        title: "Para que serve",
        body: "O aplicativo permite que responsáveis legais definam limites de tempo, bloqueios, rotinas e permissões de instalação e remoção de aplicativos nos aparelhos de crianças e adolescentes, com transparência para quem é acompanhado. Os dados são tratados somente para essa finalidade.",
      },
      {
        title: "Dados tratados",
        body: "Do responsável: nome de exibição, identificador de conta, e-mail (pelo provedor de login), papel na família e tokens de notificação. Da criança ou adolescente: nome ou apelido, ano de nascimento e cor de identificação. Dos aparelhos: plataforma, modelo, versão do sistema, fuso horário, nível de bateria, estado da proteção e credencial própria do aparelho (guardada apenas como hash). De uso: minutos por aplicativo por dia e por hora; no Android, a lista de apps instalados (nome e identificador do pacote) e eventos como instalação, remoção, reinício e tentativas de desligar a proteção. Também: regras, rotinas, pedidos de tempo, liberações e registros de auditoria.",
      },
      {
        title: "O que não tratamos",
        body: "Não lemos mensagens, fotos, contatos, histórico de navegação, senhas, o que é digitado nem o conteúdo das telas. Não coletamos localização. No Android, o serviço de acessibilidade identifica somente qual aplicativo está aberto e, nas telas de configurações, apenas se elas se referem ao Família Segura ou a desinstalar e instalar apps, para impedir que a proteção seja desligada. No iPhone, a Apple não informa ao aplicativo quais apps estão instalados; os apps escolhidos ficam somente no aparelho.",
      },
      {
        title: "Base legal e consentimento (LGPD art. 14)",
        body: "O tratamento de dados de crianças é feito no seu melhor interesse, com o consentimento específico e em destaque de pelo menos um dos pais ou do responsável legal, dado no cadastro da família. Dados de adolescentes seguem o mesmo cuidado. O consentimento pode ser revogado a qualquer momento, com a exclusão da família.",
      },
      {
        title: "Transparência para a criança",
        body: "O aplicativo instalado no aparelho da criança mostra quais regras e rotinas estão ativas e quais dados são compartilhados com a família, em linguagem simples. Não há monitoramento oculto.",
      },
      {
        title: "Anúncios: só para o responsável e sem perfilamento",
        body: "No plano grátis, o app do responsável (adulto) mostra um banner não personalizado do Google AdMob no fim de algumas telas, com classificação de conteúdo livre. O aparelho da criança nunca mostra anúncios nem inicializa o serviço de anúncios. Não vendemos dados, não criamos perfis comportamentais para fins comerciais e não usamos dados de crianças e adolescentes para publicidade, em linha com o ECA Digital. No Premium não há anúncios.",
      },
      {
        title: "Com quem compartilhamos",
        body: "Apenas com operadores necessários ao serviço: provedor de autenticação (Clerk), gestão de assinaturas (RevenueCat, Apple e Google), envio de notificações (Expo e Google Firebase Cloud Messaging), diagnóstico de erros e travamentos do aplicativo e do servidor, sem conteúdo das telas nem dados pessoais (Sentry), anúncios não personalizados no app do responsável no plano grátis (Google AdMob) e infraestrutura de hospedagem e banco de dados (Render, nos Estados Unidos). Cada um trata só o necessário à sua função. Há transferência internacional de dados para esses prestadores, com as salvaguardas contratuais previstas na LGPD.",
      },
      {
        title: "Retenção",
        body: "Dados de uso por hora e por dia, eventos dos aparelhos, pedidos de tempo e o histórico de atividades são mantidos por até 12 meses e depois apagados automaticamente. Cadastro da família, crianças, aparelhos, regras e rotinas permanecem enquanto a família existir. Ao excluir a família, os dados são removidos do serviço, ressalvadas cópias técnicas temporárias de segurança.",
      },
      {
        title: "Segurança",
        body: "Conexões criptografadas, credenciais de aparelho e códigos de pareamento guardados apenas como hash, PIN do responsável protegido com scrypt, limites de tentativas e registro de auditoria das alterações.",
      },
      {
        title: "Seus direitos",
        body: `Confirmação e acesso, correção, portabilidade (exportação em Família > Privacidade), anonimização ou eliminação, informação sobre compartilhamentos e revogação do consentimento. Pedidos também podem ser enviados ao encarregado (${dpoEmail}). Você pode reclamar à ANPD.`,
      },
      {
        title: "Alterações",
        body: "Mudanças relevantes serão avisadas no aplicativo e publicadas nesta página com a data de atualização. Quando a mudança exigir, pediremos novo consentimento.",
      },
    ],
  },
  crianca: {
    title: "Para você que usa o aparelho",
    summary: "Explicação simples do que o Família Segura faz no seu celular ou tablet.",
    sections: [
      { title: "O que é", body: "É um aplicativo que sua família usa para combinar quanto tempo você fica em cada app e em quais horários o celular descansa, como na hora de dormir e na escola." },
      { title: "O que sua família vê", body: "Quanto tempo você usou cada aplicativo, quais apps estão instalados (no Android) e se a proteção está ligada. Eles não veem suas mensagens, fotos, conversas nem o que você escreve." },
      { title: "Você pode pedir mais tempo", body: "No próprio aplicativo existe o botão Pedir mais tempo. Sua família recebe o pedido e responde." },
      { title: "Ligações de emergência", body: "Telefone e emergência nunca são bloqueados, nem durante as pausas." },
      { title: "Dúvidas", body: "Converse com sua família sobre as regras. Elas podem mudar conforme você cresce." },
    ],
  },
  terms: {
    title: "Termos de Uso",
    summary: "Condições para usar o Família Segura e os recursos de assinatura.",
    sections: [
      {
        title: "Uso responsável",
        body: "O serviço é destinado a responsáveis legais que desejam orientar o uso digital de crianças. O responsável deve explicar as regras, respeitar a legislação aplicável e não usar o aplicativo para vigilância secreta, assédio ou controle de terceiros sem autorização.",
      },
      {
        title: "Conta e dispositivos",
        body: "O responsável protege sua conta e autoriza cada dispositivo por pareamento. Dispositivos perdidos ou sem autorização devem ser removidos no perfil. A proteção depende das permissões oferecidas por iOS ou Android e pode ser afetada por configurações do aparelho.",
      },
      {
        title: "Assinatura",
        body: "Planos, moedas, períodos, renovações e eventuais testes são apresentados pela App Store ou Google Play antes da compra. A cobrança e o cancelamento são administrados pela loja da plataforma. Restaurar compras recompõe o acesso quando a loja confirma o mesmo titular.",
      },
      {
        title: "Acesso básico e expiração",
        body: "Quando a assinatura termina, o aplicativo retorna ao acesso básico. Regras já salvas não são apagadas automaticamente. Em falhas temporárias de verificação, o acesso Premium confirmado pode permanecer por um período limitado para evitar interrupções indevidas.",
      },
      {
        title: "Proteção dos aparelhos e PIN",
        body: "O responsável pode bloquear a instalação e a remoção de aplicativos e impedir que a proteção seja desligada no aparelho da criança; essas ações ficam liberáveis somente com o PIN do responsável. O PIN é pessoal: não o compartilhe com a criança. Telefone e emergência nunca são bloqueados.",
      },
      {
        title: "Limitações",
        body: "O Família Segura reduz riscos, mas não garante bloqueio absoluto, segurança física, aprovação pelas lojas ou funcionamento ininterrupto. Atualizações do sistema, permissões revogadas, falta de conexão e restrições do fabricante podem limitar recursos.",
      },
      {
        title: "Encerramento",
        body: "O responsável pode cancelar a renovação nas configurações da loja e excluir os dados da família no aplicativo. Violações destes termos podem resultar em suspensão, preservados os direitos legais aplicáveis.",
      },
    ],
  },
  support: {
    title: "Suporte",
    summary: "Orientações para assinatura, proteção, dados e acesso à conta.",
    sections: [
      {
        title: "Fale conosco",
        body: `Escreva para ${supportEmail}. Respondemos em até 2 dias úteis. Para pedidos sobre dados pessoais (acesso, correção, exclusão), o mesmo canal atende em nome do encarregado.`,
      },
      {
        title: "Assinatura e cobrança",
        body: "Use Configurações > Família Segura Premium para restaurar compras ou abrir o gerenciamento da assinatura na loja. Reembolsos e cobranças são analisados pela App Store ou Google Play, conforme a plataforma da compra.",
      },
      {
        title: "Proteção no dispositivo",
        body: "No aparelho da criança, abra Área do responsável (com o PIN) e Configurar a proteção. No Android, revise Acesso ao uso, Serviço de proteção, Proteção contra desinstalação e bateria. No iPhone, revise a autorização do Tempo de Uso e a associação dos apps de cada regra.",
      },
      {
        title: "Conta e dados",
        body: "Em Família, o responsável pode exportar os dados, gerenciar aparelhos e excluir a família. Para recuperar acesso, use o mesmo método de entrada adotado no cadastro. Esqueceu o PIN? Defina um novo em Família > Configurações; ele vale nos aparelhos após a próxima sincronização.",
      },
      {
        title: "Antes de solicitar ajuda",
        body: "Anote a versão do aplicativo, modelo do aparelho, versão do sistema e o horário aproximado do problema. Não envie senhas, códigos de pareamento, tokens ou informações de pagamento.",
      },
    ],
  },
  "delete-account": {
    title: "Exclusão de Conta e Dados",
    summary: "Como apagar permanentemente os dados da família.",
    sections: [
      {
        title: "Pelo aplicativo",
        body: "Entre na conta do titular, abra Família > Privacidade e toque em Excluir família e dados. Confirme a ação. A família, perfis infantis, dispositivos, regras, rotinas, pedidos, consentimentos e registros associados são removidos do serviço.",
      },
      {
        title: "Assinatura",
        body: "Excluir a conta não cancela automaticamente uma assinatura da App Store ou Google Play. Cancele a renovação na loja (Família > Premium > Gerenciar assinatura). Antes de excluir, desvincule os aparelhos das crianças pela Área do responsável para remover a proteção contra desinstalação.",
      },
      {
        title: "Sem o aplicativo",
        body: `Se você não tem mais o app instalado, envie um e-mail para ${supportEmail} a partir do endereço usado na conta, com o assunto "Excluir minha conta". Confirmamos a titularidade e apagamos a conta e os dados da família em até 15 dias, avisando por e-mail quando concluir.`,
      },
      {
        title: "O que pode permanecer",
        body: "As lojas podem conservar comprovantes de transação conforme obrigações próprias. Cópias técnicas temporárias podem persistir pelo prazo estritamente necessário para segurança e recuperação, sem uso operacional posterior.",
      },
      {
        title: "Sem acesso ao aplicativo",
        body: "Recupere primeiro o acesso com o mesmo método de entrada utilizado no cadastro. A exclusão exige autenticação para impedir que terceiros apaguem os dados da família.",
      },
    ],
  },
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]!);
}

function renderPage(page: LegalPage) {
  const sections = page.sections.map((section) => `
    <section>
      <h2>${escapeHtml(section.title)}</h2>
      <p>${escapeHtml(section.body)}</p>
    </section>`).join("");
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(page.title)} | Família Segura</title>
  <meta name="description" content="${escapeHtml(page.summary)}">
  <style>
    :root{color-scheme:light dark;font-family:Inter,system-ui,-apple-system,sans-serif;background:#f9f9f7;color:#1f2a37}
    body{margin:0}.shell{max-width:760px;margin:auto;padding:48px 22px 80px}
    nav{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:44px}a{color:#2a5a4a;font-weight:650}
    .brand{font-size:14px;letter-spacing:.04em;text-transform:uppercase;color:#667085;margin-bottom:10px}
    h1{font-size:clamp(34px,8vw,54px);line-height:1.02;letter-spacing:-.04em;margin:0 0 18px}
    .lead{font-size:18px;line-height:1.6;color:#52606d;margin-bottom:42px}
    section{padding:24px 0;border-top:1px solid #dfe3df}h2{font-size:20px;margin:0 0 10px}
    p{font-size:15px;line-height:1.75;margin:0;color:#3f4b56}
    footer{margin-top:38px;font-size:13px;color:#667085}
    @media(prefers-color-scheme:dark){:root{background:#101821;color:#f7f4ed}.lead,p{color:#bcc5ce}section{border-color:#2d3742}a{color:#8cc7ae}}
  </style>
</head>
<body><main class="shell">
  <div class="brand">Família Segura</div>
  <nav>
    <a href="./privacy">Privacidade</a><a href="./terms">Termos</a>
    <a href="./support">Suporte</a><a href="./delete-account">Exclusão</a><a href="./crianca">Para a criança</a>
  </nav>
  <h1>${escapeHtml(page.title)}</h1>
  <p class="lead">${escapeHtml(page.summary)}</p>
  ${sections}
  <footer>Última atualização: ${updatedAt}. Família Segura.</footer>
</main></body></html>`;
}

router.get("/legal/:document", (req, res: Response): void => {
  // Só documentos próprios do objeto: "__proto__"/"constructor" não viram página (nem erro 500).
  const page = Object.hasOwn(pages, req.params.document) ? pages[req.params.document] : undefined;
  if (!page) {
    res.status(404).type("text/plain").send("Documento não encontrado");
    return;
  }
  res
    .set("Cache-Control", "public, max-age=300")
    .set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'")
    .type("html")
    .send(renderPage(page));
});

export default router;
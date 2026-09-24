import { Router, type IRouter, type Response } from "express";

const router: IRouter = Router();
const updatedAt = "21 de setembro de 2026";

type LegalPage = {
  title: string;
  summary: string;
  sections: Array<{ title: string; body: string }>;
};

const pages: Record<string, LegalPage> = {
  privacy: {
    title: "Política de Privacidade",
    summary: "Como o Família Segura trata dados de responsáveis, crianças e dispositivos.",
    sections: [
      {
        title: "Quem somos e finalidade",
        body: "O Família Segura ajuda responsáveis a combinar e aplicar limites de uso de aplicativos. Tratamos dados apenas para autenticar a família, vincular dispositivos, mostrar uso permitido pelo sistema, aplicar regras, processar solicitações de tempo e manter a assinatura.",
      },
      {
        title: "Dados tratados",
        body: "Podemos tratar nome de exibição do responsável, nome e ano de nascimento da criança, identificadores da família e dos dispositivos, plataforma, estado da proteção, regras, rotinas, totais de tempo dos aplicativos configurados, solicitações de tempo, registros de auditoria e informações de assinatura. Não lemos mensagens, senhas, teclas digitadas, fotos, contatos nem o conteúdo da tela.",
      },
      {
        title: "Serviços essenciais",
        body: "Usamos Clerk para autenticação, RevenueCat e as lojas Apple/Google para compras e assinaturas, e infraestrutura Replit para operar a API e o banco de dados. Cada fornecedor trata apenas os dados necessários à sua função e segue seus próprios termos.",
      },
      {
        title: "Crianças e consentimento",
        body: "A conta é criada e administrada por um responsável. O aplicativo informa à criança quais regras estão ativas e quais dados de uso são compartilhados. O responsável deve manter o consentimento adequado e usar o serviço de forma proporcional à idade.",
      },
      {
        title: "Retenção, segurança e direitos",
        body: "Dados da família permanecem enquanto a conta estiver ativa e podem ser removidos pelo responsável no aplicativo. Credenciais de dispositivos são armazenadas de forma protegida e podem ser revogadas. O responsável pode acessar, exportar, corrigir ou excluir os dados da família pelas opções disponíveis no perfil.",
      },
      {
        title: "Alterações",
        body: "Mudanças relevantes nesta política serão comunicadas no aplicativo e publicadas nesta página com a respectiva data de atualização.",
      },
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
        title: "Assinatura e cobrança",
        body: "Use Configurações > Família Segura Premium para restaurar compras ou abrir o gerenciamento da assinatura na loja. Reembolsos e cobranças são analisados pela App Store ou Google Play, conforme a plataforma da compra.",
      },
      {
        title: "Proteção no dispositivo",
        body: "Confirme no aparelho da criança se as permissões de uso e proteção estão ativas. No Android, revise Acesso ao uso, Serviço de proteção e bateria. No iPhone, revise a autorização de Controle Familiar.",
      },
      {
        title: "Conta e dados",
        body: "Em Perfil, o responsável pode exportar os dados, remover dispositivos e excluir a família. Para recuperar acesso, use o mesmo método de entrada adotado no cadastro.",
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
        body: "Entre na conta do responsável, abra Perfil e toque em Excluir Família. Confirme a ação. A família, perfis infantis, dispositivos, regras, rotinas, pedidos, consentimentos e registros associados são removidos do serviço.",
      },
      {
        title: "Assinatura",
        body: "Excluir a conta não cancela automaticamente uma assinatura da App Store ou Google Play. Cancele a renovação em Configurações > Família Segura Premium > Gerenciar assinatura.",
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
    :root{color-scheme:light dark;font-family:Inter,system-ui,-apple-system,sans-serif;background:#f8f7f3;color:#17202a}
    body{margin:0}.shell{max-width:760px;margin:auto;padding:48px 22px 80px}
    nav{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:44px}a{color:#c94e42;font-weight:650}
    .brand{font-size:14px;letter-spacing:.04em;text-transform:uppercase;color:#667085;margin-bottom:10px}
    h1{font-size:clamp(34px,8vw,54px);line-height:1.02;letter-spacing:-.04em;margin:0 0 18px}
    .lead{font-size:18px;line-height:1.6;color:#52606d;margin-bottom:42px}
    section{padding:24px 0;border-top:1px solid #dfe3df}h2{font-size:20px;margin:0 0 10px}
    p{font-size:15px;line-height:1.75;margin:0;color:#3f4b56}
    footer{margin-top:38px;font-size:13px;color:#667085}
    @media(prefers-color-scheme:dark){:root{background:#101821;color:#f7f4ed}.lead,p{color:#bcc5ce}section{border-color:#2d3742}a{color:#ff8b7d}}
  </style>
</head>
<body><main class="shell">
  <div class="brand">Família Segura</div>
  <nav>
    <a href="./privacy">Privacidade</a><a href="./terms">Termos</a>
    <a href="./support">Suporte</a><a href="./delete-account">Exclusão</a>
  </nav>
  <h1>${escapeHtml(page.title)}</h1>
  <p class="lead">${escapeHtml(page.summary)}</p>
  ${sections}
  <footer>Última atualização: ${updatedAt}. Família Segura.</footer>
</main></body></html>`;
}

router.get("/legal/:document", (req, res: Response): void => {
  const page = pages[req.params.document];
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
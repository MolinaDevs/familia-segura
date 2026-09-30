/**
 * Mensagens do Clerk vêm em inglês e às vezes revelam demais. Aqui viram português claro, pelo código do erro.
 * Login: "e-mail não cadastrado" e "senha errada" têm a mesma resposta (não confirma quem tem conta).
 */
type ClerkLikeError = {
  code?: string;
  message?: string;
  longMessage?: string;
  errors?: Array<{ code?: string; message?: string; longMessage?: string; meta?: { paramName?: string } }>;
};

const MESSAGES: Record<string, string> = {
  form_password_incorrect: 'E-mail ou senha não conferem.',
  form_identifier_not_found: 'E-mail ou senha não conferem.',
  form_identifier_exists: 'Já existe uma conta com este e-mail. Entre com ele ou recupere a senha.',
  form_password_pwned: 'Essa senha apareceu em vazamentos na internet. Escolha outra, só sua.',
  form_password_length_too_short: 'A senha precisa ter pelo menos 8 caracteres.',
  form_password_not_strong_enough: 'Senha fraca. Misture letras, números e símbolos.',
  form_password_validation_failed: 'Senha fraca. Misture letras, números e símbolos.',
  form_param_format_invalid: 'Confira o e-mail: parece faltar algo.',
  form_param_nil: 'Preencha todos os campos.',
  form_code_incorrect: 'Código incorreto. Confira e tente de novo.',
  form_code_expired: 'Este código expirou. Peça um novo.',
  verification_expired: 'Este código expirou. Peça um novo.',
  verification_failed: 'Não deu para confirmar. Peça um novo código.',
  too_many_requests: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  user_locked: 'Conta bloqueada temporariamente por muitas tentativas. Tente de novo mais tarde.',
  session_exists: 'Você já está conectado. Feche e abra o app.',
  strategy_for_user_invalid: 'Esta conta foi criada com Google ou Apple. Use o mesmo botão para entrar.',
  identification_deleted: 'Esta conta foi excluída.',
  captcha_invalid: 'Não conseguimos confirmar que você é uma pessoa. Tente de novo.',
  network_error: 'Sem conexão. Verifique a internet e tente de novo.',
};

export function clerkErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const value = error as ClerkLikeError;
  const code = value.errors?.[0]?.code ?? value.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  // Sem código conhecido: melhor a mensagem genérica em português que o texto técnico em inglês.
  if (error instanceof TypeError || /network|fetch|timeout/i.test(value.message ?? '')) return MESSAGES.network_error;
  return fallback;
}

/** Erro de um campo (errors.fields.*) do Clerk, em português. */
export const clerkFieldError = (error: unknown) => (error ? clerkErrorMessage(error, 'Confira este campo.') : undefined);

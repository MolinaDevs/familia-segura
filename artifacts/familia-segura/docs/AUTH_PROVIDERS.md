# Provedores de acesso

O Família Segura usa a instância Clerk gerenciada pelo Replit. Desenvolvimento e produção possuem usuários e configurações separados.

## Habilitar Google e Apple

1. Abra **Auth** no editor do projeto.
2. Entre em **Configure > SSO providers**.
3. Selecione **Development** e habilite Google e Apple para o ambiente de desenvolvimento.
4. Selecione **Production** e repita a configuração antes de publicar.
5. Para Apple, registre o aplicativo no Apple Developer e siga os domínios e URLs de retorno exibidos em **Provider setup** no próprio painel Auth.
6. Se forem usadas credenciais OAuth próprias, configure-as separadamente em cada ambiente.

Os botões continuam visíveis quando um provedor está desabilitado para informar claramente que ele ainda precisa ser habilitado. Nenhuma credencial OAuth deve ser adicionada ao código ou a este documento.

## Retornos OAuth

- Scheme nativo: `familia-segura`
- Caminho de retorno: `oauth-callback`
- URI é construída em execução com `AuthSession.makeRedirectUri`.
- Web usa a origem atual; builds nativas retornam pelo scheme registrado em `app.json`.

## Verificação antes do lançamento

- Criar uma conta nova com Google e outra com Apple em Development.
- Cancelar cada fluxo e confirmar a mensagem de cancelamento.
- Desabilitar temporariamente um provedor e confirmar a mensagem de indisponibilidade.
- Repetir em Production com contas que não existam no ambiente Development.
- Confirmar o retorno para onboarding em contas novas e para o painel em contas com família existente.
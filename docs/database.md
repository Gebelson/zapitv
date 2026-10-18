# Banco de dados do ZapiTV

## Estado atual e estratégia

Em 16/10/2026, o projeto usava Dexie/IndexedDB para catálogo local e preferências, Firebase Auth/Firestore para parte das edições e `data/feedback_store.json` para feedback. O carrossel era salvo apenas em `localStorage`. A Vercel vinculada é `zapi-group/zapitv`.

Desde 18/10/2026, a API usa a linha versionada `feedback_store_v1` em `global_settings` no Turso para relatos, clusters e prompts. O arquivo local continua disponível somente quando o banco não está configurado fora da Vercel. Na Vercel, a falta do banco retorna 503 para evitar sucesso sem persistência. Esta estrutura mantém o fluxo atual sem migração destrutiva; para volumes acima de 2 MB, os dados precisam ser divididos em tabelas relacionais.

O banco `zapitv` foi criado na organização Turso `gebelson`, na região AWS US East (Virginia), correspondente à região `iad1` do projeto Vercel. A migração inicial foi aplicada e as tabelas foram conferidas no painel Turso. `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `FIREBASE_PROJECT_ID` e `ADMIN_FIREBASE_UIDS` estão configurados apenas em **Production** na Vercel; o token Turso e a lista de UIDs são Secrets. O token Turso tem acesso de leitura e gravação e expira em um ano. A implantação `dpl_ByaExL8iePpSb485aUWo9GY2BUT1` foi validada isoladamente e promovida para `zapitv-stream.vercel.app` após autorização do proprietário. Ainda não houve migração dos dados locais.

A nova camada usa **Turso/libSQL + Drizzle** no servidor Express existente. As primeiras integrações reais são o carrossel e os títulos das seções: leitura pública, gravação autenticada, versão otimista e auditoria. O navegador continua usando o estado local quando não há banco configurado ou registro global. Um erro de conexão não sobrescreve a cópia local. Nenhum dado local foi apagado ou migrado automaticamente.

O schema inicial inclui `media`, `media_external_ids`, `episodes`, `global_settings` e `admin_audit`. As três primeiras tabelas preparam uma migração posterior do catálogo, mas **o catálogo publicado ainda não lê delas**. Não se deve importar o catálogo inteiro sem conciliar IDs, edições manuais e versões. O player não foi alterado por esta camada.

## Bibliotecas

- **Drizzle ORM / Drizzle Kit e `@libsql/client`**: adotados para schema tipado, índices, migração versionada e conexão Turso. [Guia oficial](https://orm.drizzle.team/docs/tutorials/drizzle-with-turso).
- **TanStack Query**: adotado só para leitura e sincronização periódica do carrossel e dos títulos globais. O cache local do catálogo continua como está; não há um segundo cache para ele. [Invalidação e QueryClient](https://tanstack.com/query/latest/docs/framework/react/reference/QueryClient).
- **jose**: adotado no servidor para verificar a assinatura RS256, o projeto, a validade e o UID do token Firebase com as chaves públicas do Google. O Firebase Admin SDK foi descartado porque sua dependência transitiva impediu o início da função na Vercel. Não é necessária uma chave privada de conta de serviço para essa verificação. A lista `ADMIN_FIREBASE_UIDS` define quem pode editar; o papel ou e-mail mostrado no navegador não concede acesso.
- **Hono**: descartado nesta etapa porque Express já organiza as rotas Vercel e uma segunda API criaria trabalho de migração sem ganho medido.
- **Better Auth**: descartado porque Firebase Auth já existe. Visitantes continuam sem login obrigatório.
- **Refine**: descartado porque o painel atual já existe e deve preservar o design.
- **Exemplos Turso**: usados apenas como referência para a conexão e migração; nenhum template foi copiado.

## Configuração segura

1. O banco Turso e a migração inicial já existem. Confirme as cotas atuais do [plano gratuito](https://turso.tech/pricing) antes de aumentar o uso; esta implementação não ativa cobrança.
2. `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `FIREBASE_PROJECT_ID` e `ADMIN_FIREBASE_UIDS` já estão definidos como variáveis **server-side** de Production na Vercel. Configure Preview e Development apenas quando esses ambientes precisarem do banco; idealmente use bancos e tokens separados. Nunca use prefixo `VITE_` para esses valores. O projeto Auth usado no código e confirmado no console é `gen-lang-client-0695914983`. A gravação global exige login real nessa conta Firebase; o login local de demonstração não produz um token válido. [Verificação oficial de tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens).
3. Para desenvolvimento, configure as mesmas chaves em `.env.local` (ignorado pelo Git). `npm run dev` carrega esse arquivo se existir. Não cole tokens no código nem em comandos gravados no histórico.
4. Antes de aplicar migrações, faça backup do banco existente, se houver. `npm run db:generate` gera arquivos SQL versionados; revise o SQL. Execute `npm run db:migrate` **uma vez por ambiente**, em uma etapa controlada. O deploy não executa migrações automaticamente.
5. Execute `npm run db:backup` para criar um JSON local em `backups/`, ignorado pelo Git, e guarde outra cópia fora da pasta do projeto. O script é somente leitura. Para restaurar, crie um banco novo, aplique as migrações e valide/importa o snapshot nesse banco antes de trocar a URL da aplicação; não sobrescreva o banco ativo.

## Migração de dados já existentes

No navegador que contém as edições manuais, baixe **Banco → Exportar Backup** antes de configurar o Turso. O JSON agora inclui carrossel bruto, seções e títulos de seção, além de conteúdo e notificações. Senhas de usuários são omitidas. Guarde esse arquivo fora do repositório. Compare a lista e a ordem do carrossel com a interface atual.

Depois da migração SQL e da configuração de Auth, um administrador com UID autorizado pode abrir o editor de carrossel e salvar a lista existente, e salvar novamente os títulos das seções já personalizados. Essas primeiras gravações criam a versão 1 global de cada recurso. Outros navegadores passam a recebê-los pela API; sessões abertas revalidam a cada minuto. Se duas sessões editarem a mesma versão, a segunda recebe HTTP 409 e precisa recarregar antes de salvar. Nenhuma atualização automática sobrescreve esses valores globais.

**Ainda pendente:** inventário e conciliação dos conteúdos do Firestore, IndexedDB e seeds, importação idempotente de catálogo, seções, provedores, rankings e feedback, e alternância de leitura dessas áreas para Turso. A presença das tabelas não significa que esses domínios já foram migrados. Não descarte o Firestore, Dexie, `localStorage` ou o JSON de feedback nesta fase.

## API e diagnóstico

- `GET /api/db/global-settings/hero-carousel`: sem credenciais do banco responde `{configured:false,items:null,version:0}`. Com banco, retorna a lista e a versão; em falha temporária retorna 503.
- `PUT /api/db/global-settings/hero-carousel`: exige `Authorization: Bearer <Firebase ID token>`, UID em `ADMIN_FIREBASE_UIDS`, lista válida e `expectedVersion`. Responde 403 se não autorizado, 409 em conflito, 503 em falha de infraestrutura. A confirmação só sai após transação e auditoria concluídas.
- `GET/PUT /api/db/global-settings/section-titles`: mesmo contrato para os cinco títulos das seções da página inicial.
- A função Express existente é compilada para `api/index.mjs` e recebe `/api/*` pelo rewrite de `vercel.json`. Nenhuma credencial é enviada ao bundle Vite.

Teste local: `npm run test:database`, `npm run test:auth`, `npm run build`, `npm run lint`. Os testes de banco usam libSQL em memória e os de autenticação usam chaves locais, sem tocar no Turso real nem exigir credenciais Firebase. Na implantação isolada, `GET` das duas configurações respondeu 200 com `configured:true`; gravações sem token e com assinatura inválida responderam 403; a API existente de lançamentos e a página inicial responderam 200. Depois da promoção, o domínio público foi recarregado no Chrome: a página inicial e o carrossel apareceram, e as rotas de banco e lançamentos responderam 200. A gravação com uma conta Firebase real e a sincronização entre dispositivos ainda precisam de validação. O `lint` ainda falha com 93 erros anteriores em outras partes do projeto. A API de feedback ainda tenta gravar um arquivo local em uma função Vercel, cujo sistema de arquivos é somente leitura; sua migração para persistência global continua pendente.

## Restrições e recuperação

Se o Turso falhar, a página conserva o carrossel já disponível no navegador; uma gravação global falha explicitamente. Em caso de erro após a ativação, reverta o deployment ou remova temporariamente as variáveis de Turso para voltar à leitura local. O backup JSON do Turso é independente do Git. O estado local antigo permanece intacto para uma recuperação manual.

Antes de expandir o schema, faça inventário das consultas reais e dos campos manuais. Inclua validação de identidade canônica e índices para os novos filtros, testes de migração e medições de consultas. Evite copiar os exemplos oficiais do Turso como arquitetura inteira.

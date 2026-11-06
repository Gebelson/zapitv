# Firebase + Turso: isolamento de Preview

## Status e fronteira da garantia

Selecao centralizada e validacao de build implementadas; nenhum recurso remoto provisionado ou regra Production modificada. Configuracao valida sintaticamente NAO comprova que o projeto existe, que a API key pertence a ele ou que as regras remotas impedem escrita cruzada. Gate de deploy permanece BLOQUEADO ate essas verificacoes.

## Inventario de integracoes

| Local | Operacao | Destino atual e selecao |
|---|---|---|
| firebase.ts | initializeApp/getAuth/getFirestore | Uma app, Auth e Firestore nomeado; agora recebem apenas configuracao validada pelo build |
| firebase-applet-config.json | Web App config Production | Preservado integralmente; usado apenas como baseline em build e destino Production/desenvolvimento local legado |
| App.tsx:1487-1549 | onSnapshot: content, users (admin), customSections, notifications | db exportado por firebase.ts; listeners ja possuem limpeza |
| App.tsx:2152-2155 | setDoc users | db central selecionado, sem mudanca de payload/funcionalidade |
| App.tsx:2184-2200 | setDoc content | Mesmo db central |
| App.tsx:2223-2225 | setDoc keyValueStore/zapitv_section_titles | Mesmo db central |
| App.tsx:2246-2277 | setDoc/deleteDoc customSections | Mesmo db central |
| App.tsx:2926-2959 | deleteDoc users/content; setDoc notifications; getDocs/deleteDoc notifications | Mesmo db central |
| src/core/admin/globalSettingsClient.ts | auth.currentUser.getIdToken + PUT same-origin | Auth central selecionado; escrita principal via API Turso, autorizacao backend preservada |
| src/components/admin/FeedbackAdminPanel.tsx | getIdToken + fetch same-origin | Auth central; sessao propria ZapiTV tambem suportada |
| src/server/database/firebaseAuth.ts | verifica JWT com JWK Google, issuer/audience e allowlist | FIREBASE_PROJECT_ID e ADMIN_FIREBASE_UIDS server-side; nao inicializa Admin SDK, nao grava Firestore |
| src/server/auth/authMiddleware.ts / database/routes.ts | administracao por sessao Turso ou Firebase autorizado | ADMIN_USER_IDS do ambiente, sem concessao por email |
| firestore.rules / firebase-blueprint.json | regras e descricao versionadas | Nao foram implantadas nem presumidas iguais as regras remotas |

Nao foram encontradas outras inicializacoes Firebase nem imports do SDK Storage/uploadBytes/deleteObject. storageBucket existe na configuracao Web, mas Storage nao e inicializado. Chamadas getStorageKey de syncQueue nao pertencem ao Firebase. Nao ha fluxo signIn Firebase novo nesta tarefa: sessao Turso e identidade Firebase permanecem sistemas distintos, sem copia de usuarios.

## Selecao de ambiente

VERCEL_ENV, VITE_VERCEL_ENV e ZAPITV_DEPLOYMENT_ENV sao sinais explicitos; valores conflitantes falham. Em Vercel, ausencia de ambiente falha. MODE/NODE_ENV nao decidem Preview. Ambientes customizados precisam ser classificados explicitamente como Preview; nao recebem fallback Production.

Production preserva exatamente o objeto legitimo de firebase-applet-config.json. Desenvolvimento local legado permanece igual; para simular Preview usar ZAPITV_DEPLOYMENT_ENV=preview.

Preview exige as sete variaveis ZAPITV_PREVIEW_FIREBASE_* do template config/firebase-preview.env.example. Todas sao campos publicos da Web App; nenhuma chave privada/Admin SDK pode entrar no frontend. Auth domain aceito: <projectId>.firebaseapp.com. Bucket: <projectId>.appspot.com ou <projectId>.firebasestorage.app. API key, app ID, project ID, sender e endpoints nao podem reutilizar a configuracao Production conhecida. O projeto deve ser outro mesmo que o banco Firestore seja diferente, pois Auth e compartilhado dentro do projeto. O nome (default) pode existir em dois projetos independentes: a identidade real e projects/<project>/databases/<database>.

Se FIREBASE_PROJECT_ID server-side for fornecido, deve coincidir com o projeto staging. Sem ele a autorizacao Firebase legada permanece desabilitada; Turso nao ganha permissoes Firebase automaticamente. ADMIN_USER_IDS e ADMIN_FIREBASE_UIDS devem conter somente identidades de teste, verificadas externamente.

validate:firebase-env roda antes do build. vite.config.ts aplica o mesmo resolvedor, inclusive em vite build --mode production, e injeta somente os campos Web selecionados. firebase.ts nao inicializa sem essa definicao. Nao ha fallback do Preview para o JSON Production. Nao reutilizar bundles prebuilt de outro ambiente; verificar o ambiente de build do artefato antes de qualquer deploy.

## Provisionamento externo pendente

Nao existe CLI Firebase/gcloud autenticada ou connector Firebase disponivel neste ambiente. As variaveis Preview acessiveis da Vercel nao incluem configuracao Firebase de staging. Isso NAO comprova inexistencia de um projeto na conta: ele ainda precisa ser identificado pelo proprietario.

Se ja existir: fornecer a configuracao publica da Web App staging, o ID do banco nomeado e acesso autorizado somente leitura para verificar recursos/regras. Se nao existir: autorizar previamente projeto Firebase independente, registro de Web App, Auth de testes e Firestore em modo protegido, com regiao e database ID definidos. Nao habilitar custos/servicos pagos ou copiar dados Production nesta tarefa.

Validar no projeto real: API key pertence ao projeto staging e tem restricoes apropriadas; Auth domain e dominios autorizados do Preview corretos; identidades ficticias independentes; regras remotas Firestore autorizam somente o necessario; tentativa de escrita em Production usando identidade staging e negada. Nao testar escrita Production real: usar avaliacao/simulacao oficial de regras ou verificacao autorizada sem alterar documentos. Regras Production nunca devem ser modificadas para habilitar Preview.

## Turso e integracoes

Preflight remoto somente leitura repetido: staging esperado, 21 tabelas, ledger consistente com 7 migracoes, zero escritas. Ainda falta 0007_password_recovery, que cria password_reset_tokens; nao e necessario para descoberta/proxy/playback. Sem Brevo configurado, recuperacao de senha fica fora desta homologacao. Nao aplicar migracoes nem criar usuarios remotos sem autorizacao. Nenhum token Production copiado.

Vercel Preview tem credenciais Turso apenas para outra branch; a branch P0 ainda precisa de binding exclusivo staging e ADMIN_USER_IDS de teste. Nao ha ADMIN_USER_IDS Preview identificado. Email, Firebase admin, cron e outras integracoes Production nao devem ser herdadas; manter secrets ausentes ou exclusivos de staging.

## Checklist de liberacao

- [ ] Identificar/provisionar projeto Firebase staging independente com autorizacao.
- [ ] Confirmar propriedade da Web App/API key, Auth e banco Firestore reais.
- [ ] Verificar regras/permissoes contra escrita cruzada; sem mudancas Production.
- [ ] Configurar variaveis Preview exclusivas da branch e administradores de teste.
- [ ] Confirmar Turso staging e isolamento de sessoes/identidades em HTTPS.
- [ ] Nova CI Linux aprovada para estes commits (a CI de 6af3537 nao basta).
- [ ] Confirmar protecao Vercel, APP_URL exato e pacote sem arquivos privados.
- [ ] Somente entao autorizar deployment Preview e homologacao integrada.

## Testes

O workflow quality usa configuracao publica sintetica de Preview nos testes/build de CI para que browsers de teste nao inicializem o Firebase Production. Nao e projeto remoto homologado nem configuracao de deployment; a Vercel deve receber valores reais separados e continuar bloqueada enquanto faltarem recursos/permissoes.

firebase_environment_isolation testa selecao fail-closed e destinos SDK com mocks, incluindo uma escrita administrativa simulada. firebase_build_guard executa o comando de validacao e o Vite real sem configuracao Preview, esperando falha. firebase_preview_bundle compila um Preview real com campos sinteticos e verifica que o bundle inclui somente o projeto fixture, sem identificadores Firebase Production ou sentinela de segredo server-side. Isso nao cria nem homologa recursos remotos.

Referencias oficiais: https://firebase.google.com/docs/projects/dev-workflows/general-best-practices e https://vercel.com/docs/frameworks/frontend/vite .


## Evidencia desta execucao

TypeScript, lint:architecture (18 findings conhecidos, zero novos), test:firebase-isolation (resolvedor, destinos SDK simulados e comando Vite real falhando sem variaveis), test:firebase-preview-bundle (bundle real com fixture e sem config Production) e npm run build completo local passaram; Vite final 10,83 s. Nenhuma permissao remota Firebase foi verificada. Preflight Turso somente leitura: 21 tabelas, 7/8 migracoes, ledger consistente, zero escritas. Variaveis Firebase Preview e administradores Preview ausentes nos metadados Vercel acessiveis. Nao foi criada infraestrutura, conta ou dado remoto, nem aplicado deploy/regras/migracao. A CI anterior de 6af3537 nao valida este novo codigo.

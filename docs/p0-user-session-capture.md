# Coleta temporaria P0 na sessao do usuario

O acesso automatizado a sessao privada continua indisponivel. Este procedimento e executado pelo proprio usuario, na aba ZapiTV ja autenticada. Nao compartilhe senha, cookies, tokens, HAR ou logs completos. Nao desative protecoes do navegador; se a execucao for bloqueada, interrompa.

1. Abra https://zapitv-stream.vercel.app/ normalmente e confirme a conta/perfil desejados na interface.
2. Abra scripts/diagnostics/p0-session-collector.js, revise o arquivo e execute seu conteudo como um snippet nas ferramentas de desenvolvimento dessa aba. Ele aceita somente a origem exata da ZapiTV. Nao faz login, nao muda storage, nao instala extensao e nao envia relatorios.
3. Execute `zapiP0Diag.mark('primeira')` e tente reproduzir uma obra que voce tenha autorizacao para assistir. Anote separadamente titulo, tipo, temporada e episodio.
4. Volte, navegue/busque outros titulos e execute `zapiP0Diag.mark('consecutiva')` antes de tentar novamente a mesma obra. Para observar a sincronizacao sem alterar configuracao, use `fetch('/api/providers/config')`: isso registra a resposta mas NAO forca a sincronizacao interna da aplicacao.
5. Quando observar indisponibilidade ou recuperacao, marque `zapiP0Diag.mark('falha')` ou `zapiP0Diag.mark('recuperacao')`.
6. Execute `zapiP0Diag.stop()` e `zapiP0Diag.download()`. O JSON e salvo no proprio computador, sem upload automatico. Pode ser fornecido para analise junto do titulo/episodio e resultado observado.

Limites: 300 eventos, 100 kB por JSON observado, 32 elementos de video e encerramento automatico apos 3 minutos. Para uma sessao mais longa ou revalidacao posterior, baixe a primeira coleta e execute o snippet novamente antes da proxima tentativa, SEM recarregar a pagina. O cache do aplicativo nao e limpo nem alterado pelo coletor.

O arquivo exporta apenas categorias de requisicao, duracao ate os headers, status HTTP, contagem de streams em respostas JSON internas, estados publicos de provedores e metricas/eventos dos elementos de video. Nunca exporta URLs (nem assinadas), headers, corpos de autenticacao, identidade da conta/perfil ou titulos de streams. Rejeicoes internas, estado de circuit breaker/cache, chamadas XHR e identidade da fonte selecionada nao sao acessiveis a este coletor: aparecem explicitamente como nao observados. Metricas de video podem incluir a intro; frames nao homologam sozinhos o conteudo principal.

A instrumentacao preserva argumentos/respostas do fetch original e remove seus listeners ao parar. Nao e importada pelo app nem adicionada ao bundle. Se outro script substituir fetch depois dela, stop nao sobrescreve esse script.

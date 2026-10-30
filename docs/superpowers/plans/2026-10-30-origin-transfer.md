# Retirar mídia das Functions

Base: 2117bf7. Branch codex/p0-origin-transfer-20261030. Sem alterações remotas, migrações ou credenciais.

1. Reproduzir a reescrita HLS para proxy; registrar bloqueio das métricas (Observability Plus exigido).
2. Testar e substituir o relay genérico por proxy JSON de addons: allowlist, SSRF, autenticação existente, tamanho/tempo/concorrência limitados, sem vídeo/manifestos/segmentos.
3. Gerar somente URLs diretas na descoberta e no Ao Vivo; resolver referências legadas no player sem fallback pela Vercel. CORS/mixed content incompatível resulta em indisponibilidade.
4. Remover probes de mídia via proxy e cancelar corpos de pré-validação; deduplicar consultas de addon. Cache curto/ETag somente nas APIs comprovadamente públicas; respostas privadas no-store.
5. Testes determinísticos de segurança/transporte, navegador com mídia autorizada, regressões do player/auth/catálogo, build único ao final. Registrar bloqueios físicos e ausência de medição pós-publicação.

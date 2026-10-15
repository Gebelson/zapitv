/**
 * ZapiTV — FeedbackPromptGenerator
 * Gerador determinístico de prompts técnicos de correção para Antigravity e Codex.
 * Gera prompts individuais por relato e prompts consolidados para problemas recorrentes (clusters),
 * com sanitização estrita contra Prompt Injection e templates especializados por categoria.
 */

import {
  FeedbackReport,
  IssueCluster,
  GeneratedFixPrompt,
  FEEDBACK_CATEGORY_LABELS,
  FeedbackCategory
} from './feedbackTypes';

export class FeedbackPromptGenerator {
  /**
   * Sanitiza a descrição enviada pelo usuário para impedir Prompt Injection
   */
  public static sanitizeUserDescription(rawText?: string): string {
    return this.sanitizeUserComment(rawText);
  }

  /**
   * Sanitiza o comentário enviado pelo usuário neutralizando tentativas de jailbreak e prompt injection
   */
  public static sanitizeUserComment(rawText?: string): string {
    if (!rawText) return 'Nenhuma descrição textual fornecida pelo usuário.';
    
    // Remove caracteres de controle de escape
    let cleaned = rawText
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/```/g, "'''");

    // Neutraliza tentativas de Prompt Injection
    cleaned = cleaned
      .replace(/ignore\s+all\s+(previous|prior)\s+instructions/gi, '[instrução desconsiderada]')
      .replace(/system\s+prompt\s+override/gi, '[instrução desconsiderada]')
      .replace(/you\s+are\s+now\s+/gi, '[tentativa de redefinição de persona desconsiderada]')
      .trim();

    if (!cleaned) return 'Nenhuma descrição textual fornecida pelo usuário.';

    // Limita tamanho para evitar flood
    return cleaned.slice(0, 1500);
  }

  /**
   * Gera um prompt técnico individual a partir de um único relato
   */
  public static generateIndividualPrompt(report: FeedbackReport): GeneratedFixPrompt {
    const { category, technicalContext, userDescription, id } = report;
    const categoryLabel = FEEDBACK_CATEGORY_LABELS[category] || 'Problema Geral';
    const mediaTitle = technicalContext.mediaTitle || 'Aplicação ZapiTV';
    const safeUserText = this.sanitizeUserDescription(userDescription);

    const now = Date.now();
    const isEpisode = (technicalContext.season || 0) > 0 && (technicalContext.episode || 0) > 0;
    const epString = isEpisode ? ` (Temporada ${technicalContext.season}, Episódio ${technicalContext.episode})` : '';

    const markdown = `# ZAPITV — INVESTIGAÇÃO E CORREÇÃO: ${categoryLabel.toUpperCase()} EM ${mediaTitle.toUpperCase()}${epString.toUpperCase()}

## 1. PROBLEMA RELATADO
Um usuário relatou uma falha de **${categoryLabel}** durante o uso do ZapiTV.

> [!NOTE] Relato do Usuário (Dado Não Confiável)
> "${safeUserText}"

---

## 2. CONTEXTO TÉCNICO CAPTURADO
As seguintes evidências técnicas foram registradas automaticamente pelo aplicativo:
- **Relato ID:** \`${id}\`
- **Mídia:** ${mediaTitle} (ID Canônico: \`${technicalContext.canonicalMediaId || 'N/A'}\`)
- **Tipo:** ${technicalContext.mediaType || 'N/A'} | **Ano:** ${technicalContext.year || 'N/A'}
- **Identificadores:** IMDb: \`${technicalContext.imdbId || 'N/A'}\` | TMDB: \`${technicalContext.tmdbId || 'N/A'}\`
${isEpisode ? `- **Episódio:** Temporada ${technicalContext.season}, Episódio ${technicalContext.episode}` : ''}
- **Provedor de Streaming:** \`${technicalContext.providerId || 'N/A'}\` | **Nome do Stream:** \`${technicalContext.streamName || 'N/A'}\`
- **Tipo de Stream:** \`${technicalContext.streamType || 'N/A'}\` | **Host:** \`${technicalContext.streamUrlHost || 'N/A'}\`
- **Idiomas:** Solicitado: \`${technicalContext.requestedLanguage || 'N/A'}\` | Declarado: \`${technicalContext.declaredLanguage || 'N/A'}\` | Faixa Ativa: \`${technicalContext.activeAudioTrack || 'N/A'}\`
- **Legenda Ativa:** \`${technicalContext.selectedSubtitleId || 'off'}\`
- **Resolução / Qualidade:** Selecionada: \`${technicalContext.selectedQuality || 'auto'}\` | Detectada: \`${technicalContext.detectedResolution || 'N/A'}\`
- **Estado do Player:** \`${technicalContext.playerState || 'N/A'}\` (Posição: ${Math.round(technicalContext.currentTimeSeconds || 0)}s de ${Math.round(technicalContext.durationSeconds || 0)}s)
- **Diagnóstico de Falha:** \`${technicalContext.failureStage || 'none'}\` | Código: \`${technicalContext.errorCode || 'N/A'}\`
- **Mensagem de Erro do Player:** ${technicalContext.lastErrorMessage ? `\`${technicalContext.lastErrorMessage}\`` : 'Nenhuma'}
- **Ambiente:** ZapiTV v${technicalContext.appVersion} | Navegador: ${technicalContext.browser} | SO: ${technicalContext.os} (${technicalContext.deviceType})
- **Rota:** \`${technicalContext.currentRoute}\`

---

## 3. COMPORTAMENTO ESPERADO
${this.getExpectedBehaviorByCategory(category, mediaTitle)}

---

## 4. HIPÓTESES TÉCNICAS INICIAIS
${this.getHypothesesByCategory(category, technicalContext)}

---

## 5. ROTEIRO DE INVESTIGAÇÃO
Inspecione os seguintes arquivos e subsistemas pertinentes:
${this.getInvestigationFilesByCategory(category)}

Verifique:
1. Se a fonte ou manifesto retornado pelo provedor é válido e reproduzível.
2. Se há divergência entre os metadados do stream e a mídia real.
3. Se o player tratou corretamente o estado de carregamento ou comutação de faixa.
4. Se o erro ocorre apenas em conexões ou navegadores específicos (ex: restrição de CORS ou codec).

---

## 6. CORREÇÕES SOLICITADAS
- Corrija a causa raiz no código do ZapiTV ou na resolução de fontes.
- Não aplique soluções cosméticas ou paliativas.
- Garanta que caso a fonte primária falhe, o sistema execute fallback automático e limpo para uma fonte legítima compatível.

---

## 7. TESTES DE REGRESSÃO
Execute testes para validar a resolução do problema:
- Teste de reprodução direta da obra e do episódio indicado.
- Teste de comutação entre idiomas de áudio e legendas.
- Teste de resiliência e fallback caso o provedor apresente lentidão ou indisponibilidade.

---

## 8. FUNCIONALIDADES A PRESERVAR
- Inicialização rápida e pré-buffer do player.
- Melhoria por IA e comparação em tela dividida.
- Pular abertura e encerramento.
- Preservação da numeração oficial e metadados canônicos.
- Compatibilidade estrita com a Vercel e o servidor local.

---

## 9. CRITÉRIOS DE ACEITAÇÃO
1. O problema relatado não ocorre mais no cenário indicado.
2. Todas as suítes de teste do Vitest passam com 100% de aprovação (\`npx vitest run\`).
3. O build de produção é concluído sem erros (\`npm run build\`).

---

## 10. RELATÓRIO FINAL
Ao concluir a tarefa, apresente:
- Causa raiz identificada.
- Arquivos modificados e resumo das alterações.
- Testes executados e evidências de validação.
`;

    return {
      id: `prompt_ind_${now}`,
      clusterId: report.clusterId || 'unassigned',
      type: 'individual',
      version: 1,
      markdownContent: markdown.trim(),
      generatedAt: now,
      isAiRefined: false,
      isManuallyEdited: false,
      feedbackIds: [report.id],
      variablesUsed: {
        category,
        mediaTitle,
        canonicalMediaId: technicalContext.canonicalMediaId
      }
    };
  }

  /**
   * Gera um prompt técnico consolidado e sintético a partir de um cluster com múltiplos relatos
   */
  public static generateConsolidatedPrompt(
    cluster: IssueCluster,
    associatedReports: FeedbackReport[]
  ): GeneratedFixPrompt {
    const { category, title, totalReports } = cluster;
    const categoryLabel = FEEDBACK_CATEGORY_LABELS[category] || 'Problema Recorrente';
    const now = Date.now();

    // Síntese inteligente das descrições dos usuários (sem duplicações excessivas)
    const uniqueUserQuotes: string[] = [];
    const seenTexts = new Set<string>();

    for (const rep of associatedReports) {
      if (rep.userDescription && rep.userDescription.trim()) {
        const text = this.sanitizeUserDescription(rep.userDescription);
        const norm = text.toLowerCase().slice(0, 60);
        if (!seenTexts.has(norm)) {
          seenTexts.add(norm);
          uniqueUserQuotes.push(text);
          if (uniqueUserQuotes.length >= 6) break; // Amostra representativa das queixas
        }
      }
    }

    const affectedMedia = cluster.affectedMedia || [];
    const affectedEpisodes = cluster.affectedEpisodes || [];
    const affectedProviders = cluster.affectedProviders || [];
    const affectedSources = cluster.affectedSources || [];
    const affectedVersions = cluster.affectedVersions || [];
    const errorCodes = cluster.errorCodes || [];
    const isRegression = Boolean(cluster.isRegression);
    const regressionDetails = cluster.regressionDetails;

    const mediaListStr = affectedMedia.length > 0
      ? affectedMedia.map(m => `- **${m.title}** (\`${m.id}\`, tipo: ${m.type})`).join('\n')
      : (cluster.technicalFingerprint?.mediaTitle ? `- **${cluster.technicalFingerprint.mediaTitle}**` : '- Mídia genérica ou não identificada.');

    const episodesStr = affectedEpisodes.length > 0
      ? affectedEpisodes.slice(0, 8).map(e => `T${e.season}:E${e.episode}`).join(', ')
      : (cluster.technicalFingerprint?.season ? `T${cluster.technicalFingerprint.season}:E${cluster.technicalFingerprint.episode}` : 'Todos / Não aplicável');

    const providersStr = affectedProviders.length > 0 ? affectedProviders.join(', ') : (cluster.technicalFingerprint?.providerId || 'Desconhecido');
    const sourcesStr = affectedSources.length > 0 ? affectedSources.slice(0, 6).join(', ') : 'Várias';
    const versionsStr = affectedVersions.length > 0 ? affectedVersions.join(', ') : 'Recente';
    const errorCodesStr = errorCodes.length > 0 ? errorCodes.join(', ') : (cluster.technicalFingerprint?.errorCode || 'Nenhum código explícito');

    const regressionAlert = isRegression
      ? `\n> [!CAUTION] POSSÍVEL REGRESSÃO DETECTADA
> Este problema já havia sido marcado como **Resolvido** anteriormente (${new Date(regressionDetails?.previousResolvedAt || 0).toLocaleDateString('pt-BR')}), mas novos relatos continuam surgindo no app v${versionsStr}.
> Investigue se um deployment recente reverteu as alterações ou se o provedor voltou a fornecer streams problemáticos.\n`
      : '';

    const quotesSection = uniqueUserQuotes.length > 0
      ? `### Amostra Representativa dos Relatos dos Usuários:\n${uniqueUserQuotes.map(q => `> - "${q}"`).join('\n')}\n`
      : '_Os usuários relataram a falha diretamente pela categoria selecionada, sem texto adicional._\n';

    const markdown = `# ZAPITV — CORREÇÃO TÉCNICA: ${title.toUpperCase()} (${totalReports} RELATOS RELACIONADOS)
${regressionAlert}
## 1. IDENTIFICAÇÃO DO PROBLEMA
Foram registrados **${totalReports} relatos associados** à categoria **"${categoryLabel}"** no ZapiTV.

---

## 2. SEVERIDADE E IMPACTO
- **Prioridade:** ${cluster.priority.toUpperCase()}
- **Classificação:** ${categoryLabel}
- **Impacto no Usuário:** Interrupção ou degradação na experiência de consumo do conteúdo.

---

## 3. ARQUIVOS E COMPONENTES ENVOLVIDOS
${this.getInvestigationFilesByCategory(category)}

---

## 4. CONTEXTO TÉCNICO DE REPRODUÇÃO
- **Títulos Afetados:**
${mediaListStr}
- **Episódios Afetados:** ${episodesStr}
- **Provedores Envolvidos:** \`${providersStr}\`
- **Fontes / Hosts Envolvidos:** \`${sourcesStr}\`
- **Códigos de Erro Registrados:** \`${errorCodesStr}\`
- **Versões do ZapiTV Detectadas:** \`${versionsStr}\`

---

## 5. SÍNTESE DOS RELATOS DOS USUÁRIOS
${quotesSection}

---

## 6. ROTEIRO DE INVESTIGAÇÃO RECOMENDADO
1. **Verificação de Metadados e Índices:** Examine se o provedor (\`${providersStr}\`) está retornando faixas de áudio ou vídeo trocadas ou desatualizadas.
2. **Auditoria de Resolução e Fallback:** Avalie por que o \`SourceSelectionService\` ou \`StreamValidator\` aceitou essa fonte sem disparar quarentena imediata.
3. **Reprodução do Erro em Ambiente de Teste:** Configure uma simulação com os parâmetros exatos dos episódios (${episodesStr}).
4. **Isolamento de Cache:** Verifique se o cache persistente de fontes está reutilizando uma resposta defeituosa.

---

## 7. CRITÉRIOS DE ACEITAÇÃO
1. Os ${totalReports} relatos do cluster são resolvidos pela correção sistêmica.
2. A causa raiz no provedor ou player foi neutralizada por validação ou fallback.
3. Não há impacto de desempenho na inicialização dos vídeos.
4. O administrador pode marcar o cluster como resolvido com garantia de cobertura.
5. Suíte de testes aprovada com código 0.

---

## 9. RELATÓRIO DE CONCLUSÃO
Ao finalizar, reporte:
- Causa sistêmica identificada.
- Arquivos modificados.
- Testes executados e resultados obtidos.
- Confirmação de que todas as obras do cluster foram tratadas.
`;

    const suggestedFiles = this.getSuggestedFilesArray(category);

    return {
      id: `prompt_cons_${now}`,
      clusterId: cluster.id,
      type: 'consolidated',
      version: cluster.promptVersion + 1,
      markdownContent: markdown.trim(),
      consolidatedPrompt: markdown.trim(),
      suggestedFiles,
      generatedAt: now,
      isAiRefined: false,
      isManuallyEdited: false,
      feedbackIds: associatedReports.map(r => r.id),
      variablesUsed: {
        category,
        totalReports,
        affectedMediaCount: affectedMedia.length,
        providersStr
      }
    } as any;
  }

  /**
   * Alias de conveniência para generateConsolidatedPrompt
   */
  public static generateConsolidatedClusterPrompt(
    cluster: IssueCluster,
    associatedReports: FeedbackReport[]
  ): GeneratedFixPrompt & { consolidatedPrompt: string; suggestedFiles: string[] } {
    return this.generateConsolidatedPrompt(cluster, associatedReports) as any;
  }

  /**
   * Retorna os arquivos sugeridos para investigação em formato de array de caminhos
   */
  public static getSuggestedFilesArray(category: FeedbackCategory): string[] {
    switch (category) {
      case 'wrong_dubbing':
      case 'missing_dubbing_ptbr':
        return [
          'src/core/audio/audioSelectionManager.ts',
          'src/core/audio/audioDetector.ts',
          'src/components/player/ZapiPlayer.tsx',
          'src/core/providers/mediaSourceValidationService.ts'
        ];
      case 'video_not_loading':
      case 'infinite_loading':
      case 'video_stuttering':
        return [
          'src/core/playback/PlaybackOptimizerService.ts',
          'src/core/providers/providerRegistry.ts',
          'src/core/providers/streamValidator.ts',
          'src/components/player/ZapiPlayer.tsx',
          'server.ts'
        ];
      case 'wrong_movie_series':
      case 'wrong_episode':
        return [
          'src/core/identity/canonicalIdentity.ts',
          'src/core/episodes/EpisodeAvailabilityService.ts',
          'src/core/identity/sourceConfidenceEngine.ts'
        ];
      case 'subtitles_wrong_language':
      case 'subtitles_out_of_sync':
        return [
          'src/core/subtitles/subtitleLanguageDetector.ts',
          'src/core/subtitles/subtitleStyleService.ts'
        ];
      default:
        return [
          'src/components/player/ZapiPlayer.tsx',
          'components/ContentDetailModal.tsx',
          'server.ts'
        ];
    }
  }

  // =========================================================================
  // HELPERS DE TEMPLATES TÉCNICOS POR CATEGORIA
  // =========================================================================

  private static getExpectedBehaviorByCategory(category: FeedbackCategory, mediaName: string): string {
    switch (category) {
      case 'wrong_dubbing':
        return `Ao selecionar áudio dublado em Português Brasileiro (PT-BR) para ${mediaName}, a reprodução deve ser executada estritamente com áudio em português. Se não houver dublagem legítima verificada, o sistema deve apresentar aviso claro ou áudio original com legendas em PT-BR, nunca reproduzindo espanhol, inglês ou outro idioma como se fosse dublado.`;
      case 'missing_dubbing_ptbr':
        return `O catálogo deve indicar com precisão quando há dublagem PT-BR disponível. Caso existam fontes dubladas nos provedores integrados, o ZapiTV deve priorizá-las e exibi-las na listagem de áudio.`;
      case 'video_not_loading':
      case 'infinite_loading':
        return `O vídeo deve iniciar a reprodução em menos de 3 a 5 segundos após o clique. Se uma fonte falhar ou demorar, o fallback automático deve alternar silenciosamente para a próxima fonte verificada sem travar o player em carregamento infinito.`;
      case 'video_stuttering':
        return `A reprodução deve fluir sem travamentos constantes. O buffer adaptativo (ABR) e o Stall Watchdog devem rebaixar a qualidade dinamicamente ou alternar para fonte de menor latência se a taxa de transferência for insuficiente.`;
      case 'wrong_movie_series':
      case 'wrong_episode':
        return `A reprodução deve corresponder exatamente à obra, temporada e episódio anunciados no card. Nenhuma obra diferente ou episódio trocado pode ser vinculado aos metadados de ${mediaName}.`;
      case 'no_sound':
      case 'unstable_volume':
        return `O áudio deve reproduzir com clareza, sincronizado com o vídeo, respeitando o controle de volume manual do usuário e mantendo nivelamento confortável sem oscilações artificiais ou silenciamento por codecs incompatíveis.`;
      case 'subtitles_wrong_language':
      case 'subtitles_out_of_sync':
        return `As legendas em português devem ser apresentadas no idioma correto (PT-BR), sincronizadas perfeitamente com os diálogos dos personagens, com formatação limpa e sem atrasos acumulativos.`;
      case 'wrong_quality':
        return `A resolução informada (ex: 1080p, 4K) deve corresponder à resolução real dos quadros. Gravações de cinema (CAM, TS) devem ser estritamente bloqueadas pelo CamBlockerEngine.`;
      case 'ai_enhancer_not_working':
      case 'split_screen_not_working':
        return `A Melhoria por IA e a comparação em tela dividida devem processar e renderizar em tempo real sobre o canvas de vídeo sem distorção, sem tela preta e sem desativar inesperadamente.`;
      case 'live_channel_unavailable':
        return `O canal ao vivo deve reproduzir o sinal oficial estável da emissora. Se o sinal primário cair, o agregador de TV ao vivo deve tentar o stream reserva ou sinalizar indisponibilidade temporária.`;
      default:
        return `O aplicativo deve funcionar de maneira consistente, estável e fluida, respondendo prontamente às interações do usuário.`;
    }
  }

  private static getHypothesesByCategory(category: FeedbackCategory, ctx: Partial<TechnicalContext>): string {
    switch (category) {
      case 'wrong_dubbing':
        return `1. O stream retornado pelo provedor possui múltiplas faixas de áudio e o índice selecionado (\`${ctx.activeAudioTrack || '0'}\`) aponta para faixa secundária (espanhol/inglês) em vez de PT-BR.\n2. O arquivo de vídeo foi identificado incorretamente nos metadados do provedor (falso positivo na busca por "Dublado").\n3. Condição de corrida entre a detecção do manifesto HLS e a seleção de áudio no player.`;
      case 'video_not_loading':
      case 'infinite_loading':
        return `1. A URL da fonte está offline, protegida por CORS ou bloqueada por timeout (\`${ctx.streamUrlHost || 'host desconhecido'}\`).\n2. Falha de handshake ou decodificação de codec de vídeo no elemento HTML5.\n3. O proxy de stream retornou erro HTTP 403/404/502 e o player não executou fallback para as fontes secundárias.`;
      case 'wrong_movie_series':
      case 'wrong_episode':
        return `1. Inconsistência entre os IDs canônicos (IMDb / TMDB) e a busca do provedor Stremio.\n2. Numeração de episódios absoluta (ex: padrão anime de 1 a 500) mapeada incorretamente para temporadas (S1 a S4).\n3. Título homônimo de remake ou filme lançado no mesmo ano confundido no resolvedor de fontes.`;
      case 'subtitles_wrong_language':
      case 'subtitles_out_of_sync':
        return `1. A legenda baixada do OpenSubtitles/Stremio possui timing baseado em release de 23.976 fps enquanto o vídeo está em 25.000 fps ou vice-versa.\n2. Código de idioma "pt" apontou para português de Portugal com variantes desincronizadas.\n3. Legenda externa não respeitou o atraso inicial ou corte de intro.`;
      default:
        return `1. Falha intermitente na comunicação entre o cliente e o provedor de mídia.\n2. Incompatibilidade com recursos específicos do navegador ou dispositivo do usuário.`;
    }
  }

  private static getConsolidatedHypotheses(cluster: IssueCluster): string {
    const { category, affectedProviders, errorCodes } = cluster;
    const provider = affectedProviders[0] || 'provedores';

    if (category === 'wrong_dubbing') {
      return `A análise das múltiplas ocorrências indica uma falha recorrente na identificação de faixas de áudio no provedor \`${provider}\`. É altamente provável que arquivos de vídeo multi-áudio (Dual Audio / Multi-Lang) estejam com o mapeamento de faixas invertido ou que o classificador de streams (\`audioDetector.ts\` ou \`audioSelectionManager.ts\`) esteja priorizando a faixa de áudio padrão do container MP4/MKV em vez da faixa especificada com metadado PT-BR.`;
    }

    if (category === 'video_not_loading' || category === 'infinite_loading') {
      return `Múltiplos usuários reportaram falha de carregamento envolvendo o provedor \`${provider}\` e códigos de erro \`${errorCodes.join(', ') || 'STALL'}\`. Isso aponta para instabilidade na CDN do provedor, bloqueio de requisições de origem cruzada (CORS) ou esgotamento de conexões ativas no endpoint proxy.`;
    }

    return `Os dados consolidados revelam um padrão técnico convergente entre as ocorrências relatadas. O problema não é pontual de um único usuário ou dispositivo, mas decorre de uma divergência estrutural no pipeline de processamento ou nas fontes de mídia associadas.`;
  }

  private static getInvestigationFilesByCategory(category: FeedbackCategory): string {
    switch (category) {
      case 'wrong_dubbing':
      case 'missing_dubbing_ptbr':
        return `- \`src/core/audio/audioSelectionManager.ts\` (Seleção e mapeamento de faixas de áudio)
- \`src/core/audio/audioDetector.ts\` (Classificação de streams e detecção de dublagem)
- \`src/components/player/ZapiPlayer.tsx\` (Menu de áudio e comutação de faixas)
- \`src/core/providers/mediaSourceValidationService.ts\` (Extração de metadados de áudio das fontes)`;
      case 'video_not_loading':
      case 'infinite_loading':
      case 'video_stuttering':
        return `- \`src/core/playback/PlaybackOptimizerService.ts\` (Telemetria, ABR e Stall Watchdog)
- \`src/core/providers/providerRegistry.ts\` (Resolução e timeout de fontes)
- \`src/core/providers/streamValidator.ts\` (Validação e quarentena de streams)
- \`src/components/player/ZapiPlayer.tsx\` (Inicialização, HLS.js e fallback de fontes)
- \`server.ts\` (Endpoint \`/api/proxy\` e tratamento de erros de streaming)`;
      case 'wrong_movie_series':
      case 'wrong_episode':
        return `- \`src/core/identity/canonicalIdentity.ts\` (Mapeamento de IDs TMDB, IMDb e AniList)
- \`src/core/episodes/EpisodeAvailabilityService.ts\` (Numeração e disponibilidade de episódios)
- \`src/core/identity/sourceConfidenceEngine.ts\` (Correspondência de títulos e rejeição de homônimos)`;
      case 'subtitles_wrong_language':
      case 'subtitles_out_of_sync':
        return `- \`src/core/subtitles/subtitleLanguageDetector.ts\` (Detecção de idioma de legendas)
- \`src/core/subtitles/subtitleStyleService.ts\` (Sincronização e ajuste de delay)`;
      case 'ai_enhancer_not_working':
      case 'split_screen_not_working':
        return `- \`src/core/enhancement/aiEnhancerService.ts\` (Gerenciamento do motor de IA)
- \`src/core/enhancement/videoEnhancer.ts\` (WebGPU, WebGL e shaders Anime4K)
- \`src/core/enhancement/audioEnhancer.ts\` (DSP e Web Audio)`;
      case 'live_channel_unavailable':
        return `- \`src/core/livetv/OfficialChannelProvider.ts\` (Fontes de canais ao vivo)
- \`src/core/livetv/channelHealthService.ts\` (Monitoramento de saúde e uptime dos canais)`;
      default:
        return `- \`src/components/player/ZapiPlayer.tsx\`
- \`components/ContentDetailModal.tsx\`
- \`server.ts\``;
    }
  }
}

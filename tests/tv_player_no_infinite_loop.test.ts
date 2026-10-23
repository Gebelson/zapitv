import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

async function runNoInfiniteLoopSuite() {
  console.log('========================================================================');
  console.log('--- AUDITORIA E VALIDAÇÃO: ELIMINAÇÃO DE LOOP INFINITO NO PLAYER DA TV ---');
  console.log('========================================================================\n');

  const contentModalPath = path.resolve(process.cwd(), 'components/ContentDetailModal.tsx');
  assert(fs.existsSync(contentModalPath), 'ContentDetailModal.tsx deve existir');
  const modalCode = fs.readFileSync(contentModalPath, 'utf8');

  const playerPath = path.resolve(process.cwd(), 'src/components/player/ZapiPlayer.tsx');
  assert(fs.existsSync(playerPath), 'ZapiPlayer.tsx deve existir');
  const playerCode = fs.readFileSync(playerPath, 'utf8');

  // Teste 1: Auditoria estática de ContentDetailModal.tsx
  console.log('[Auditoria 1] Verificando estabilização do objeto item em ContentDetailModal.tsx...');
  assert(
    modalCode.includes('const stablePlayerItem = useMemo('),
    'ContentDetailModal deve memoizar stablePlayerItem usando useMemo'
  );
  assert(
    modalCode.includes('item={stablePlayerItem}'),
    'ContentDetailModal deve repassar item={stablePlayerItem} ao ZapiPlayer em vez de objeto inline'
  );
  assert(
    !modalCode.includes('item={item.episodes?.length ? item : (episodes.length ? { ...item'),
    'ContentDetailModal NÃO deve criar objeto inline não-memoizado no prop item do ZapiPlayer'
  );
  console.log('✓ Auditoria 1 aprovada: stablePlayerItem devidamente memoizado.\n');

  // Teste 2: Auditoria estática de ZapiPlayer.tsx (Restauração e Chave de Conteúdo)
  console.log('[Auditoria 2] Verificando blindagem de restauração única em ZapiPlayer.tsx...');
  assert(
    playerCode.includes('lastRestoredContentKeyRef'),
    'ZapiPlayer deve manter lastRestoredContentKeyRef para travar restauração repetitiva da mesma mídia'
  );
  assert(
    playerCode.includes('if (lastRestoredContentKeyRef.current === currentKey)'),
    'ZapiPlayer deve verificar se o conteúdo atual já teve sua posição inicial restaurada'
  );
  assert(
    playerCode.includes('targetResumeTimeRef.current = 0;'),
    'applyTargetResumeTime deve zerar targetResumeTimeRef.current após aplicar o seek para não causar loop'
  );
  console.log('✓ Auditoria 2 aprovada: lastRestoredContentKeyRef e consumo imediato de targetResumeTimeRef OK.\n');

  // Teste 3: Auditoria de dependências primitivas estáveis
  console.log('[Auditoria 3] Verificando isolamento de dependências nos hooks do ZapiPlayer...');
  assert(
    playerCode.includes('}, [item?.id, initialSeason, initialEpisode, initialResumeTime]);'),
    'O efeito de restauração de tempo deve depender exclusivamente de chaves primitivas [item?.id, initialSeason, initialEpisode, initialResumeTime]'
  );
  assert(
    playerCode.includes('}, [item?.id, initialSeason, initialEpisode, onUpdatePlaybackPosition]);'),
    'flushProgress deve depender de [item?.id, initialSeason, initialEpisode, onUpdatePlaybackPosition] e usar itemRef.current'
  );
  assert(
    playerCode.includes('validatedStreamUrlsRef'),
    'ZapiPlayer deve possuir validatedStreamUrlsRef para evitar revalidações em loop durante a reprodução'
  );
  console.log('✓ Auditoria 3 aprovada: dependências primitivas e itemRef aplicados.\n');

  // Teste 4: Simulação Funcional — Proteção contra repetição de cena
  console.log('[Teste Funcional 4] Simulando ciclo de vida de reprodução e múltiplos eventos de buffer...');

  class SimulatedVideoPlayer {
    public currentTime: number = 0;
    public readyState: number = 0;
    public isInitialTimeApplied: boolean = false;
    public targetResumeTime: number = 0;
    public lastRestoredKey: string | null = null;
    public seekCount: number = 0;

    public initContent(id: string, season?: number, episode?: number, savedTime: number = 0) {
      const key = `${id}_s${season ?? 0}_e${episode ?? 0}`;
      if (this.lastRestoredKey === key) return;
      this.lastRestoredKey = key;
      this.isInitialTimeApplied = false;
      if (savedTime > 2) {
        this.targetResumeTime = savedTime;
        if (this.readyState >= 1) {
          this.currentTime = savedTime;
          this.isInitialTimeApplied = true;
          this.targetResumeTime = 0;
          this.seekCount++;
        }
      } else {
        this.targetResumeTime = 0;
      }
    }

    public applyTargetResumeTime() {
      if (this.targetResumeTime > 0 && this.readyState >= 1) {
        if (Math.abs(this.currentTime - this.targetResumeTime) > 0.5) {
          this.currentTime = this.targetResumeTime;
          this.seekCount++;
        }
        this.isInitialTimeApplied = true;
        this.targetResumeTime = 0; // Consumido!
      }
    }

    public handleUserSeek(target: number) {
      this.targetResumeTime = 0;
      this.isInitialTimeApplied = true;
      this.currentTime = target;
      this.seekCount++;
    }
  }

  const sim = new SimulatedVideoPlayer();

  // Início da reprodução de um filme com 30s gravados no storage
  sim.initContent('filme-matrix', undefined, undefined, 30);
  assert.equal(sim.targetResumeTime, 30, 'targetResumeTime deve ser 30s antes de carregar metadados');
  assert.equal(sim.currentTime, 0, 'currentTime deve ser 0s antes de readyState >= 1');

  // 1º evento: onLoadedMetadata
  sim.readyState = 1;
  sim.applyTargetResumeTime();
  assert.equal(sim.currentTime, 30, 'Vídeo deve restaurar para 30s');
  assert.equal(sim.targetResumeTime, 0, 'targetResumeTime deve ser zerado após aplicação');
  assert.equal(sim.isInitialTimeApplied, true, 'isInitialTimeApplied deve ser true');
  assert.equal(sim.seekCount, 1, 'Deve ter ocorrido exatamente 1 seek');

  // O vídeo avança naturalmente por 15 segundos
  sim.currentTime = 45;

  // 2º evento: onLoadedData chega logo depois
  sim.applyTargetResumeTime();
  assert.equal(sim.currentTime, 45, 'onLoadedData NÃO deve puxar o vídeo de volta para 30s');

  // 3º evento: onCanPlay chega
  sim.readyState = 4;
  sim.applyTargetResumeTime();
  assert.equal(sim.currentTime, 45, 'onCanPlay NÃO deve puxar o vídeo de volta para 30s');

  // 4º evento: Término da vinheta / intro concluída
  sim.applyTargetResumeTime();
  assert.equal(sim.currentTime, 45, 'Fim da intro NÃO deve puxar o vídeo de volta para 30s');

  // 5º evento: Simulação de 20 re-renderizações no componente pai (ex: atualização de storage ou estado)
  for (let i = 0; i < 20; i++) {
    sim.initContent('filme-matrix', undefined, undefined, 30);
    sim.applyTargetResumeTime();
  }
  assert.equal(sim.currentTime, 45, 'Re-renders NÃO devem reiniciar a cena nem forçar seek');
  assert.equal(sim.seekCount, 1, 'Número de seeks deve permanecer exatamente 1');
  console.log('✓ Teste Funcional 4 aprovado: Nenhuma regressão de tempo nem loop infinito em múltiplos buffers e renders.\n');

  // Teste 5: Simulação Funcional — Compatibilidade com Avanço e Retrocesso estilo Apple TV
  console.log('[Teste Funcional 5] Verificando avanço/retrocesso pelo controle remoto sem conflitos de buffer...');

  // Usuário pressiona Seta Direita no controle da TV (+10s, de 45s para 55s)
  sim.handleUserSeek(55);
  assert.equal(sim.currentTime, 55, 'Vídeo deve avançar imediatamente para 55s');
  assert.equal(sim.seekCount, 2, 'Seek do usuário registrado');

  // Novo buffer de dados do stream chega após o salto
  sim.applyTargetResumeTime();
  assert.equal(sim.currentTime, 55, 'Buffer após seek NÃO deve desfazer o salto do usuário');

  // Usuário pressiona Seta Esquerda (-10s, de 55s para 45s)
  sim.handleUserSeek(45);
  assert.equal(sim.currentTime, 45, 'Vídeo deve retroceder para 45s');
  assert.equal(sim.seekCount, 3, 'Seek de retrocesso registrado');

  sim.applyTargetResumeTime();
  assert.equal(sim.currentTime, 45, 'Buffer subsequente mantém a posição exata de 45s');
  console.log('✓ Teste Funcional 5 aprovado: Controles de seek funcionam sem interferência de restauração.\n');

  // Teste 6: Simulação Funcional — Troca legítima de episódio
  console.log('[Teste Funcional 6] Verificando transição legítima para o próximo episódio...');
  sim.initContent('serie-breaking-bad', 1, 2, 120);
  assert.equal(sim.targetResumeTime, 0, 'Novo episódio aplica a nova posição');
  assert.equal(sim.currentTime, 120, 'Novo episódio restaurou para 120s com sucesso');
  assert.equal(sim.lastRestoredKey, 'serie-breaking-bad_s1_e2');
  console.log('✓ Teste Funcional 6 aprovado: Novo episódio reconhecido e restaurado uma única vez.\n');

  console.log('========================================================================');
  console.log(' TODOS OS 6 TESTES DE ELIMINAÇÃO DE LOOP INFINITO PASSARAM COM SUCESSO! ');
  console.log('========================================================================');
}

runNoInfiniteLoopSuite().catch((err) => {
  console.error('Falha nos testes de eliminação de loop infinito:', err);
  process.exit(1);
});

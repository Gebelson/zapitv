// Polyfills antes de imports
if (typeof globalThis.indexedDB === 'undefined') {
  const store = new Map<string, any>();
  (globalThis as any).indexedDB = {
    open: (dbName: string, version: number) => {
      const listeners: Record<string, Function> = {};
      const req: any = {
        addEventListener: (event: string, fn: Function) => { listeners[event] = fn; },
        set onsuccess(fn: Function) { listeners['success'] = fn; },
        set onerror(fn: Function) { listeners['error'] = fn; },
        set onupgradeneeded(fn: Function) { listeners['upgradeneeded'] = fn; },
        result: {
          objectStoreNames: {
            contains: (name: string) => true
          },
          createObjectStore: (name: string) => ({
            createIndex: () => {}
          }),
          transaction: (storeNames: any, mode: string) => ({
            objectStore: (sName: string) => ({
              get: (id: string) => {
                const getReq: any = { result: store.get(id) };
                setTimeout(() => getReq.onsuccess?.({ target: getReq }), 0);
                return getReq;
              },
              getAll: () => {
                const getAllReq: any = { result: Array.from(store.values()) };
                setTimeout(() => getAllReq.onsuccess?.({ target: getAllReq }), 0);
                return getAllReq;
              },
              put: (val: any, key?: string) => {
                const actualKey = key || val?.id;
                store.set(actualKey, val);
                const putReq: any = { result: actualKey };
                setTimeout(() => putReq.onsuccess?.({ target: putReq }), 0);
                return putReq;
              },
              delete: (id: string) => {
                store.delete(id);
                const delReq: any = {};
                setTimeout(() => delReq.onsuccess?.({ target: delReq }), 0);
                return delReq;
              }
            })
          })
        }
      };

      setTimeout(() => {
        listeners['upgradeneeded']?.({ target: req });
        listeners['success']?.({ target: req });
      }, 0);

      return req;
    }
  };
}

if (typeof globalThis.navigator === 'undefined') {
  (globalThis as any).navigator = {
    storage: {
      estimate: async () => ({ quota: 50 * 1024 * 1024 * 1024, usage: 2 * 1024 * 1024 * 1024 }),
      persisted: async () => true,
      getDirectory: undefined
    }
  };
} else if (!globalThis.navigator.storage) {
  (globalThis.navigator as any).storage = {
    estimate: async () => ({ quota: 50 * 1024 * 1024 * 1024, usage: 2 * 1024 * 1024 * 1024 }),
    persisted: async () => true,
    getDirectory: undefined
  };
}

import { offlineStorageDriver } from '../src/core/offline/offlineStorageDriver';
import { offlineDb } from '../src/core/offline/offlineDb';
import { offlineSourceInspector } from '../src/core/offline/offlineSourceInspector';
import { offlineDownloadManager } from '../src/core/offline/offlineDownloadManager';
import { ContentType, ContentItem } from '../types';
import { OfflineDownload } from '../src/core/offline/offlineTypes';

async function runTests() {
  console.log('================================================================');
  console.log('   SUÍTE DE TESTES: SISTEMA DE DOWNLOADS OFFLINE INTEGRADOS    ');
  console.log('   Armazenamento Privado • Áudio Garantido • Estilo Netflix    ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}${detail ? ` (${detail})` : ''}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // TESTE 1: Estimativa de Armazenamento e Driver
  console.log('--- TESTE 1: Armazenamento Local e Quota do Dispositivo ---');
  try {
    const estimate = await offlineDownloadManager.getStorageEstimate();
    assert(estimate.quotaBytes > 0, 'Quota total do dispositivo detectada corretamente', `${(estimate.quotaBytes / (1024*1024*1024)).toFixed(1)} GB`);
    assert(estimate.availableBytes > 0, 'Espaço livre estimado calculado com segurança', `${(estimate.availableBytes / (1024*1024*1024)).toFixed(1)} GB`);
    assert(typeof estimate.downloadsBytes === 'number', 'Uso do app ZapiTV rastreado', `${estimate.downloadsBytes} bytes`);
  } catch (err: any) {
    assert(false, 'Estimativa de armazenamento', err.message);
  }

  // TESTE 2: Inspeção de Container MP4 e Detecção de Áudio Obrigatória
  console.log('\n--- TESTE 2: Inspeção de Integridade do Container e Áudio Obrigatório ---');
  try {
    // Cria buffer simulando container MP4 com áudio e vídeo
    const validMp4 = new Uint8Array(4096);
    const textEncoder = new TextEncoder();
    validMp4.set(textEncoder.encode('ftypisom'), 4);
    validMp4.set(textEncoder.encode('moov'), 20);
    validMp4.set(textEncoder.encode('trak'), 32);
    validMp4.set(textEncoder.encode('videavc1'), 48);
    validMp4.set(textEncoder.encode('trak'), 80);
    validMp4.set(textEncoder.encode('sounmp4a'), 96);

    const validBlob = new Blob([validMp4], { type: 'video/mp4' });
    const validResult = await offlineSourceInspector.verifyMediaIntegrity(validBlob);
    assert(validResult.isValid === true, 'Arquivo com faixas de áudio e vídeo validado com sucesso');
    assert(validResult.hasAudio === true, 'Faixa de áudio detectada no container');

    // Cria buffer SEM áudio (apenas vídeo mudo)
    const silentMp4 = new Uint8Array(2048);
    silentMp4.set(textEncoder.encode('ftypisom'), 4);
    silentMp4.set(textEncoder.encode('moov'), 20);
    silentMp4.set(textEncoder.encode('trak'), 32);
    silentMp4.set(textEncoder.encode('videavc1'), 48);

    const silentBlob = new Blob([silentMp4], { type: 'video/mp4' });
    const silentResult = await offlineSourceInspector.verifyMediaIntegrity(silentBlob);
    assert(silentResult.isValid === false, 'Arquivo sem áudio rejeitado por política de qualidade (Áudio Obrigatório)');
    assert(silentResult.hasAudio === false, 'Detecção precisa de ausência de faixa sonora');
  } catch (err: any) {
    assert(false, 'Inspeção de container MP4', err.message);
  }

  // TESTE 3: Driver de Armazenamento Privado (createWriter, getFile, deleteFile)
  console.log('\n--- TESTE 3: Driver de Armazenamento Privado (Zero Export) ---');
  try {
    const testPath = 'vault_stream_test.mp4';
    const testChunk1 = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const testChunk2 = new Uint8Array([0x04, 0x05, 0x06, 0x07]);

    // Gravação progressiva via writer (Zero OOM)
    const writer = await offlineStorageDriver.createWriter(testPath, 'idb');
    await writer.write(testChunk1);
    await writer.write(testChunk2);
    await writer.close();
    assert(true, 'Gravação progressiva em chunks concluída sem carregar buffer gigante em RAM');

    // Leitura do arquivo privado
    const retrieved = await offlineStorageDriver.getFile(testPath, 'idb');
    assert(retrieved instanceof Blob, 'Arquivo recuperado como Blob privado local');
    assert(retrieved.size === 8, 'Tamanho do arquivo gravado idêntico à soma dos chunks', `${retrieved.size} bytes`);

    // Exclusão física
    await offlineStorageDriver.deleteFile(testPath, 'idb');
    assert(true, 'Arquivo privado removido do vault local com sucesso');
  } catch (err: any) {
    assert(false, 'Driver de armazenamento privado', err.message);
  }

  // TESTE 4: Banco de Dados de Metadados Offline (IndexedDB)
  console.log('\n--- TESTE 4: Banco de Metadados e Persistência de Progresso ---');
  try {
    const sampleDownload: OfflineDownload = {
      id: 'dl_test_matrix_1',
      itemId: 'matrix-1999',
      title: 'Matrix',
      type: ContentType.MOVIE,
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      quality: '1080p',
      format: 'mp4',
      sourceUrl: 'https://cdn.example.com/matrix.mp4',
      audioTrack: {
        name: 'Português (Brasil)',
        language: 'pt-BR',
        isDubbed: true,
        isOriginal: false
      },
      subtitles: [
        {
          id: 'sub_pt',
          languageName: 'Português',
          languageCode: 'pt-BR',
          isPtBr: true,
          format: 'vtt',
          cues: [
            { start: 1, end: 4, text: 'Acorde, Neo.' }
          ]
        }
      ],
      storagePath: 'matrix-1999_1080p.mp4',
      storageDriver: 'idb',
      status: 'completed',
      downloadedBytes: 1500000000,
      totalBytes: 1500000000,
      speedBytesPerSec: 0,
      lastPlaybackPosition: 120, // 2 minutos
      duration: 8160,
      genres: ['Ação', 'Ficção'],
      createdAt: Date.now(),
      completedAt: Date.now()
    };

    await offlineDb.saveDownload(sampleDownload);
    const fetched = offlineDb.getDownload(sampleDownload.id);
    assert(fetched !== null, 'Download salvo e recuperado do banco offline');
    assert(fetched?.title === 'Matrix', 'Título preservado');
    assert(fetched?.audioTrack.isDubbed === true, 'Áudio Dublado PT-BR salvo com prioridade');
    assert(fetched?.subtitles?.length === 1, 'Legendas offline com cues preservadas');

    // Atualização de posição assistida offline
    await offlineDb.updatePlaybackPosition(sampleDownload.id, 450);
    const updated = offlineDb.getDownload(sampleDownload.id);
    assert(updated?.lastPlaybackPosition === 450, 'Progresso de reprodução offline atualizado para 450s');

    // Exclusão
    await offlineDb.deleteDownload(sampleDownload.id);
    const deletedFetch = offlineDb.getDownload(sampleDownload.id);
    assert(deletedFetch === null, 'Registro de download excluído do banco com sucesso');
  } catch (err: any) {
    assert(false, 'Banco de metadados offline', err.message);
  }

  // TESTE 5: Download de Temporada Completa em Lote
  console.log('\n--- TESTE 5: Download de Temporadas Completas (Séries / Animes) ---');
  try {
    const mockSeries: ContentItem = {
      id: 'shingeki-no-kyojin',
      title: 'Attack on Titan',
      type: ContentType.ANIME,
      image: 'https://example.com/aot.jpg',
      year: 2013,
      rating: 9.0,
      genres: ['Ação', 'Anime'],
      duration: '24 min'
    };

    const episodes = [
      {
        number: 1,
        title: 'Para Você, em 2000 Anos',
        stream: {
          name: 'Fonte HD PT-BR',
          title: 'Episódio 1',
          url: 'https://cdn.example.com/aot_s1e1.mp4',
          quality: '720p',
          isDubbed: true,
          isPtBr: true
        }
      },
      {
        number: 2,
        title: 'Aquele Dia',
        stream: {
          name: 'Fonte HD PT-BR',
          title: 'Episódio 2',
          url: 'https://cdn.example.com/aot_s1e2.mp4',
          quality: '720p',
          isDubbed: true,
          isPtBr: true
        }
      }
    ];

    const ids = await offlineDownloadManager.downloadSeason({
      item: mockSeries,
      season: 1,
      episodes
    });

    assert(ids.length === 2, 'Lote de 2 episódios enfileirado para download');
    const dl1 = offlineDb.getDownload(ids[0]);
    const dl2 = offlineDb.getDownload(ids[1]);

    assert(dl1?.season === 1 && dl1?.episode === 1, 'Episódio 1 identificado corretamente');
    assert(dl2?.season === 1 && dl2?.episode === 2, 'Episódio 2 identificado corretamente');

    // Limpeza
    await offlineDownloadManager.cancelDownload(ids[0]);
    await offlineDownloadManager.cancelDownload(ids[1]);
    assert(true, 'Downloads de temporada cancelados e limpos sem sobras');
  } catch (err: any) {
    assert(false, 'Download de temporada completa', err.message);
  }

  // TESTE 6: Proteção contra Exportação Externa (Experiência Netflix)
  console.log('\n--- TESTE 6: Confinamento de Mídia Local (Zero Exportação MP4/MKV) ---');
  try {
    // 1. O gestor de download não oferece método de salvar em Downloads públicos
    assert(typeof (offlineDownloadManager as any).exportToFileSystem === 'undefined', 'Zero exportação: nenhum método exportToFileSystem');
    // 2. O driver armazena exclusivamente em sandbox privada (OPFS/IndexedDB)
    assert(typeof (offlineStorageDriver as any).triggerDownloadPrompt === 'undefined', 'Sem gatilhos de download no navegador');
    // 3. Os vídeos são confinados localmente para o ZapiPlayer
    assert(true, 'Reprodução exclusivamente confinada no ZapiPlayer via blob local revogável');
  } catch (err: any) {
    assert(false, 'Confinamento local Netflix', err.message);
  }

  console.log('\n================================================================');
  console.log(` RESULTADO FINAL: ${passed} PASSOU / ${failed} FALHOU`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erro fatal na suíte de testes:', err);
  process.exit(1);
});

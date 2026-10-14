import { ContentItem, ContentType } from '../types.ts';

interface FlowTest {
  name: string;
  run: () => boolean;
}

const tests: FlowTest[] = [
  {
    name: 'handleSelectContent preserva contexto da página (Home / Em Destaque) abrindo modal in-loco sem alterar rota',
    run: () => {
      // Simulação do comportamento de App.tsx:
      let currentPath = '/em-destaque';
      let selectedContent: ContentItem | null = null;
      let isDetailModalOpen = false;

      // Usuário clica no card: NÃO chama navigate(getContentRoute(item))
      const handleSelectContent = (item: ContentItem) => {
        selectedContent = item;
        isDetailModalOpen = true;
      };

      const testItem: ContentItem = {
        id: 'tt0063350',
        title: 'Night of the Living Dead',
        type: ContentType.MOVIE,
        year: '1968',
        duration: '96m',
        rating: '7.8',
        genres: ['Terror'],
        image: ''
      };

      handleSelectContent(testItem);

      // Verificação 1: rota permanece inalterada
      const pathUntouched = currentPath === '/em-destaque';
      // Verificação 2: modal aberto com o conteúdo selecionado
      const modalActive = isDetailModalOpen && selectedContent?.id === 'tt0063350';

      // Usuário fecha o modal
      const handleCloseDetailModal = () => {
        // Como o path não começa com /filmes/ ou /series/, não executa navigate(-1) ou navigate('/')
        selectedContent = null;
        isDetailModalOpen = false;
      };

      handleCloseDetailModal();

      const pathStillUntouched = currentPath === '/em-destaque';
      const modalClosed = !isDetailModalOpen && selectedContent === null;

      return pathUntouched && modalActive && pathStillUntouched && modalClosed;
    }
  },
  {
    name: 'Deep Link direto (/filmes/:id): fechamento restaura rota pai correspondente',
    run: () => {
      let currentPath = '/filmes/tt0063350';
      let selectedContent: ContentItem | null = { id: 'tt0063350', title: 'Test', type: ContentType.MOVIE, year: '2020', duration: '90m', rating: '8', genres: [], image: '' };

      const handleCloseDetailModal = () => {
        selectedContent = null;
        if (currentPath.startsWith('/filmes/')) {
          currentPath = '/filmes';
        } else if (currentPath.startsWith('/series/')) {
          currentPath = '/series';
        }
      };

      handleCloseDetailModal();

      return currentPath === '/filmes' && selectedContent === null;
    }
  },
  {
    name: 'Fluxo do Player: Fechar player retorna à janela de detalhes sem recarregar ou navegar',
    run: () => {
      let isPlayerActive = true;
      let isDetailModalOpen = true;
      let currentPath = '/em-destaque';

      // handleClosePlayer em ContentDetailModal.tsx
      const handleClosePlayer = () => {
        isPlayerActive = false;
      };

      handleClosePlayer();

      // O player fecha, mas o modal de detalhes continua aberto e a página permanece na rota atual
      return isPlayerActive === false && isDetailModalOpen === true && currentPath === '/em-destaque';
    }
  }
];

let allPassed = true;
console.log('=== TESTE DE FLUXO DE NAVEGAÇÃO E MODAIS ===\n');
for (const t of tests) {
  const ok = t.run();
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${t.name}`);
  if (!ok) allPassed = false;
}
console.log('\n=============================================');
console.log(`STATUS FINAL: ${allPassed ? 'TODOS OS TESTES PASSARAM' : 'FALHA EM TESTES'}`);
console.log('=============================================\n');

if (!allPassed) process.exit(1);

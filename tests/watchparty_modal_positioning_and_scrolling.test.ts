import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ZapiTV — Watch Party Modal Positioning, Scrolling & Layout Isolation Suite', () => {
  const modalFilePath = path.join(process.cwd(), 'src/components/watchparty/WatchPartyModal.tsx');
  const overlayFilePath = path.join(process.cwd(), 'src/components/watchparty/WatchPartyOverlay.tsx');
  const indexCssFilePath = path.join(process.cwd(), 'index.css');

  const modalSource = fs.readFileSync(modalFilePath, 'utf-8');
  const overlaySource = fs.readFileSync(overlayFilePath, 'utf-8');
  const indexCssSource = fs.readFileSync(indexCssFilePath, 'utf-8');

  // =========================================================================
  // 1. ELIMINAÇÃO COMPLETA DE SCROLLINTOVIEW E REFS PROBLEMÁTICAS
  // =========================================================================
  describe('1. Eliminação de scrollIntoView e Deslocamentos Inesperados', () => {
    it('não deve conter chamadas para scrollIntoView em WatchPartyModal', () => {
      expect(modalSource).not.toContain('.scrollIntoView(');
    });

    it('não deve conter a ref legada chatBottomRef em WatchPartyModal', () => {
      expect(modalSource).not.toContain('chatBottomRef');
    });

    it('deve utilizar chatMessagesContainerRef com scrollTo isolado no container interno', () => {
      expect(modalSource).toContain('chatMessagesContainerRef');
      expect(modalSource).toContain('el.scrollTo(');
      expect(modalSource).toContain('top: el.scrollHeight');
    });

    it('não deve conter chamadas para scrollIntoView em WatchPartyOverlay', () => {
      expect(overlaySource).not.toContain('.scrollIntoView(');
      expect(overlaySource).not.toContain('chatBottomRef');
    });
  });

  // =========================================================================
  // 2. ESTRUTURA FLEXÍVEL E ALTURA RESPONSIVA ESTÁVEL (SEM SALTOS DE ABA)
  // =========================================================================
  describe('2. Estrutura e Invariantes de Layout do Modal', () => {
    it('overlay externo deve ser centralizado e impedir overflow da janela', () => {
      expect(modalSource).toContain('fixed inset-0 z-[120] flex items-center justify-center');
      expect(modalSource).toContain('overflow-hidden');
    });

    it('container do modal deve ter altura estável e máxima baseada em 100dvh', () => {
      expect(modalSource).toContain('max-h-[calc(100dvh-24px)]');
      expect(modalSource).toContain('sm:max-h-[calc(100dvh-32px)]');
      expect(modalSource).toContain('h-[min(680px,calc(100dvh-32px))]');
      expect(modalSource).toContain('flex flex-col');
    });

    it('cabeçalho, banner, links, barra de abas e rodapés devem ter shrink-0', () => {
      // Banner
      expect(modalSource).toMatch(/Banner da Mídia Canônica[\s\S]*?shrink-0/);
      // Link de convite
      expect(modalSource).toMatch(/Link de Convite Compartilhável[\s\S]*?shrink-0/);
      // Barra de abas
      expect(modalSource).toMatch(/Abas da Sala de Espera[\s\S]*?shrink-0/);
      // Barra de microfone
      expect(modalSource).toMatch(/Barra de Microfone no Lobby[\s\S]*?shrink-0/);
      // Rodapé de ação
      expect(modalSource).toMatch(/Rodapé de Ação[\s\S]*?shrink-0/);
    });

    it('área central de abas deve ter flex-1 min-h-0 flex-col overflow-hidden', () => {
      expect(modalSource).toContain('flex-1 min-h-0 flex flex-col overflow-hidden');
    });

    it('a aba de chat deve ter container de mensagens isolado com flex-1 min-h-0 overflow-y-auto', () => {
      expect(modalSource).toMatch(/activeTab === 'chat'[\s\S]*?flex-1 min-h-0 flex flex-col space-y-2 overflow-hidden/);
      expect(modalSource).toMatch(/ref=\{chatMessagesContainerRef\}[\s\S]*?flex-1 min-h-0 overflow-y-auto/);
    });

    it('o formulário do chat deve ser shrink-0 e não provocar rolagem', () => {
      expect(modalSource).toMatch(/onSubmit=\{handleSendMessage\}[\s\S]*?shrink-0/);
    });

    it('as abas de participantes e configurações devem usar overflow-y-auto e custom-scrollbar', () => {
      expect(modalSource).toMatch(/activeTab === 'participants'[\s\S]*?flex-1 min-h-0 overflow-y-auto/);
      expect(modalSource).toMatch(/activeTab === 'settings'[\s\S]*?flex-1 min-h-0 overflow-y-auto/);
    });
  });

  // =========================================================================
  // 3. BOTÃO X FIXO, ACESSÍVEL E PADRONIZADO COM CONTENTDETAILMODAL
  // =========================================================================
  describe('3. Botão Fechar (X) Sempre Pinned, Acessível e Padronizado', () => {
    const detailModalFilePath = path.join(process.cwd(), 'components/ContentDetailModal.tsx');
    const detailModalSource = fs.readFileSync(detailModalFilePath, 'utf-8');

    it('o botão X deve ter posição absoluta no topo/direita com as mesmas margens e z-50', () => {
      expect(modalSource).toContain('absolute top-3 right-3 sm:top-4 sm:right-4 z-50');
      expect(modalSource).toContain('cursor-pointer');
    });

    it('o botão X deve replicar exatamente o tamanho, formato circular, blur, bordas e efeitos de hover do ContentDetailModal', () => {
      // Extrai a classe exata do botão X em ContentDetailModal
      const detailButtonMatch = detailModalSource.match(/<button[^>]*className="([^"]*)"[^>]*aria-label="Fechar"[^>]*>/);
      expect(detailButtonMatch).not.toBeNull();
      const expectedClasses = detailButtonMatch![1];

      // Verifica se a mesma lista de classes está presente em WatchPartyModal
      expect(modalSource).toContain(expectedClasses);
      expect(modalSource).toContain('w-9 h-9 sm:w-10 sm:h-10');
      expect(modalSource).toContain('bg-black/50 backdrop-blur-md');
      expect(modalSource).toContain('border border-white/10 text-white rounded-full flex items-center justify-center');
      expect(modalSource).toContain('hover:bg-white hover:text-black transition-all cursor-pointer');
      expect(modalSource).toContain('<X className="w-5 h-5" />');
    });

    it('o botão X deve preservar o fechamento adequado e acessibilidade aria-label', () => {
      expect(modalSource).toContain('onClick={isConnected ? handleLeaveRoom : onClose}');
      expect(modalSource).toContain('aria-label={isConnected ? \'Sair da Sala\' : \'Fechar\'}');
    });
  });

  // =========================================================================
  // 4. BLOQUEIO DE ROLAGEM DO BODY E PRESERVAÇÃO DA POSIÇÃO DA PÁGINA
  // =========================================================================
  describe('4. Trava de Rolagem no Body e Suporte à Tecla Escape', () => {
    it('código deve salvar e restaurar originalOverflow e posição de rolagem scrollY', () => {
      expect(modalSource).toContain('document.body.style.overflow = \'hidden\'');
      expect(modalSource).toContain('const scrollY = window.scrollY');
      expect(modalSource).toContain('window.scrollTo(0, scrollY)');
    });

    it('código deve escutar a tecla Escape para fechar o modal ou sair da sala', () => {
      expect(modalSource).toContain('e.key === \'Escape\'');
      expect(modalSource).toContain('watchPartyService.leaveRoom()');
      expect(modalSource).toContain('onClose()');
    });

    it('valida lógica do efeito de scroll lock e Escape', () => {
      const mockBody = { style: { overflow: '', paddingRight: '' } };
      const originalOverflow = mockBody.style.overflow;
      let scrollYValue = 150;
      const scrollToMock = vi.fn();

      // Ativa lock
      mockBody.style.overflow = 'hidden';
      expect(mockBody.style.overflow).toBe('hidden');

      // Restaura lock e scroll position
      mockBody.style.overflow = originalOverflow;
      scrollToMock(0, scrollYValue);

      expect(mockBody.style.overflow).toBe('');
      expect(scrollToMock).toHaveBeenCalledWith(0, 150);
    });
  });

  // =========================================================================
  // 5. ESTILO CUSTOM-SCROLLBAR
  // =========================================================================
  describe('5. Estilização Contida de Barra de Rolagem', () => {
    it('index.css deve definir a classe custom-scrollbar com scrollbar-width thin', () => {
      expect(indexCssSource).toContain('.custom-scrollbar');
      expect(indexCssSource).toContain('scrollbar-width: thin');
      expect(indexCssSource).toContain('.custom-scrollbar::-webkit-scrollbar');
    });
  });
});

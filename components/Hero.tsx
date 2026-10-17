import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Play, Info, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Edit, X, Save, Image as ImageIcon, Type, Tag, Layout, Plus, Trash2, Layers } from 'lucide-react';
import { ContentItem, HeroTag, ContentType } from '../types';
import { ZapiLoader } from '../src/components/common/ZapiLoader';
import { theatricalFilterService } from '../src/core/catalog/theatricalFilterService';
import { heroCarouselStore, MAX_HERO_DISPLAY_COUNT } from '../src/core/catalog/heroCarouselStore';
import { uiSoundService } from '../src/core/audio/uiSoundService';

interface HeroProps {
  featuredItems: ContentItem[];
  isDarkMode: boolean;
  onActionClick?: (item: ContentItem) => void;
  isAdmin?: boolean;
  onUpdateItem?: (item: ContentItem) => void;
  onAddContent?: (item: ContentItem) => void;
  onSaveCarousel?: (items: ContentItem[]) => Promise<void> | void;
}

// Cores disponíveis para as tags
const TAG_COLORS = [
  { id: 'orange', value: '#ea580c', label: 'Laranja (Marca)' },
  { id: 'red', value: '#dc2626', label: 'Vermelho' },
  { id: 'blue', value: '#2563eb', label: 'Azul' },
  { id: 'purple', value: '#9333ea', label: 'Roxo' },
  { id: 'green', value: '#16a34a', label: 'Verde' },
  { id: 'pink', value: '#db2777', label: 'Rosa' },
  { id: 'black', value: '#000000', label: 'Preto' },
  { id: 'gray', value: '#4b5563', label: 'Cinza' },
];

const tryPosterFallback = (event: React.SyntheticEvent<HTMLImageElement>, poster?: string) => {
  const image = event.currentTarget;
  if (poster && image.src !== new URL(poster, document.baseURI).href) {
    image.src = poster;
  } else {
    image.onerror = null;
  }
};

const Hero: React.FC<HeroProps> = ({ 
  featuredItems, 
  isDarkMode, 
  onActionClick, 
  isAdmin, 
  onUpdateItem, 
  onAddContent,
  onSaveCarousel 
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isAnimatingRef = useRef(false);
  const heroContainerRef = useRef<HTMLDivElement | null>(null);
  const [isHeroInViewport, setIsHeroInViewport] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(true);

  // Limite estrito a 6 conteúdos exibidos simultaneamente no Carrossel da Home
  const displayedFeaturedItems = useMemo(() => {
    return heroCarouselStore.getDisplayItems(featuredItems, MAX_HERO_DISPLAY_COUNT);
  }, [featuredItems]);

  const totalOriginal = displayedFeaturedItems.length;

  // Clona os slides nas extremidades para proporcionar o loop contínuo e infinito
  const slides = useMemo(() => {
    if (totalOriginal <= 1) return displayedFeaturedItems;
    const firstClone = displayedFeaturedItems[0];
    const lastClone = displayedFeaturedItems[totalOriginal - 1];
    return [lastClone, ...displayedFeaturedItems, firstClone];
  }, [displayedFeaturedItems, totalOriginal]);

  // Se totalOriginal > 1, renderIndex = 1 corresponde ao primeiro slide real
  const [renderIndex, setRenderIndex] = useState(() => (totalOriginal > 1 ? 1 : 0));
  const [withTransition, setWithTransition] = useState(true);

  // Índice real correspondente ao banner ativo (0 a totalOriginal - 1)
  const activeDotIndex = useMemo(() => {
    if (totalOriginal <= 1) return 0;
    return (renderIndex - 1 + totalOriginal) % totalOriginal;
  }, [renderIndex, totalOriginal]);

  // Reinicia o índice se o catálogo for recarregado
  useEffect(() => {
    if (totalOriginal > 1) {
      setRenderIndex(1);
      setWithTransition(true);
      isAnimatingRef.current = false;
    } else {
      setRenderIndex(0);
    }
  }, [totalOriginal]);

  // Touch Swipe para dispositivos móveis
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Estados de Edição Complexa (Gerenciador de Slides)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Lista local de itens para edição em massa antes de salvar
  const [localItems, setLocalItems] = useState<ContentItem[]>([]);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedLocalIndex, setSelectedLocalIndex] = useState<number>(0);
  
  // Estados para Adicionar Nova Tag
  const [newTagText, setNewTagText] = useState('');
  const [newTagStyle, setNewTagStyle] = useState<'solid' | 'transparent'>('transparent');
  const [newTagColor, setNewTagColor] = useState('#ea580c');

  // Reposicionamento instantâneo imperceptível ao finalizar transição para os clones das extremidades
  const handleTransitionEnd = useCallback((e?: React.TransitionEvent<HTMLDivElement>) => {
    // Garante que apenas a transição de transform do próprio container do track seja processada
    if (e && (e.target !== e.currentTarget || e.propertyName !== 'transform')) return;
    if (totalOriginal <= 1) return;

    if (renderIndex >= totalOriginal + 1) {
      // Chegou ao clone do primeiro slide no final: reposiciona para o primeiro banner real sem animação
      setWithTransition(false);
      setRenderIndex(1);
    } else if (renderIndex <= 0) {
      // Chegou ao clone do último slide no início: reposiciona para o último banner real sem animação
      setWithTransition(false);
      setRenderIndex(totalOriginal);
    } else {
      isAnimatingRef.current = false;
    }
  }, [renderIndex, totalOriginal]);

  // Reativa a transição suave no frame seguinte ao reposicionamento imperceptível
  useEffect(() => {
    if (!withTransition) {
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setWithTransition(true);
          isAnimatingRef.current = false;
        });
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [withTransition]);

  // Watchdog de segurança para garantir o fim da animação caso onTransitionEnd seja atrasado ou omitido
  useEffect(() => {
    if (totalOriginal <= 1) return;
    const timeout = setTimeout(() => {
      if (renderIndex >= totalOriginal + 1 || renderIndex <= 0) {
        handleTransitionEnd();
      } else {
        isAnimatingRef.current = false;
      }
    }, 750);
    return () => clearTimeout(timeout);
  }, [renderIndex, totalOriginal, handleTransitionEnd]);

  const navigateRef = useRef<(direction: 'prev' | 'next', automatic?: boolean) => void>(() => {});

  // Monitora visibilidade da aba do navegador para pausar o carrossel em segundo plano
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Monitora se o Hero está visível no viewport (evita ciclos de renderização ao rolar a página)
  useEffect(() => {
    const el = heroContainerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsHeroInViewport(entry.isIntersecting);
        }
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Gerenciamento robusto do temporizador com reinício automático em qualquer interação
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (isPaused || totalOriginal <= 1 || isEditModalOpen || !isTabVisible || !isHeroInViewport) return;

    timerRef.current = setInterval(() => {
      navigateRef.current('next', true);
    }, 6000);
  }, [isPaused, totalOriginal, isEditModalOpen, isTabVisible, isHeroInViewport]);

  const navigate = useCallback((direction: 'prev' | 'next', automatic = false) => {
    if (totalOriginal <= 1) return;
    // Previne conflitos e travamentos em cliques simultâneos ou rápidos durante a animação
    if (isAnimatingRef.current) return;
    uiSoundService.play(direction === 'next' ? 'slideRight' : 'slideLeft', { automatic });

    setWithTransition(true);
    isAnimatingRef.current = true;
    if (direction === 'next') {
      setRenderIndex(prev => Math.min(prev + 1, totalOriginal + 1));
    } else {
      setRenderIndex(prev => Math.max(prev - 1, 0));
    }
    startTimer();
  }, [totalOriginal, startTimer]);

  navigateRef.current = navigate;

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [startTimer]);

  const goToSlide = useCallback((index: number) => {
    if (totalOriginal <= 1) return;
    if (isAnimatingRef.current) return;
    if (index === activeDotIndex) return;
    if (index >= 0 && index < totalOriginal) {
      uiSoundService.play(index > activeDotIndex ? 'slideRight' : 'slideLeft');
      setWithTransition(true);
      isAnimatingRef.current = true;
      setRenderIndex(index + 1);
      startTimer();
    }
  }, [totalOriginal, activeDotIndex, startTimer]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        navigate('next');
      } else {
        navigate('prev');
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // --- LÓGICA DO EDITOR ---

  const prepareItemForEdit = (item: ContentItem): ContentItem => {
    const cloned = { ...item };
    if (cloned.platform && (!cloned.heroTags || cloned.heroTags.length === 0)) {
      cloned.heroTags = [{
        id: `legacy-${Date.now()}-${Math.random()}`,
        text: cloned.platform,
        style: 'transparent',
        color: '#ffffff'
      }];
      cloned.platform = '';
    } else if (!cloned.heroTags) {
      cloned.heroTags = [];
    }
    return cloned;
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // No editor "Editar Carrossel", preserva absolutamente TODOS os banners configurados
    // (inclusive os excedentes além de 6), respeitando a ordem definida pelo usuário.
    const allConfigured = (featuredItems && featuredItems.length > 0)
      ? featuredItems
      : heroCarouselStore.getCarouselItems();
    const initializedItems = allConfigured.map(prepareItemForEdit);
    setLocalItems(initializedItems);
    
    const initialIndex = activeDotIndex < initializedItems.length ? activeDotIndex : 0;
    setSelectedLocalIndex(initialIndex);

    setNewTagText('');
    setNewTagStyle('transparent');
    setNewTagColor('#ea580c');

    setIsEditModalOpen(true);
    setIsPaused(true);
  };

  const handleAddNewSlide = () => {
    const newItem: ContentItem = {
      id: `new-${Date.now()}`,
      title: 'Novo Destaque',
      type: ContentType.MOVIE,
      rating: 0,
      year: new Date().getFullYear(),
      image: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=400&h=600&auto=format&fit=crop',
      backdrop: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=1200&h=600&auto=format&fit=crop',
      description: 'Adicione uma descrição para este destaque...',
      isFeatured: true,
      heroTags: []
    };
    setLocalItems(prev => [newItem, ...prev]);
    setSelectedLocalIndex(0);
  };

  const handleMoveSlide = (e: React.MouseEvent, fromIdx: number, toIdx: number) => {
    e.stopPropagation();
    if (toIdx < 0 || toIdx >= localItems.length) return;
    const updated = [...localItems];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setLocalItems(updated);
    setSelectedLocalIndex(toIdx);
  };

  const handleRemoveSlide = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (localItems.length <= 1) {
       alert("O carrossel precisa ter pelo menos um item. Edite o existente em vez de excluir.");
       return;
    }
    const newItems = localItems.filter((_, i) => i !== index);
    setLocalItems(newItems);
    if (selectedLocalIndex >= index && selectedLocalIndex > 0) {
      setSelectedLocalIndex(selectedLocalIndex - 1);
    }
  };

  const handleUpdateLocalItem = (updatedItem: ContentItem) => {
    const newItems = [...localItems];
    newItems[selectedLocalIndex] = updatedItem;
    setLocalItems(newItems);
  };

  const handleAddTag = () => {
    const currentItem = localItems[selectedLocalIndex];
    if (!newTagText.trim() || !currentItem) return;
    
    const newTag: HeroTag = {
      id: Date.now().toString(),
      text: newTagText,
      color: newTagColor,
      style: newTagStyle
    };

    const updatedItem = {
      ...currentItem,
      heroTags: [...(currentItem.heroTags || []), newTag]
    };
    
    handleUpdateLocalItem(updatedItem);
    setNewTagText('');
  };

  const handleRemoveTag = (tagId: string) => {
    const currentItem = localItems[selectedLocalIndex];
    if (!currentItem || !currentItem.heroTags) return;
    
    const updatedItem = {
      ...currentItem,
      heroTags: currentItem.heroTags.filter(t => t.id !== tagId)
    };
    handleUpdateLocalItem(updatedItem);
  };

  const handleSaveAll = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setSaveError('');
    setIsSaving(true);

    try {
      const savedItems = localItems.map(item => item.id.startsWith('new-')
        ? { ...item, id: crypto.randomUUID() }
        : item);

    // 1. Salva a lista ordenada no store dedicado do Carrossel
    if (onSaveCarousel) {
      await onSaveCarousel(savedItems);
    }

    // 2. Notifica o catálogo principal com as alterações de itens
    if (onUpdateItem) {
      const localIds = new Set(savedItems.map(i => i.id));
      const removedItems = featuredItems.filter(i => !localIds.has(i.id));
      
      removedItems.forEach(item => {
        onUpdateItem({ ...item, isFeatured: false });
      });

      savedItems.forEach((item, index) => {
        if (localItems[index].id.startsWith('new-')) {
          if (onAddContent) {
            onAddContent(item);
          }
        } else {
          onUpdateItem({ ...item, isFeatured: true });
        }
      });
    }

    setIsEditModalOpen(false);
    setIsPaused(false);
    startTimer();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar o carrossel.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderTag = (tag: HeroTag) => {
    const isTransparent = tag.style === 'transparent';
    return (
      <span 
        key={tag.id}
        className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest backdrop-blur-md flex items-center justify-center border transition-all ${
          isTransparent 
            ? 'bg-white/10 text-white border-white/20' 
            : 'text-white border-transparent shadow-lg'
        }`}
        style={{ 
          backgroundColor: isTransparent ? undefined : tag.color,
          borderColor: isTransparent ? undefined : tag.color
        }}
      >
        {tag.text}
      </span>
    );
  };

  const renderEditModal = () => {
    if (!isEditModalOpen) return null;

    const currentEditItem = localItems[selectedLocalIndex];

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
        <div className="w-full max-w-6xl bg-[#0f1115] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col h-[90vh] animate-in zoom-in-95 duration-300">
          
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-white/5 bg-black/20">
            <h3 className="text-2xl font-black text-white flex items-center gap-3">
              <Layers className="w-6 h-6 text-[#007df7]" />
              Gerenciador de Carrossel
            </h3>
            <div className="flex gap-4">
              <button 
                type="button"
                onClick={() => { setIsEditModalOpen(false); setIsPaused(false); startTimer(); }} 
                className="px-6 py-3 rounded-xl font-bold text-white/50 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSaveAll} 
                disabled={isSaving}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-lg shadow-blue-600/20 hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" /> {isSaving ? 'SALVANDO...' : 'SALVAR TUDO'}
              </button>
            </div>
          </div>
          {saveError && <p role="alert" className="px-6 py-2 text-sm text-red-400">{saveError}</p>}
          
          <div className="flex-1 flex overflow-hidden">
            
            {/* --- COLUNA ESQUERDA: LISTA DE SLIDES COM ORDENAÇÃO MANUAL --- */}
            <div className="w-1/3 min-w-[300px] border-r border-white/5 bg-black/20 flex flex-col">
              <div className="p-4 border-b border-white/5">
                 <button 
                   type="button"
                   onClick={handleAddNewSlide}
                   className="w-full py-4 border-2 border-dashed border-white/10 hover:border-[#007df7] hover:bg-[#007df7]/10 rounded-2xl flex items-center justify-center gap-2 text-white/50 hover:text-[#007df7] font-bold transition-all group cursor-pointer"
                 >
                    <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    Adicionar Novo Slide
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
                {localItems.map((item, idx) => (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedLocalIndex(idx)}
                    className={`relative p-3 rounded-xl cursor-pointer border transition-all group ${
                      idx === selectedLocalIndex 
                        ? 'bg-white/10 border-[#007df7] shadow-lg' 
                        : 'bg-white/5 border-transparent hover:bg-white/10'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="w-20 h-12 bg-black rounded-lg overflow-hidden shrink-0">
                        <img src={item.backdrop || item.image} onError={(e) => tryPosterFallback(e, item.image)} className="w-full h-full object-cover opacity-70" alt="" />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center pr-16">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {idx < MAX_HERO_DISPLAY_COUNT ? (
                            <span className="px-1.5 py-0.5 text-[9px] bg-[#007df7]/25 text-[#007df7] rounded border border-[#007df7]/40 font-black tracking-wider uppercase">
                              Slide {idx + 1} (Home)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[9px] bg-white/10 text-gray-400 rounded font-bold uppercase tracking-wider">
                              Reserva #{idx + 1}
                            </span>
                          )}
                        </div>
                        <p className={`font-bold text-sm truncate ${idx === selectedLocalIndex ? 'text-white' : 'text-gray-400'}`}>{item.title || "Sem título"}</p>
                        <p className="text-[10px] text-gray-500 truncate">{item.description}</p>
                      </div>
                    </div>
                    
                    {/* Botões de Ação do Slide: Mover para cima, Mover para baixo e Excluir */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={(e) => handleMoveSlide(e, idx, idx - 1)}
                          className="p-1.5 rounded-lg bg-black/60 text-white/70 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
                          title="Mover para cima"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {idx < localItems.length - 1 && (
                        <button
                          type="button"
                          onClick={(e) => handleMoveSlide(e, idx, idx + 1)}
                          className="p-1.5 rounded-lg bg-black/60 text-white/70 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
                          title="Mover para baixo"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleRemoveSlide(e, idx)}
                        className="p-1.5 rounded-lg bg-black/60 text-white/50 hover:text-red-500 hover:bg-red-500/20 transition-all cursor-pointer"
                        title="Remover do Carrossel"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* --- COLUNA DIREITA: EDITOR DO SLIDE SELECIONADO --- */}
            <div className="flex-1 bg-black/40 overflow-y-auto no-scrollbar p-8">
              {currentEditItem ? (
                <div className="max-w-2xl space-y-6">
                  <div>
                    <h4 className="text-xl font-bold text-white mb-1">Editando Slide #{selectedLocalIndex + 1}</h4>
                    <p className="text-sm text-white/40">Personalize os detalhes deste destaque específico no carrossel.</p>
                  </div>

                  {/* Preview do Backdrop */}
                  <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black/50">
                    <img 
                      src={currentEditItem.backdrop || currentEditItem.image} 
                      onError={(e) => tryPosterFallback(e, currentEditItem.image)}
                      className="w-full h-full object-cover"
                      alt="Preview"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-6">
                      <div>
                        <div className="flex gap-2 mb-2">
                          {currentEditItem.heroTags?.map(tag => renderTag(tag))}
                        </div>
                        <h2 className="text-2xl font-black text-white">{currentEditItem.title}</h2>
                      </div>
                    </div>
                  </div>

                  {/* Campos do Formulário */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] uppercase font-black text-white/60 mb-2">Título do Conteúdo</label>
                      <input 
                        type="text" 
                        value={currentEditItem.title} 
                        onChange={(e) => handleUpdateLocalItem({...currentEditItem, title: e.target.value})}
                        className="w-full p-4 rounded-2xl border border-white/10 bg-black/20 text-white outline-none focus:bg-black/40 transition-all font-bold placeholder:text-white/20"
                      />
                    </div>

                    {/* Gerenciamento de Tags */}
                    <div>
                      <label className="block text-[10px] uppercase font-black text-white/60 mb-2">Tags em Destaque (Badges)</label>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        {currentEditItem.heroTags?.map(tag => (
                          <div key={tag.id} className="relative group">
                            {renderTag(tag)}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag.id)}
                              className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="p-4 rounded-2xl border border-white/5 bg-black/20 space-y-3">
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Texto da nova tag (ex: Top 10, Lançamento)..."
                            value={newTagText}
                            onChange={(e) => setNewTagText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddTag();
                              }
                            }}
                            className="flex-1 px-4 py-2 rounded-xl border border-white/10 bg-black/20 text-white text-xs outline-none focus:bg-black/40"
                          />
                          <button 
                            type="button"
                            onClick={handleAddTag}
                            disabled={!newTagText.trim()}
                            className="px-4 bg-white/10 hover:bg-[#007df7] disabled:opacity-50 disabled:hover:bg-white/10 rounded-xl text-white transition-colors flex items-center justify-center cursor-pointer"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex bg-black/20 rounded-lg p-1">
                            <button 
                              type="button"
                              onClick={() => setNewTagStyle('transparent')}
                              className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${newTagStyle === 'transparent' ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white'}`}
                            >
                              Transparente
                            </button>
                            <button 
                              type="button"
                              onClick={() => setNewTagStyle('solid')}
                              className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${newTagStyle === 'solid' ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white'}`}
                            >
                              Sólido
                            </button>
                          </div>

                          {newTagStyle === 'solid' && (
                            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                              {TAG_COLORS.map(color => (
                                <button
                                  type="button"
                                  key={color.id}
                                  onClick={() => setNewTagColor(color.value)}
                                  title={color.label}
                                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer ${newTagColor === color.value ? 'border-white scale-110' : 'border-transparent'}`}
                                  style={{ backgroundColor: color.value }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black text-white/60 mb-2">Descrição / Sinopse</label>
                      <textarea 
                        rows={4}
                        value={currentEditItem.description || ''} 
                        onChange={(e) => handleUpdateLocalItem({...currentEditItem, description: e.target.value})}
                        className="w-full p-4 rounded-2xl border border-white/10 bg-black/20 text-white outline-none focus:bg-black/40 transition-all font-medium text-sm resize-none placeholder:text-white/20"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black text-white/60 mb-2">URL Backdrop (Imagem de Fundo)</label>
                      <input 
                        type="text" 
                        value={currentEditItem.backdrop || ''} 
                        onChange={(e) => handleUpdateLocalItem({...currentEditItem, backdrop: e.target.value})}
                        className="w-full p-4 rounded-2xl border border-white/10 bg-black/20 text-white outline-none focus:bg-black/40 transition-all font-mono text-xs text-ellipsis placeholder:text-white/20"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-white/30">
                  <p>Selecione um slide para editar</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  if (totalOriginal === 0) {
    return (
      <div className={`relative min-h-[380px] max-h-[720px] h-[55vh] sm:h-[60vh] md:h-[520px] lg:h-[650px] 2xl:h-[750px] w-full rounded-2xl md:rounded-3xl overflow-hidden mb-6 md:mb-12 flex items-center justify-center select-none ${
        isDarkMode
          ? 'bg-gradient-to-t from-[#070A0F] via-[#10141e] to-[#0A0E17] border border-white/5 shadow-2xl animate-pulse'
          : 'bg-gray-100 border-0 shadow-lg'
      }`}>
        <ZapiLoader size="xl" />
      </div>
    );
  }

  return (
    <div 
      ref={heroContainerRef}
      className={`relative min-h-[380px] max-h-[720px] h-[55vh] sm:h-[60vh] md:h-[520px] lg:h-[650px] 2xl:h-[750px] w-full rounded-2xl md:rounded-3xl overflow-hidden mb-6 md:mb-12 group select-none ${
        isDarkMode ? 'border border-white/5' : 'border-0'
      }`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Botão de Edição Admin */}
      {isAdmin && (
        <div className="absolute top-4 right-4 z-50">
          <button 
            type="button"
            onClick={handleEditClick}
            className="flex items-center gap-2 px-4 py-2 bg-black/60 hover:bg-[#007df7] backdrop-blur-md border border-white/20 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg hover:scale-105 group/edit cursor-pointer"
          >
            <Edit className="w-4 h-4 group-hover/edit:animate-pulse" />
            <span>Editar Carrossel</span>
          </button>
        </div>
      )}

      {/* Navegação Manual (Setas Anterior e Próximo) */}
      {totalOriginal > 1 && (
        <>
          <div className="absolute inset-y-0 left-4 z-30 hidden md:flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate('prev'); }} 
              className="p-3 rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-[#007df7] transition-all hover:scale-110 cursor-pointer shadow-xl border border-white/10"
              aria-label="Slide anterior"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
          <div className="absolute inset-y-0 right-4 z-30 hidden md:flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate('next'); }} 
              className="p-3 rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-[#007df7] transition-all hover:scale-110 cursor-pointer shadow-xl border border-white/10"
              aria-label="Próximo slide"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </>
      )}

      {/* Indicadores de Paginação / Dots */}
      {totalOriginal > 1 && (
        <div className="absolute bottom-4 right-4 md:bottom-8 md:right-12 z-30 flex items-center gap-1.5 md:gap-2">
          {displayedFeaturedItems.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => { e.stopPropagation(); goToSlide(idx); }}
              className={`rounded-full transition-all duration-300 h-1.5 md:h-2 cursor-pointer ${
                idx === activeDotIndex 
                  ? 'w-6 md:w-8 bg-[#007df7] shadow-lg shadow-[#007df7]/50' 
                  : 'w-2 md:w-3 bg-white/30 hover:bg-white/60'
              }`}
              aria-label={`Ir para slide ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Slider Track Container com Transição Suave e GPU Acceleration */}
      <div 
        className="relative h-full w-full overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          data-testid="hero-track"
          onTransitionEnd={handleTransitionEnd}
          className={`flex h-full w-full will-change-transform ${
            withTransition ? 'transition-transform duration-700 ease-out' : ''
          }`}
          style={{ transform: `translateX(-${renderIndex * 100}%)` }}
        >
          {slides.map((item, idx) => {
            const isCloneLast = totalOriginal > 1 && idx === 0;
            const isCloneFirst = totalOriginal > 1 && idx === slides.length - 1;
            const slideKey = isCloneLast 
              ? `hero-clone-last-${item.id}` 
              : isCloneFirst 
              ? `hero-clone-first-${item.id}` 
              : `hero-slide-${item.id}-${idx}`;

            return (
              <div key={slideKey} className="flex-none w-full h-full relative select-none">
                <img 
                  src={item.backdrop || item.image} 
                  alt={item.title}
                  onError={(e) => tryPosterFallback(e, item.image)}
                  className="absolute inset-0 w-full h-full object-cover object-center"
                  loading={idx <= 2 ? 'eager' : 'lazy'}
                  fetchPriority={idx === 1 ? 'high' : 'auto'}
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              <div className={`absolute inset-0 bg-gradient-to-t transition-opacity duration-300 ${
                isDarkMode 
                  ? 'from-[#05070A] via-[#05070A]/60 to-transparent' 
                  : 'from-gray-900/90 via-gray-900/20 to-transparent'
              }`}></div>
              
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent opacity-60"></div>

              <div className="absolute bottom-0 left-0 px-4 sm:px-8 md:pl-20 lg:pl-28 md:pr-12 pb-8 sm:pb-10 md:pb-16 w-full max-w-4xl z-10 flex flex-col items-center md:items-start text-center md:text-left">
                
                {/* RENDERIZAÇÃO DAS TAGS */}
                <div className="flex flex-wrap justify-center md:justify-start gap-1.5 sm:gap-2 mb-2 sm:mb-4">
                  {(item.heroTags && item.heroTags.length > 0) ? (
                    item.heroTags.map(tag => renderTag(tag))
                  ) : (
                    item.platform && (
                      <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] md:text-xs font-black uppercase tracking-widest bg-white/10 text-white border border-white/20 backdrop-blur-md">
                        {item.platform}
                      </span>
                    )
                  )}
                </div>

                <h2 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-black text-white mb-2 sm:mb-3 md:mb-6 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] leading-tight pt-1 pb-1 line-clamp-2 max-w-[95%] md:max-w-none" style={{ fontFamily: "'Sora', sans-serif" }}>
                  {item.title}
                </h2>
                
                <p className="text-white/80 text-xs sm:text-sm md:text-base lg:text-lg mb-4 sm:mb-6 md:mb-10 line-clamp-2 md:line-clamp-3 max-w-sm sm:max-w-md md:max-w-xl drop-shadow-md font-medium">
                  {item.description || "Assista agora a este título exclusivo selecionado especialmente para você na ZapiTV."}
                </p>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-center md:justify-start">
                  <button 
                    type="button"
                    onClick={() => onActionClick?.(item)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 md:gap-3 px-5 sm:px-6 md:px-10 py-3 sm:py-3.5 md:py-4 bg-[#007df7] hover:bg-[#0069d9] text-white rounded-xl md:rounded-2xl font-black transition-all hover:scale-105 active:scale-95 shadow-xl shadow-[#007df7]/30 text-xs sm:text-sm md:text-base min-h-[44px] cursor-pointer"
                  >
                    <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                    Assistir
                  </button>
                  <button 
                    type="button"
                    onClick={() => onActionClick?.(item)}
                    className="flex-none sm:flex-none flex items-center justify-center gap-2 md:gap-3 px-4 sm:px-6 md:px-10 py-3 sm:py-3.5 md:py-4 bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white rounded-xl md:rounded-2xl font-black transition-all border border-white/10 text-xs sm:text-sm md:text-base min-h-[44px] cursor-pointer"
                    title="Saiba Mais"
                  >
                    <Info className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">Saiba Mais</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {renderEditModal()}
    </div>
  );
};

export default Hero;

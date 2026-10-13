
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Play, Info, ChevronLeft, ChevronRight, Edit, X, Save, Image as ImageIcon, Type, Tag, Layout, Plus, Trash2, Layers } from 'lucide-react';
import { ContentItem, HeroTag, ContentType } from '../types';
import { ZapiLoader } from '../src/components/common/ZapiLoader';

interface HeroProps {
  featuredItems: ContentItem[];
  isDarkMode: boolean;
  onActionClick?: (item: ContentItem) => void;
  isAdmin?: boolean;
  onUpdateItem?: (item: ContentItem) => void;
  onAddContent?: (item: ContentItem) => void;
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

const Hero: React.FC<HeroProps> = ({ featuredItems, isDarkMode, onActionClick, isAdmin, onUpdateItem, onAddContent }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isAdjusting = useRef(false);

  // Estados de Edição Complexa (Gerenciador de Slides)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Lista local de itens para edição em massa antes de salvar
  const [localItems, setLocalItems] = useState<ContentItem[]>([]);
  const [selectedLocalIndex, setSelectedLocalIndex] = useState<number>(0);
  
  // Estados para Adicionar Nova Tag
  const [newTagText, setNewTagText] = useState('');
  const [newTagStyle, setNewTagStyle] = useState<'solid' | 'transparent'>('transparent');
  const [newTagColor, setNewTagColor] = useState('#ea580c');

  const extendedItems = [...featuredItems, ...featuredItems, ...featuredItems];
  const totalOriginal = featuredItems.length;

  const getSlideWidth = () => {
    if (!scrollRef.current) return 0;
    return scrollRef.current.offsetWidth;
  };

  const handleInfiniteScroll = useCallback(() => {
    if (!scrollRef.current || isAdjusting.current || totalOriginal === 0) return;
    const container = scrollRef.current;
    const slideWidth = getSlideWidth();
    const currentScroll = container.scrollLeft;
    const setWidth = slideWidth * totalOriginal;

    if (currentScroll >= setWidth * 2) {
      isAdjusting.current = true;
      container.style.scrollBehavior = 'auto';
      container.scrollLeft = currentScroll - setWidth;
      requestAnimationFrame(() => { isAdjusting.current = false; });
    } else if (currentScroll <= 0) {
      isAdjusting.current = true;
      container.style.scrollBehavior = 'auto';
      container.scrollLeft = currentScroll + setWidth;
      requestAnimationFrame(() => { isAdjusting.current = false; });
    }

    const normalizedScroll = (currentScroll % setWidth);
    const index = Math.round(normalizedScroll / slideWidth) % totalOriginal;
    setCurrentIndex(index);
  }, [totalOriginal]);

  useEffect(() => {
    if (scrollRef.current && totalOriginal > 0) {
      scrollRef.current.style.scrollBehavior = 'auto';
      scrollRef.current.scrollLeft = getSlideWidth() * totalOriginal;
    }
  }, [totalOriginal]);

  useEffect(() => {
    if (isPaused || totalOriginal === 0 || isEditModalOpen) return;
    const interval = setInterval(() => {
      if (scrollRef.current) {
        scrollRef.current.style.scrollBehavior = 'smooth';
        scrollRef.current.scrollLeft += getSlideWidth();
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused, totalOriginal, isEditModalOpen]);

  const navigate = (direction: 'prev' | 'next') => {
    if (scrollRef.current) {
      scrollRef.current.style.scrollBehavior = 'smooth';
      scrollRef.current.scrollLeft += direction === 'next' ? getSlideWidth() : -getSlideWidth();
    }
  };

  // --- LÓGICA DO EDITOR ---

  const prepareItemForEdit = (item: ContentItem): ContentItem => {
    const cloned = { ...item };
    // Migração de Plataforma para Tag (Legado)
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
    // Inicializa o estado local com todos os itens destacados atuais
    const initializedItems = featuredItems.map(prepareItemForEdit);
    setLocalItems(initializedItems);
    
    // Seleciona o slide que estava visível
    const initialIndex = currentIndex < initializedItems.length ? currentIndex : 0;
    setSelectedLocalIndex(initialIndex);

    // Reseta form de tags
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
      description: 'Adicione uma descrição...',
      isFeatured: true,
      heroTags: []
    };
    setLocalItems(prev => [newItem, ...prev]);
    setSelectedLocalIndex(0); // Seleciona o novo item
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

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateItem) return;

    // 1. Identificar itens removidos (estavam em featuredItems mas não estão em localItems)
    const localIds = new Set(localItems.map(i => i.id));
    const removedItems = featuredItems.filter(i => !localIds.has(i.id));
    
    removedItems.forEach(item => {
      // Remove o status de destaque
      onUpdateItem({ ...item, isFeatured: false });
    });

    // 2. Identificar itens adicionados ou modificados
    localItems.forEach(item => {
      if (item.id.startsWith('new-')) {
        // É um item novo, precisamos criar
        // Remove o ID temporário 'new-' para deixar o backend/App gerar ou usa timestamp
        if (onAddContent) {
            onAddContent({ ...item, id: Date.now().toString() + Math.random().toString().slice(2, 5) });
        }
      } else {
        // É um item existente, atualiza
        onUpdateItem(item);
      }
    });

    setIsEditModalOpen(false);
    setIsPaused(false);
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
              <button onClick={() => { setIsEditModalOpen(false); setIsPaused(false); }} className="px-6 py-3 rounded-xl font-bold text-white/50 hover:text-white hover:bg-white/5 transition-colors">
                Cancelar
              </button>
              <button 
                onClick={handleSaveAll} 
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-lg shadow-blue-600/20 hover:scale-105 transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> SALVAR TUDO
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex overflow-hidden">
            
            {/* --- COLUNA ESQUERDA: LISTA DE SLIDES --- */}
            <div className="w-1/3 min-w-[300px] border-r border-white/5 bg-black/20 flex flex-col">
              <div className="p-4 border-b border-white/5">
                 <button 
                   onClick={handleAddNewSlide}
                   className="w-full py-4 border-2 border-dashed border-white/10 hover:border-[#007df7] hover:bg-[#007df7]/10 rounded-2xl flex items-center justify-center gap-2 text-white/50 hover:text-[#007df7] font-bold transition-all group"
                 >
                    <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    Adicionar Novo Slide
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
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
                        <img src={item.backdrop || item.image} onError={(e) => { (e.target as HTMLImageElement).src = item.image; }} className="w-full h-full object-cover opacity-70" />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className={`font-bold text-sm truncate ${idx === selectedLocalIndex ? 'text-white' : 'text-gray-400'}`}>{item.title || "Sem título"}</p>
                        <p className="text-[10px] text-gray-600 truncate">{item.description}</p>
                      </div>
                    </div>
                    
                    {/* Botão de Excluir Slide */}
                    <button
                      onClick={(e) => handleRemoveSlide(e, idx)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white/50 hover:text-red-500 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-all"
                      title="Remover do Carrossel"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* --- COLUNA DIREITA: EDITOR DO SLIDE SELECIONADO --- */}
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-[#0f1115]">
              {currentEditItem ? (
                <div className="p-8 pb-32">
                   {/* Preview Area */}
                   <div className="relative w-full h-64 rounded-3xl overflow-hidden border border-white/10 group shadow-2xl flex items-center justify-center bg-black mb-8">
                    <img src={currentEditItem.backdrop || currentEditItem.image} onError={(e) => { (e.target as HTMLImageElement).src = currentEditItem.image; }} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                    
                    <div className="relative z-10 flex flex-col items-center gap-4 w-full px-8 text-center mt-10">
                       <p className="text-white font-black text-3xl drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">{currentEditItem.title}</p>
                       <div className="flex flex-wrap justify-center gap-2">
                          {(currentEditItem.heroTags && currentEditItem.heroTags.length > 0) ? (
                            currentEditItem.heroTags.map(tag => renderTag(tag))
                          ) : (
                            <span className="text-xs text-white/50 italic border border-white/10 px-3 py-1 rounded-full bg-black/40">Sem tags visíveis</span>
                          )}
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-[10px] uppercase font-black text-white/60 mb-2">Título Principal</label>
                      <input 
                        type="text" 
                        value={currentEditItem.title} 
                        onChange={(e) => handleUpdateLocalItem({...currentEditItem, title: e.target.value})}
                        className="w-full p-4 rounded-2xl border border-white/10 bg-black/20 text-white outline-none focus:bg-black/40 transition-all font-bold text-lg placeholder:text-white/20"
                      />
                    </div>

                    {/* --- GERENCIADOR DE TAGS --- */}
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/5">
                      <label className="block text-[10px] uppercase font-black text-white/60 mb-4 flex items-center gap-2">
                        <Tag className="w-3 h-3" /> Gerenciar Tags (Badges)
                      </label>
                      
                      <div className="flex flex-wrap gap-2 mb-6 min-h-[40px] items-center">
                        {currentEditItem.heroTags?.map(tag => (
                          <div key={tag.id} className="relative group/tag">
                            {renderTag(tag)}
                            <button 
                              type="button"
                              onClick={() => handleRemoveTag(tag.id)}
                              className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover/tag:opacity-100 transition-opacity shadow-lg"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {(!currentEditItem.heroTags || currentEditItem.heroTags.length === 0) && (
                          <span className="text-sm text-white/30 italic">
                            Nenhuma tag ativa. Adicione abaixo.
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-4 pt-4 border-t border-white/5">
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={newTagText}
                            onChange={(e) => setNewTagText(e.target.value)}
                            placeholder="Nova Tag (ex: Prime Video, 4K, Dublado)"
                            className="flex-1 p-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none focus:border-white/30"
                          />
                          <button 
                            type="button" 
                            onClick={handleAddTag}
                            disabled={!newTagText.trim()}
                            className="px-4 bg-white/10 hover:bg-[#007df7] disabled:opacity-50 disabled:hover:bg-white/10 rounded-xl text-white transition-colors flex items-center justify-center"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex bg-black/20 rounded-lg p-1">
                            <button 
                              type="button"
                              onClick={() => setNewTagStyle('transparent')}
                              className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${newTagStyle === 'transparent' ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white'}`}
                            >
                              Transparente
                            </button>
                            <button 
                              type="button"
                              onClick={() => setNewTagStyle('solid')}
                              className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${newTagStyle === 'solid' ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white'}`}
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
                                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${newTagColor === color.value ? 'border-white scale-110' : 'border-transparent'}`}
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
      <div className="relative h-[65vh] md:h-[520px] lg:h-[650px] w-full rounded-2xl md:rounded-3xl overflow-hidden mb-6 md:mb-12 bg-gradient-to-t from-[#070A0F] via-[#10141e] to-[#0A0E17] flex items-center justify-center border border-white/5 shadow-2xl animate-pulse select-none">
        <ZapiLoader size="xl" />
      </div>
    );
  }

  return (
    <div 
      className="relative h-[65vh] md:h-[520px] lg:h-[650px] w-full rounded-2xl md:rounded-3xl overflow-hidden mb-6 md:mb-12 group select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Botão de Edição Admin */}
      {isAdmin && (
        <div className="absolute top-4 right-4 z-50">
          <button 
            onClick={handleEditClick}
            className="flex items-center gap-2 px-4 py-2 bg-black/60 hover:bg-blue-600 backdrop-blur-md border border-white/20 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg hover:scale-105 group/edit"
          >
            <Edit className="w-4 h-4 group-hover/edit:animate-pulse" />
            <span>Editar Carrossel</span>
          </button>
        </div>
      )}

      {/* Navegação */}
      <div className="absolute inset-y-0 left-4 z-30 hidden md:flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => navigate('prev')} className="p-3 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-[#007df7] transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>
      <div className="absolute inset-y-0 right-4 z-30 hidden md:flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => navigate('next')} className="p-3 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-[#007df7] transition-colors">
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Indicadores de Paginação */}
      <div className="absolute bottom-4 right-4 md:bottom-8 md:right-12 z-30 flex items-center gap-1 md:gap-1.5">
        {featuredItems.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (scrollRef.current) {
                const slideWidth = getSlideWidth();
                // Scroll para o conjunto do meio (idx + totalOriginal) para garantir scroll infinito bidirecional
                scrollRef.current.scrollTo({
                  left: (totalOriginal + idx) * slideWidth,
                  behavior: 'smooth'
                });
                setCurrentIndex(idx);
              }
            }}
            className={`rounded-full transition-all duration-300 h-1 md:h-1.5 ${
              idx === currentIndex 
                ? 'w-4 md:w-8 bg-white shadow-lg' 
                : 'w-2 md:w-4 bg-white/20 hover:bg-white/40'
            }`}
            aria-label={`Ir para slide ${idx + 1}`}
          />
        ))}
      </div>

      {/* Scroll Container */}
      <div 
        ref={scrollRef}
        onScroll={handleInfiniteScroll}
        className="flex h-full w-full overflow-x-auto no-scrollbar snap-x snap-mandatory will-change-scroll"
      >
        {extendedItems.map((item, idx) => (
          <div key={`${item.id}-${idx}`} className="flex-none w-full h-full relative snap-start">
            <img 
              src={item.backdrop || item.image} 
              alt={item.title}
              onError={(e) => { (e.target as HTMLImageElement).src = item.image; }}
              className="absolute inset-0 w-full h-full object-cover object-center"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div className={`absolute inset-0 bg-gradient-to-t transition-opacity duration-300 ${
              isDarkMode 
                ? 'from-[#05070A] via-[#05070A]/60 to-transparent' 
                : 'from-gray-900/90 via-gray-900/20 to-transparent'
            }`}></div>
            
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent opacity-60"></div>

            <div className="absolute bottom-0 left-0 px-5 md:pl-28 md:pr-12 pb-10 md:pb-16 w-full max-w-4xl z-10 flex flex-col items-center md:items-start text-center md:text-left">
              
              {/* RENDERIZAÇÃO DAS TAGS */}
              <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-3 md:mb-5">
                {(item.heroTags && item.heroTags.length > 0) ? (
                  item.heroTags.map(tag => renderTag(tag))
                ) : (
                  // Fallback para a propriedade 'platform' legada
                  item.platform && (
                    <span className="px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest bg-white/10 text-white border border-white/20 backdrop-blur-md">
                      {item.platform}
                    </span>
                  )
                )}
              </div>

              <h2 className="text-2xl md:text-6xl font-black text-white mb-3 md:mb-6 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] leading-normal pt-2 pb-1 line-clamp-2 max-w-[90%] md:max-w-none">
                {item.title}
              </h2>
              
              <p className="text-white/80 text-xs md:text-lg mb-6 md:mb-10 line-clamp-2 md:line-clamp-3 max-w-sm md:max-w-xl drop-shadow-md font-medium">
                {item.description || "Assista agora a este título exclusivo selecionado especialmente para você na ZapiTV Premium."}
              </p>

              <div className="flex flex-row items-center gap-3 w-full sm:w-auto">
                <button 
                  onClick={() => onActionClick?.(item)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 md:gap-3 px-6 md:px-10 py-3.5 md:py-4 bg-[#007df7] hover:bg-[#0069d9] text-white rounded-xl md:rounded-2xl font-black transition-all hover:scale-105 active:scale-95 shadow-xl shadow-[#007df7]/30 text-sm md:text-base"
                >
                  <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                  Assistir
                </button>
                <button 
                  onClick={() => onActionClick?.(item)}
                  className="flex-none sm:flex-none flex items-center justify-center gap-2 md:gap-3 px-4 md:px-10 py-3.5 md:py-4 bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white rounded-xl md:rounded-2xl font-black transition-all border border-white/10 text-sm md:text-base"
                  title="Saiba Mais"
                >
                  <Info className="w-5 h-5 md:w-5 md:h-5" />
                  <span className="hidden md:inline">Saiba Mais</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {renderEditModal()}
    </div>
  );
};

export default Hero;

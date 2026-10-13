
import React, { useState, useMemo } from 'react';
import { X, Search, CheckCircle, Filter, Check } from 'lucide-react';
import { ContentItem, ContentType } from '../types';

interface AddSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, selectedItems: string[]) => void;
  allContent: ContentItem[];
  genres: string[];
  isDarkMode: boolean;
}

type SelectionMode = 'manual' | 'auto';

const AddSectionModal: React.FC<AddSectionModalProps> = ({ 
  isOpen, onClose, onSave, allContent, genres, isDarkMode 
}) => {
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<SelectionMode>('manual');
  
  // Manual Mode State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Auto Mode State
  const [autoType, setAutoType] = useState<string>(''); // '' | ContentType
  const [autoGenre, setAutoGenre] = useState<string>('');

  // Filtragem para o modo Manual (Busca)
  const filteredManualContent = useMemo(() => {
    return allContent.filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allContent, searchQuery]);

  // Cálculo de pré-visualização para o modo Auto (Filtros)
  const autoFilteredItems = useMemo(() => {
    return allContent.filter(item => {
      const matchesType = autoType ? item.type === autoType : true;
      const matchesGenre = autoGenre ? item.genres?.includes(autoGenre) : true;
      return matchesType && matchesGenre;
    });
  }, [allContent, autoType, autoGenre]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert("Por favor, dê um título para a seção.");
      return;
    }

    let finalItems: string[] = [];

    if (mode === 'manual') {
      finalItems = Array.from(selectedIds);
    } else {
      finalItems = autoFilteredItems.map(i => i.id);
    }

    if (finalItems.length === 0) {
      alert("A seção precisa ter pelo menos um item.");
      return;
    }

    onSave(title, finalItems);
    
    // Reset states
    setTitle('');
    setSelectedIds(new Set());
    setSearchQuery('');
    setAutoType('');
    setAutoGenre('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`w-full max-w-5xl h-[85vh] rounded-3xl border flex flex-col overflow-hidden shadow-2xl ${
        isDarkMode ? 'bg-[#151C26] border-gray-800' : 'bg-white border-gray-200'
      }`}>
        
        {/* Header */}
        <div className={`p-6 border-b flex justify-between items-center ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          <div>
            <h2 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Nova Seção na Home</h2>
            <p className="text-sm text-gray-500">Personalize o catálogo exibido na página inicial</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-500/10 rounded-full transition-colors">
            <X className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Sidebar de Configuração */}
          <div className={`w-full md:w-80 p-6 border-r flex flex-col gap-6 overflow-y-auto ${isDarkMode ? 'border-gray-800 bg-black/20' : 'border-gray-100 bg-gray-50'}`}>
            
            {/* Título */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">1. Título da Seção</label>
              <input 
                type="text" 
                placeholder="Ex: Maratona de Terror"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`w-full p-4 rounded-xl font-bold outline-none border transition-all ${
                  isDarkMode ? 'bg-black/20 border-gray-700 text-white focus:border-orange-600' : 'bg-white border-gray-200 text-gray-900 focus:border-orange-600'
                }`}
              />
            </div>

            {/* Modo de Seleção */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3 block">2. Tipo de Curadoria</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setMode('manual')}
                  className={`flex-1 py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-2 border transition-all ${
                    mode === 'manual' 
                      ? 'bg-orange-600 text-white border-orange-600 shadow-lg' 
                      : `${isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-gray-200 hover:bg-gray-100'} text-gray-500`
                  }`}
                >
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-xs font-bold">Manual</span>
                </button>
                <button 
                  onClick={() => setMode('auto')}
                  className={`flex-1 py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-2 border transition-all ${
                    mode === 'auto' 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-lg' 
                      : `${isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-gray-200 hover:bg-gray-100'} text-gray-500`
                  }`}
                >
                  <Filter className="w-5 h-5" />
                  <span className="text-xs font-bold">Automático</span>
                </button>
              </div>
            </div>

            {/* Controles Específicos do Modo */}
            <div className="flex-1">
              {mode === 'manual' ? (
                <div className="animate-in fade-in slide-in-from-left-4">
                  <div className={`p-4 rounded-xl border mb-4 ${isDarkMode ? 'bg-orange-500/10 border-orange-500/20 text-orange-200' : 'bg-orange-50 border-orange-100 text-orange-800'}`}>
                    <p className="text-xs leading-relaxed">Selecione os itens individualmente na lista ao lado. Use a busca para encontrar títulos específicos.</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">Selecionados:</span>
                    <span className="text-xl font-black text-orange-600">{selectedIds.size}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Categoria (Opcional)</label>
                    <select 
                      value={autoType}
                      onChange={(e) => setAutoType(e.target.value)}
                      className={`w-full p-3 rounded-xl outline-none border font-medium text-sm ${
                        isDarkMode ? 'bg-black/20 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'
                      }`}
                    >
                      <option value="" className="text-gray-900 bg-white">Todas as Categorias</option>
                      <option value={ContentType.MOVIE} className="text-gray-900 bg-white">Filmes</option>
                      <option value={ContentType.SERIES} className="text-gray-900 bg-white">Séries</option>
                      <option value={ContentType.ANIME} className="text-gray-900 bg-white">Animes</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Gênero (Opcional)</label>
                    <select 
                      value={autoGenre}
                      onChange={(e) => setAutoGenre(e.target.value)}
                      className={`w-full p-3 rounded-xl outline-none border font-medium text-sm ${
                        isDarkMode ? 'bg-black/20 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'
                      }`}
                    >
                      <option value="" className="text-gray-900 bg-white">Todos os Gêneros</option>
                      {genres.map(g => (
                        <option key={g} value={g} className="text-gray-900 bg-white">{g}</option>
                      ))}
                    </select>
                  </div>
                  <div className={`p-4 rounded-xl border mt-4 text-center ${isDarkMode ? 'bg-blue-500/10 border-blue-500/20 text-blue-200' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
                    <p className="text-[10px] uppercase font-bold mb-1">Resultado da Regra</p>
                    <p className="text-3xl font-black">{autoFilteredItems.length}</p>
                    <p className="text-xs opacity-70">itens encontrados</p>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={handleSave}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl shadow-lg shadow-green-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              CRIAR SEÇÃO
            </button>
          </div>

          {/* Área Principal (Lista de Itens) */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {mode === 'manual' && (
              <div className={`p-4 border-b ${isDarkMode ? 'border-gray-800 bg-[#151C26]' : 'border-gray-100 bg-white'}`}>
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                      type="text" 
                      placeholder="Buscar títulos para adicionar..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full pl-10 p-3 rounded-xl outline-none font-medium ${
                        isDarkMode ? 'bg-white/5 text-white placeholder:text-gray-600' : 'bg-gray-100 text-gray-900'
                      }`}
                    />
                 </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar">
               {mode === 'manual' ? (
                 <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                    {filteredManualContent.map(item => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <div 
                          key={item.id} 
                          onClick={() => toggleSelection(item.id)}
                          className={`relative aspect-[2/3] rounded-lg overflow-hidden cursor-pointer group transition-all duration-200 ${
                            isSelected ? 'ring-4 ring-orange-600 scale-95' : 'hover:scale-105'
                          }`}
                        >
                          <img src={item.image} className={`w-full h-full object-cover transition-all ${isSelected ? 'opacity-40' : 'group-hover:brightness-50'}`} alt={item.title} />
                          
                          {/* Selecionado Indicator */}
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center">
                               <div className="bg-orange-600 text-white p-2 rounded-full shadow-lg transform scale-125">
                                 <Check className="w-6 h-6" />
                               </div>
                            </div>
                          )}
                          
                          {/* Hover Info (Unselected) */}
                          {!isSelected && (
                            <div className="absolute inset-0 flex items-end p-2 opacity-0 group-hover:opacity-100">
                               <p className="text-white text-xs font-bold drop-shadow-md text-center w-full">{item.title}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                 </div>
               ) : (
                 <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 pointer-events-none">
                    {autoFilteredItems.map(item => (
                      <div key={item.id} className="relative aspect-[2/3] rounded-lg overflow-hidden group opacity-80">
                        <img src={item.image} className="w-full h-full object-cover" alt={item.title} />
                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-blue-600 text-white text-[8px] font-black rounded uppercase">
                          Auto
                        </div>
                      </div>
                    ))}
                    {autoFilteredItems.length === 0 && (
                      <div className="col-span-full py-20 text-center">
                        <p className="text-gray-500 font-bold">Nenhum item corresponde aos filtros selecionados.</p>
                      </div>
                    )}
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddSectionModal;

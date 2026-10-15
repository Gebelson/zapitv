import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpDown, Check } from 'lucide-react';

export type CatalogSortOption = 
  | 'recommended' 
  | 'popularity' 
  | 'release_date' 
  | 'rating' 
  | 'recently_added' 
  | 'oldest' 
  | 'title_az' 
  | 'title_za';

export interface SortOptionItem {
  id: CatalogSortOption;
  label: string;
}

export const SORT_OPTIONS: SortOptionItem[] = [
  { id: 'recommended', label: 'Recomendados' },
  { id: 'popularity', label: 'Mais Populares' },
  { id: 'release_date', label: 'Lançamentos' },
  { id: 'rating', label: 'Mais Bem Avaliados' },
  { id: 'recently_added', label: 'Adicionados Recentemente' },
  { id: 'oldest', label: 'Mais Antigos' },
  { id: 'title_az', label: 'A–Z' },
  { id: 'title_za', label: 'Z–A' },
];

export interface SortDropdownProps {
  selectedSort: CatalogSortOption;
  onSelect?: (sort: CatalogSortOption) => void;
  onSelectSort?: (sort: CatalogSortOption) => void;
  isDarkMode: boolean;
}

const SortDropdown: React.FC<SortDropdownProps> = ({ selectedSort, onSelect, onSelectSort, isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSelectOption = (optionId: CatalogSortOption) => {
    if (typeof onSelect === 'function') {
      onSelect(optionId);
    }
    if (typeof onSelectSort === 'function') {
      onSelectSort(optionId);
    }
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const dropdownWidth = 220;
      if (rect.left + dropdownWidth > window.innerWidth - 16) {
        setAlignRight(true);
      } else if (rect.right - dropdownWidth < 16) {
        setAlignRight(false);
      } else {
        setAlignRight(true);
      }
    }
  }, [isOpen]);

  const activeLabel = SORT_OPTIONS.find(o => o.id === selectedSort)?.label || 'Ordenar por';

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Ordenar catálogo: ${activeLabel}`}
        title={`Ordenar por: ${activeLabel}`}
        className={`flex items-center justify-center p-2 sm:p-2.5 rounded-xl border transition-all duration-300 ${
          isOpen 
            ? 'border-white bg-white/10 text-white' 
            : `${isDarkMode ? 'border-white/20 bg-black/40 text-white hover:border-white' : 'border-black/20 bg-white/40 text-gray-900 hover:border-black'}`
        } backdrop-blur-md cursor-pointer`}
      >
        <ArrowUpDown className="w-4 h-4 text-orange-600" />
      </button>

      {isOpen && (
        <div 
          className={`absolute ${alignRight ? 'right-0' : 'left-0'} mt-2 w-[220px] max-w-[calc(100vw-2rem)] rounded-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[120] ${
            isDarkMode ? 'bg-black/95 border border-white/10' : 'bg-white/95 border border-black/10'
          } backdrop-blur-2xl`}
        >
          <div className="p-2 space-y-0.5">
            {SORT_OPTIONS.map((option) => {
              const isSelected = selectedSort === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => handleSelectOption(option.id)}
                  className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-md text-[11px] md:text-xs font-bold transition-all ${
                    isSelected 
                      ? 'text-orange-600 bg-orange-600/10' 
                      : `${isDarkMode ? 'text-white/70 hover:text-white hover:bg-white/5' : 'text-black/70 hover:text-black hover:bg-black/5'}`
                  }`}
                >
                  <span className="whitespace-nowrap">{option.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-orange-600 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SortDropdown;

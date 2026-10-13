
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface GenreDropdownProps {
  genres: string[];
  selectedGenre: string;
  onSelect: (genre: string) => void;
  isDarkMode: boolean;
}

const GenreDropdown: React.FC<GenreDropdownProps> = ({ genres, selectedGenre, onSelect, isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-1.5 md:py-1 rounded border transition-all duration-300 text-xs md:text-sm font-black uppercase tracking-widest ${
          isOpen 
            ? 'border-white bg-white/10 text-white' 
            : `${isDarkMode ? 'border-white/20 bg-black/40 text-white hover:border-white' : 'border-black/20 bg-white/40 text-gray-900 hover:border-black'}`
        } backdrop-blur-md`}
      >
        <span>{selectedGenre || 'Gêneros'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div 
          className={`absolute left-0 mt-2 w-[280px] md:w-[480px] rounded-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[120] ${
            isDarkMode ? 'bg-black/95 border border-white/10' : 'bg-white/95 border border-black/10'
          } backdrop-blur-2xl`}
        >
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-1">
            <button
              onClick={() => { onSelect(''); setIsOpen(false); }}
              className={`text-left px-3 py-1.5 rounded-md text-[11px] md:text-xs font-bold transition-all hover:underline ${
                selectedGenre === '' ? 'text-orange-600' : `${isDarkMode ? 'text-white/60 hover:text-white' : 'text-black/60 hover:text-black'}`
              }`}
            >
              Todos os Gêneros
            </button>
            {genres.map((genre) => (
              <button
                key={genre}
                onClick={() => { onSelect(genre); setIsOpen(false); }}
                className={`text-left px-3 py-1.5 rounded-md text-[11px] md:text-xs font-bold transition-all hover:underline ${
                  selectedGenre === genre ? 'text-orange-600' : `${isDarkMode ? 'text-white/60 hover:text-white' : 'text-black/60 hover:text-black'}`
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GenreDropdown;

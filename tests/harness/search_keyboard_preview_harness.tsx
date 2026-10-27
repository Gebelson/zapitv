import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { TvSearchView } from '../../src/components/tv/TvSearchView';
import { tvNavigationManager } from '../../src/core/tv/tvNavigationManager';
import { ContentItem } from '../../types';
import '../../index.css';

const queryParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const mockDeviceFamily = queryParams.get('deviceFamily');
if (typeof window !== 'undefined' && mockDeviceFamily) {
  (window as any).__MOCK_DEVICE_FAMILY__ = mockDeviceFamily;
}

const MOCK_ITEMS: ContentItem[] = [
  {
    id: 'movie-oppenheimer',
    title: 'Oppenheimer',
    originalTitle: 'Oppenheimer',
    description: 'A história do físico J. Robert Oppenheimer e o Projeto Manhattan.',
    type: 'movie',
    year: 2023,
    rating: 8.9,
    poster: 'https://images.metahub.space/poster/medium/tt15398776/img',
    backdrop: 'https://images.metahub.space/background/medium/tt15398776/img',
    genres: ['Drama', 'História', 'Biografia']
  },
  {
    id: 'series-verdade-oculta',
    title: 'Verdade Oculta',
    originalTitle: 'Disclaimer',
    description: 'Uma jornalista tem seus próprios segredos expostos.',
    type: 'series',
    year: 2024,
    rating: 8.4,
    poster: 'https://images.metahub.space/poster/medium/tt16294384/img',
    backdrop: 'https://images.metahub.space/background/medium/tt16294384/img',
    genres: ['Suspense', 'Drama']
  },
  {
    id: 'movie-dune-2',
    title: 'Duna: Parte 2',
    originalTitle: 'Dune: Part Two',
    description: 'Paul Atreides se une aos Fremen na jornada de vingança.',
    type: 'movie',
    year: 2024,
    rating: 8.8,
    poster: 'https://images.metahub.space/poster/medium/tt15239678/img',
    backdrop: 'https://images.metahub.space/background/medium/tt15239678/img',
    genres: ['Ficção Científica', 'Aventura']
  },
  {
    id: 'anime-dr-stone',
    title: 'Dr. STONE',
    originalTitle: 'Dr. STONE',
    description: 'Senku usa a ciência para reconstruir a civilização.',
    type: 'anime',
    year: 2019,
    rating: 8.2,
    poster: 'https://images.metahub.space/poster/medium/tt9679542/img',
    backdrop: 'https://images.metahub.space/background/medium/tt9679542/img',
    genres: ['Anime', 'Ficção Científica']
  },
  {
    id: 'movie-interstellar',
    title: 'Interestelar',
    originalTitle: 'Interstellar',
    description: 'Exploradores viajam além desta galáxia em busca de sobrevivência.',
    type: 'movie',
    year: 2014,
    rating: 8.7,
    poster: 'https://images.metahub.space/poster/medium/tt0816692/img',
    backdrop: 'https://images.metahub.space/background/medium/tt0816692/img',
    genres: ['Ficção Científica', 'Drama']
  },
  {
    id: 'series-stranger-things',
    title: 'Stranger Things',
    originalTitle: 'Stranger Things',
    description: 'Coisas estranhas acontecem na cidade de Hawkins.',
    type: 'series',
    year: 2016,
    rating: 8.7,
    poster: 'https://images.metahub.space/poster/medium/tt4574334/img',
    backdrop: 'https://images.metahub.space/background/medium/tt4574334/img',
    genres: ['Ficção Científica', 'Terror', 'Drama']
  }
];

const SearchKeyboardPreviewApp: React.FC = () => {
  useEffect(() => {
    tvNavigationManager.init();
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#05070a]">
      <TvSearchView
        allContent={MOCK_ITEMS}
        onSelectItem={(item) => console.log('Selected:', item.title)}
        onClose={() => console.log('Closed')}
      />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<SearchKeyboardPreviewApp />);

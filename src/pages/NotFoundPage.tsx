import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Home, Film, Flame, ArrowLeft, Search } from 'lucide-react';
import { ZapiBrandLogo } from '../components/common/ZapiBrandLogo';

interface NotFoundPageProps {
  isDarkMode?: boolean;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ isDarkMode = true }) => {
  const navigate = useNavigate();

  return (
    <div className={`min-h-[85vh] flex flex-col items-center justify-center px-4 py-16 text-center select-none relative z-10 animate-in fade-in duration-500`}>
      {/* Background glow visual effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 flex items-center justify-center">
        <div 
          className="w-[450px] h-[450px] rounded-full blur-[120px] opacity-25"
          style={{
            background: 'radial-gradient(circle, #007df7 0%, #b273d8 40%, transparent 70%)'
          }}
        />
      </div>

      {/* Logo Glow Symbol */}
      <div className="mb-6 transition-transform hover:scale-105 flex items-center justify-center">
        <ZapiBrandLogo size="lg" isDarkMode={isDarkMode} />
      </div>

      {/* 404 Badge */}
      <span className="px-3.5 py-1 mb-4 rounded-full text-xs font-black tracking-widest uppercase bg-orange-600/20 text-orange-400 border border-orange-500/30">
        Erro 404 • Não Encontrado
      </span>

      <h1 
        className={`text-4xl md:text-6xl font-black tracking-tight mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
        style={{ fontFamily: "'Sora', sans-serif" }}
      >
        Conteúdo fora de órbita
      </h1>

      <p className="max-w-md text-sm md:text-base text-gray-400 font-medium mb-8 leading-relaxed">
        A página ou título que você está tentando acessar não existe, foi removido ou a URL foi digitada incorretamente.
      </p>

      {/* Navigation Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#007df7] hover:bg-[#006ee0] active:scale-95 text-white font-bold text-sm shadow-xl shadow-[#007df7]/25 transition-all"
        >
          <Home className="w-4 h-4" />
          <span>Voltar ao Início</span>
        </button>

        <Link
          to="/em-destaque"
          className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm border transition-all ${
            isDarkMode 
              ? 'bg-white/5 hover:bg-white/10 text-white border-white/10' 
              : 'bg-black/5 hover:bg-black/10 text-gray-800 border-black/10'
          }`}
        >
          <Flame className="w-4 h-4 text-amber-400" />
          <span>Em Destaque</span>
        </Link>

        <Link
          to="/filmes"
          className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm border transition-all ${
            isDarkMode 
              ? 'bg-white/5 hover:bg-white/10 text-white border-white/10' 
              : 'bg-black/5 hover:bg-black/10 text-gray-800 border-black/10'
          }`}
        >
          <Film className="w-4 h-4 text-[#007df7]" />
          <span>Explorar Filmes</span>
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;

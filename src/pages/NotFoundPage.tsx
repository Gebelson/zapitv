import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Home, Film, Flame, ArrowLeft, Search } from 'lucide-react';

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
      <div className="w-20 h-16 mb-6 transition-transform hover:scale-105">
        <svg id="Camada_1" data-name="Camada 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 374.87 315.93" className="w-full h-full drop-shadow-[0_0_25px_rgba(0,125,247,0.4)]">
          <defs>
            <linearGradient id="Gradiente_404" x1="-657.62" y1="773.63" x2="-322.95" y2="1096.47" gradientTransform="translate(677 -778)" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#007df7" />
              <stop offset="0.5" stopColor="#b273d8" />
              <stop offset="1" stopColor="#00baa3" />
            </linearGradient>
          </defs>
          <path fill="url(#Gradiente_404)" d="M217.84,315.93c-20.71-.34-41.38-.68-62-1.01-25.86.33-51.86.66-78,1l-58.67-.27c-8.71-.05-16.27-6.38-17.35-14.45-.89-6.67.79-11.65,4.8-16.59l42.96-52.9,34.5-41.58,46.93-57.01c4.73-5.74,8.53-12.04,14.93-16.09,4.47-2.83,11.02-1.13,15.32,1.5l29.66,18.14c5.5,3.37,12.16,1.15,15.73-4l16.82-24.22,47.74-74.06c.21-.33.37-.67.48-1.02,1.14-3.55-2.09-6.98-5.78-6.4-2.82.44-5.47,1.54-8.49,2.82l-128.58,54.14L9.09,134.06c-2.46,1.03-5.17.89-6.68-.21C1.28,133.02,0,130.3,0,128.19L.2,21.58C.23,9.78,8.11,0,20.12,0l335.27.02c5.38,0,11.72,3.13,14.46,6.66,6.08,7.82,3.13,17.81-2.26,24.85-5.81,7.6-11.51,14.36-17.53,21.64l-24.48,29.57-56.42,68.45-33.94,42.01c-5,6.19-12.76,9.24-19.74,5.04l-28.69-17.27c-3.83-2.31-10.24-5.82-14.33-3.45-5.92,3.43-8.84,10.15-12.43,15.62l-33.7,51.33-27.21,42.72c-.76,1.19-.35,3.03.15,3.78,1.9,2.87,9.6-.54,12.85-1.93l116.86-49.98,138.78-59.06c1.63-.7,3.99-.15,4.9.39s2.21,2,2.21,3.81l-.4,109.09c-.04,12.22-8.55,22.45-20.82,22.46l-135.81.19Z"/>
        </svg>
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

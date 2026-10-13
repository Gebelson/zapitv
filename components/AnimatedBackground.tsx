
import React from 'react';

interface AnimatedBackgroundProps {
  isDarkMode: boolean;
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ isDarkMode }) => {
  return (
    <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none transform-gpu translate-z-0">
      {/* Camada Base de Cor */}
      <div className={`absolute inset-0 transition-colors duration-1000 ${
        isDarkMode ? 'bg-[#05070A]' : 'bg-[#F8F9FC]'
      }`} />

      {/* Container de Efeitos - Opacidade reduzida para 30% e blur aumentado para suavidade extrema */}
      <div className={`absolute inset-0 w-full h-full filter blur-[100px] md:blur-[160px] opacity-30`}>
        
        {/* Blob 1 - Roxo/Azul Profundo */}
        <div 
          className="absolute top-[-10%] left-[-10%] w-[70vw] h-[70vw] rounded-full mix-blend-multiply filter blur-3xl animate-blob-1 will-change-transform"
          style={{
            background: isDarkMode 
              ? 'radial-gradient(circle, rgba(76, 29, 149, 0.3) 0%, rgba(59, 130, 246, 0.1) 100%)'
              : 'radial-gradient(circle, rgba(167, 139, 250, 0.4) 0%, rgba(96, 165, 250, 0.2) 100%)',
          }}
        />
        
        {/* Blob 2 - Ciano/Verde */}
        <div 
          className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full mix-blend-multiply filter blur-3xl animate-blob-2 will-change-transform"
          style={{
            background: isDarkMode 
              ? 'radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, rgba(16, 185, 129, 0.05) 100%)'
              : 'radial-gradient(circle, rgba(34, 211, 238, 0.3) 0%, rgba(52, 211, 153, 0.2) 100%)',
            animationDelay: '-5s'
          }}
        />

        {/* Blob 3 - Rosa/Laranja */}
        <div 
          className="absolute bottom-[-20%] left-[20%] w-[80vw] h-[80vw] rounded-full mix-blend-multiply filter blur-3xl animate-blob-3 will-change-transform"
          style={{
            background: isDarkMode 
              ? 'radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, rgba(249, 115, 22, 0.05) 100%)'
              : 'radial-gradient(circle, rgba(244, 114, 182, 0.3) 0%, rgba(251, 146, 60, 0.2) 100%)',
             animationDelay: '-10s'
          }}
        />
        
         {/* Blob 4 - Accent Flutuante */}
         <div 
          className="absolute top-[40%] left-[40%] w-[40vw] h-[40vw] rounded-full mix-blend-overlay filter blur-2xl animate-blob-4 will-change-transform"
          style={{
            background: isDarkMode 
              ? 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%)'
              : 'radial-gradient(circle, rgba(96, 165, 250, 0.4) 0%, rgba(192, 132, 252, 0.4) 100%)',
             animationDelay: '-2s'
          }}
        />
      </div>

      <style>{`
        @keyframes blob-1 {
          0% { transform: translate(0px, 0px) scale(1) rotate(0deg); }
          33% { transform: translate(30vw, -10vh) scale(1.2) rotate(120deg); }
          66% { transform: translate(-20vw, 20vh) scale(0.9) rotate(240deg); }
          100% { transform: translate(0px, 0px) scale(1) rotate(360deg); }
        }
        
        @keyframes blob-2 {
          0% { transform: translate(0px, 0px) scale(1) rotate(0deg); }
          33% { transform: translate(-30vw, 20vh) scale(1.1) rotate(-120deg); }
          66% { transform: translate(-10vw, -10vh) scale(0.95) rotate(-240deg); }
          100% { transform: translate(0px, 0px) scale(1) rotate(-360deg); }
        }
        
        @keyframes blob-3 {
          0% { transform: translate(0px, 0px) scale(1) rotate(0deg); }
          50% { transform: translate(20vw, -20vh) scale(1.1) rotate(180deg); }
          100% { transform: translate(0px, 0px) scale(1) rotate(360deg); }
        }

        @keyframes blob-4 {
          0% { transform: translate(0px, 0px) scale(1); }
          25% { transform: translate(20vw, 20vh) scale(1.2); }
          50% { transform: translate(-10vw, 10vh) scale(0.9); }
          75% { transform: translate(10vw, -20vh) scale(1.1); }
          100% { transform: translate(0px, 0px) scale(1); }
        }

        .animate-blob-1 { animation: blob-1 35s infinite linear; }
        .animate-blob-2 { animation: blob-2 40s infinite linear; }
        .animate-blob-3 { animation: blob-3 45s infinite linear; }
        .animate-blob-4 { animation: blob-4 30s infinite ease-in-out; }
      `}</style>
    </div>
  );
};

export default AnimatedBackground;

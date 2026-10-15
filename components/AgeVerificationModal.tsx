import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { adultContentService } from '../src/core/adult/AdultContentService';

interface AgeVerificationModalProps {
  isOpen: boolean;
  isDarkMode: boolean;
  profileId?: string;
  isChild?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const AgeVerificationModal: React.FC<AgeVerificationModalProps> = ({
  isOpen,
  isDarkMode,
  profileId,
  isChild = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (isChild) return;
    adultContentService.confirmAge(profileId);
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl border transition-all ${
          isDarkMode 
            ? 'bg-[#141414] border-red-900/40 text-white' 
            : 'bg-white border-red-200 text-gray-900'
        }`}
      >
        <div className="flex items-start justify-between mb-6">
          <div className="w-14 h-14 rounded-2xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <button 
            onClick={onCancel}
            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-black tracking-wider uppercase">
            <AlertTriangle className="w-3.5 h-3.5" />
            Classificação Restrita (+18)
          </div>

          <h3 className="text-2xl font-black tracking-tight">
            {isChild ? 'Acesso Bloqueado para Menores' : 'Confirmação de Maioridade'}
          </h3>

          <p className="text-sm opacity-70 leading-relaxed">
            {isChild ? (
              'Este perfil está configurado como Perfil Infantil e possui restrições parentais ativas. O acesso a conteúdos adultos ou restritos é terminantemente proibido.'
            ) : (
              'Esta seção contém conteúdos restritos destinados exclusivamente ao público adulto maior de 18 anos. Você confirma que tem 18 anos de idade ou mais?'
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onCancel}
            className={`w-full sm:flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all border ${
              isDarkMode 
                ? 'border-white/10 hover:bg-white/5 text-gray-300' 
                : 'border-gray-300 hover:bg-gray-100 text-gray-700'
            }`}
          >
            {isChild ? 'Fechar' : 'Cancelar (Voltar)'}
          </button>

          {!isChild && (
            <button
              onClick={handleConfirm}
              className="w-full sm:flex-1 py-3.5 rounded-2xl font-black text-sm bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Sou Maior (+18)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

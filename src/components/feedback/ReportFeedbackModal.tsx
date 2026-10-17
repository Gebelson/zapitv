import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Send, 
  Loader2, 
  Tv, 
  Film, 
  VolumeX, 
  Subtitles, 
  Wand2, 
  Search, 
  Layers, 
  Radio, 
  Laptop
} from 'lucide-react';
import { 
  FeedbackCategory, 
  FEEDBACK_CATEGORY_LABELS 
} from '../../core/feedback/feedbackTypes';
import { 
  FeedbackCollector, 
  PlaybackContextOptions 
} from '../../core/feedback/feedbackCollector';
import { classifyFeedbackMedia } from '../../core/feedback/mediaClassifier';

interface ReportFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  playbackContext?: PlaybackContextOptions;
  defaultCategory?: FeedbackCategory;
  onSubmitted?: () => void;
}

// Ícones ilustrativos por categoria para tornar a seleção rápida e intuitiva
const CATEGORY_ICONS: Record<FeedbackCategory, React.ReactNode> = {
  video_not_loading: <AlertCircle className="w-4 h-4 text-rose-400" />,
  infinite_loading: <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />,
  video_stuttering: <Layers className="w-4 h-4 text-orange-400" />,
  wrong_movie_series: <Film className="w-4 h-4 text-purple-400" />,
  wrong_episode: <Tv className="w-4 h-4 text-indigo-400" />,
  wrong_dubbing: <VolumeX className="w-4 h-4 text-yellow-400" />,
  missing_dubbing_ptbr: <VolumeX className="w-4 h-4 text-amber-400" />,
  subtitles_wrong_language: <Subtitles className="w-4 h-4 text-blue-400" />,
  subtitles_out_of_sync: <Subtitles className="w-4 h-4 text-cyan-400" />,
  no_sound: <VolumeX className="w-4 h-4 text-red-400" />,
  unstable_volume: <VolumeX className="w-4 h-4 text-orange-300" />,
  wrong_quality: <Tv className="w-4 h-4 text-emerald-400" />,
  search_problem: <Search className="w-4 h-4 text-sky-400" />,
  catalog_problem: <Layers className="w-4 h-4 text-teal-400" />,
  live_channel_unavailable: <Radio className="w-4 h-4 text-red-500" />,
  broken_interface: <Laptop className="w-4 h-4 text-slate-300" />,
  other_problem: <AlertCircle className="w-4 h-4 text-gray-400" />
};

export const ReportFeedbackModal: React.FC<ReportFeedbackModalProps> = ({
  isOpen,
  onClose,
  playbackContext,
  defaultCategory = 'video_not_loading',
  onSubmitted
}) => {
  const [category, setCategory] = useState<FeedbackCategory>(defaultCategory);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCategory(defaultCategory);
      setComment('');
      setSubmitting(false);
      setSuccess(false);
      setErrorMessage(null);
    }
  }, [isOpen, defaultCategory]);

  // Fechamento exclusivo com tecla Escape na fase de captura (evita fechar modais pai)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || success) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await FeedbackCollector.submitFeedback(
        category,
        comment.trim(),
        playbackContext
      );

      if (response && response.success) {
        setSuccess(true);
        if (onSubmitted) {
          onSubmitted();
        }
        // Fechamento automático suave após 2.5 segundos
        setTimeout(() => {
          onClose();
        }, 2400);
      } else {
        setErrorMessage(response?.message || 'Falha ao registrar feedback. Tente novamente.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Ocorreu um erro ao enviar o feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const mediaInfo = classifyFeedbackMedia(
    playbackContext?.item,
    playbackContext?.season,
    playbackContext?.episode,
    playbackContext?.streamName
  );

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) {
          e.preventDefault();
          onClose();
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        className="w-full max-w-lg bg-[#0f1115] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-white"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#161a22]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#007df7]/20 border border-[#007df7]/40 flex items-center justify-center text-[#007df7]">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="feedback-modal-title" className="text-base font-semibold text-white">
                Encontrou algum problema?
              </h3>
              <p className="text-xs text-white/60">
                Nos ajude a manter o ZapiTV rápido e sem falhas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 overflow-y-auto space-y-5">
          {success ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-white">Obrigado pelo seu relato!</h4>
              <p className="text-sm text-white/70 max-w-sm">
                Seu feedback foi recebido e nosso sistema automático já adicionou o diagnóstico técnico à fila de correções do ZapiTV.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mediaInfo.displayTitle && (
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between text-xs text-white/80">
                  <span className="text-white/50 font-medium">Conteúdo atual:</span>
                  <span className="font-semibold text-white truncate max-w-[280px]">
                    {mediaInfo.displayTitle}
                  </span>
                </div>
              )}

              {/* Seletor de Categoria */}
              <div>
                <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-2">
                  Qual é o tipo do problema?
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                    className="w-full bg-[#161a22] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#007df7] transition-colors cursor-pointer appearance-none"
                  >
                    {Object.entries(FEEDBACK_CATEGORY_LABELS).map(([catKey, label]) => (
                      <option key={catKey} value={catKey} className="bg-[#161a22] text-white py-1">
                        {label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1.5 text-white/60">
                    {CATEGORY_ICONS[category]}
                  </div>
                </div>
              </div>

              {/* Descrição Opcional */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                    Descreva o que aconteceu <span className="text-white/40 normal-case font-normal">(opcional)</span>
                  </label>
                  <span className="text-[11px] text-white/40">
                    {comment.length}/500
                  </span>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 500))}
                  placeholder="Ex: Travou aos 14 minutos; a dublagem de repente ficou em inglês; o botão de avançar não respondeu..."
                  rows={3}
                  className="w-full bg-[#161a22] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#007df7] transition-colors resize-none"
                />
              </div>

              {/* Mensagem de Erro se houver */}
              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Aviso de Telemetria Anônima */}
              <div className="text-[11px] text-white/40 leading-relaxed bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                ⚡ <strong className="text-white/60">Diagnóstico automático:</strong> Informações técnicas anônimas (navegador, resolução e status do player) são enviadas para agilizar a resolução sem pedir nenhum dado pessoal.
              </div>

              {/* Ações */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#007df7] hover:bg-[#007df7]/90 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-[#007df7]/25 flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Enviar feedback</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};


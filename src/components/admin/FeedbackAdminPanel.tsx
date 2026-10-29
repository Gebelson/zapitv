import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Check, 
  RefreshCw, 
  Search, 
  Filter, 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ArrowUpRight, 
  FileText, 
  ExternalLink, 
  ChevronRight, 
  X, 
  Edit3, 
  Save, 
  ShieldAlert, 
  Bug, 
  MessageSquare, 
  Layers, 
  Tv, 
  Film, 
  VolumeX, 
  Subtitles, 
  Wand2, 
  Radio, 
  Laptop
} from 'lucide-react';
import { 
  IssueCluster, 
  FeedbackReport, 
  IssuePriority, 
  IssueStatus, 
  FeedbackCategory, 
  FEEDBACK_CATEGORY_LABELS, 
  FeedbackDashboardStats 
} from '../../core/feedback/feedbackTypes';

interface FeedbackAdminPanelProps {
  isDarkMode?: boolean;
}

const CATEGORY_ICONS: Record<FeedbackCategory, React.ReactNode> = {
  video_not_loading: <AlertCircle className="w-3.5 h-3.5 text-rose-400" />,
  infinite_loading: <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />,
  video_stuttering: <Layers className="w-3.5 h-3.5 text-orange-400" />,
  wrong_movie_series: <Film className="w-3.5 h-3.5 text-purple-400" />,
  wrong_episode: <Tv className="w-3.5 h-3.5 text-indigo-400" />,
  wrong_dubbing: <VolumeX className="w-3.5 h-3.5 text-yellow-400" />,
  missing_dubbing_ptbr: <VolumeX className="w-3.5 h-3.5 text-amber-400" />,
  subtitles_wrong_language: <Subtitles className="w-3.5 h-3.5 text-blue-400" />,
  subtitles_out_of_sync: <Subtitles className="w-3.5 h-3.5 text-cyan-400" />,
  no_sound: <VolumeX className="w-3.5 h-3.5 text-red-400" />,
  unstable_volume: <VolumeX className="w-3.5 h-3.5 text-orange-300" />,
  wrong_quality: <Tv className="w-3.5 h-3.5 text-emerald-400" />,
  search_problem: <Search className="w-3.5 h-3.5 text-sky-400" />,
  catalog_problem: <Layers className="w-3.5 h-3.5 text-teal-400" />,
  live_channel_unavailable: <Radio className="w-3.5 h-3.5 text-red-500" />,
  broken_interface: <Laptop className="w-3.5 h-3.5 text-slate-300" />,
  other_problem: <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
};

async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  let token: string | undefined;
  try {
    const { auth } = await import('../../../firebase');
    token = await auth.currentUser?.getIdToken();
  } catch {
    // Firebase é opcional quando autenticado via sessão da ZapiTV
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: 'include', // Envia o cookie de sessão ZapiTV (HttpOnly)
    cache: 'no-store',
    signal: AbortSignal.timeout(10000)
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Acesso restrito. Faça login com uma conta de administrador para consultar os relatos.');
  }

  return response;
}

export const FeedbackAdminPanel: React.FC<FeedbackAdminPanelProps> = ({ isDarkMode = true }) => {
  const [stats, setStats] = useState<FeedbackDashboardStats | null>(null);
  const [clusters, setClusters] = useState<IssueCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detalhes do Cluster Selecionado
  const [selectedCluster, setSelectedCluster] = useState<IssueCluster | null>(null);
  const [clusterReports, setClusterReports] = useState<FeedbackReport[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Edição de Prompt Técnico
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [regeneratingPrompt, setRegeneratingPrompt] = useState(false);

  // Notas do Admin
  const [adminNotes, setAdminNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Busca inicial e atualização
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    setError(null);

    try {
      // 1. Stats
      const statsRes = await adminFetch('/api/feedback/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // 2. Clusters
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'all') queryParams.set('status', statusFilter);
      if (priorityFilter !== 'all') queryParams.set('priority', priorityFilter);
      if (categoryFilter !== 'all') queryParams.set('category', categoryFilter);
      if (searchQuery.trim()) queryParams.set('search', searchQuery.trim());

      const clustersRes = await adminFetch(`/api/feedback/clusters?${queryParams.toString()}`);
      if (clustersRes.ok) {
        const clustersData = await clustersRes.json();
        setClusters(clustersData.clusters || []);
      } else {
        throw new Error('Não foi possível carregar os relatos.');
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar dados de feedback.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, priorityFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Carregar detalhes do cluster quando selecionado
  const handleSelectCluster = async (cluster: IssueCluster) => {
    setSelectedCluster(cluster);
    setIsEditingPrompt(false);
    setEditedPrompt(cluster.activePromptMarkdown || '');
    setAdminNotes(cluster.adminNotes || '');
    setLoadingDetails(true);

    try {
      const res = await adminFetch(`/api/feedback/clusters/${cluster.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedCluster(data.cluster);
        setClusterReports(data.reports || []);
        setEditedPrompt(data.cluster?.activePromptMarkdown || '');
        setAdminNotes(data.cluster?.adminNotes || '');
      }
    } catch (err) {
      console.error('Erro ao buscar detalhes do cluster:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Atualizar Status do Cluster
  const handleUpdateStatus = async (clusterId: string, newStatus: IssueStatus) => {
    try {
      const res = await adminFetch(`/api/feedback/clusters/${clusterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        const updated = await res.json();
        setClusters(prev => prev.map(c => c.id === clusterId ? { ...c, status: newStatus } : c));
        if (selectedCluster?.id === clusterId) {
          setSelectedCluster(prev => prev ? { ...prev, status: newStatus } : null);
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  };

  // Atualizar Prioridade do Cluster
  const handleUpdatePriority = async (clusterId: string, newPriority: IssuePriority) => {
    try {
      const res = await adminFetch(`/api/feedback/clusters/${clusterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority })
      });

      if (res.ok) {
        setClusters(prev => prev.map(c => c.id === clusterId ? { ...c, priority: newPriority } : c));
        if (selectedCluster?.id === clusterId) {
          setSelectedCluster(prev => prev ? { ...prev, priority: newPriority } : null);
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar prioridade:', err);
    }
  };

  // Copiar Prompt Técnico para Área de Transferência
  const handleCopyPrompt = () => {
    const textToCopy = isEditingPrompt ? editedPrompt : (selectedCluster?.activePromptMarkdown || '');
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    });
  };

  // Regenerar Prompt
  const handleRegeneratePrompt = async () => {
    if (!selectedCluster) return;
    setRegeneratingPrompt(true);

    try {
      const res = await adminFetch(`/api/feedback/clusters/${selectedCluster.id}/prompt`, {
        method: 'POST'
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedCluster(prev => prev ? { ...prev, activePromptMarkdown: data.prompt.markdownContent, promptVersion: data.prompt.version } : null);
        setEditedPrompt(data.prompt.markdownContent);
      }
    } catch (err) {
      console.error('Erro ao regenerar prompt:', err);
    } finally {
      setRegeneratingPrompt(false);
    }
  };

  // Salvar Edição de Prompt
  const handleSaveEditedPrompt = async () => {
    if (!selectedCluster) return;
    setSavingPrompt(true);

    try {
      const res = await adminFetch(`/api/feedback/clusters/${selectedCluster.id}/prompt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdownContent: editedPrompt })
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedCluster(prev => prev ? { ...prev, activePromptMarkdown: data.prompt.markdownContent, promptVersion: data.prompt.version } : null);
        setIsEditingPrompt(false);
      }
    } catch (err) {
      console.error('Erro ao salvar prompt editado:', err);
    } finally {
      setSavingPrompt(false);
    }
  };

  // Salvar Notas do Admin
  const handleSaveNotes = async () => {
    if (!selectedCluster) return;
    setSavingNotes(true);

    try {
      const res = await adminFetch(`/api/feedback/clusters/${selectedCluster.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes })
      });

      if (res.ok) {
        setSelectedCluster(prev => prev ? { ...prev, adminNotes } : null);
      }
    } catch (err) {
      console.error('Erro ao salvar notas:', err);
    } finally {
      setSavingNotes(false);
    }
  };

  // Desmembrar Relato Individual do Cluster
  const handleSplitReport = async (reportId: string) => {
    if (!selectedCluster || !confirm('Deseja desmembrar este relato para um cluster próprio?')) return;

    try {
      const res = await adminFetch(`/api/feedback/reports/${reportId}/split`, {
        method: 'POST'
      });

      if (res.ok) {
        // Atualiza a lista de clusters e relatos
        fetchData(true);
        setClusterReports(prev => prev.filter(r => r.id !== reportId));
        if (selectedCluster) {
          setSelectedCluster(prev => prev ? { ...prev, totalReports: Math.max(1, prev.totalReports - 1) } : null);
        }
      }
    } catch (err) {
      console.error('Erro ao desmembrar relato:', err);
    }
  };

  // Formatador de Data Relativa
  const formatTimeAgo = (timestamp: number) => {
    try {
      const diffMs = Date.now() - timestamp;
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'agora mesmo';
      if (diffMin < 60) return `há ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `há ${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      return `há ${diffDays}d`;
    } catch {
      return String(timestamp);
    }
  };

  // Renderizadores de Badges
  const renderPriorityBadge = (priority: IssuePriority) => {
    const config = {
      critical: { bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30', label: 'CRÍTICA' },
      high: { bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: 'ALTA' },
      medium: { bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30', label: 'MÉDIA' },
      low: { bg: 'bg-slate-500/15 text-slate-400 border-slate-500/30', label: 'BAIXA' }
    }[priority] || { bg: 'bg-gray-500/15 text-gray-400 border-gray-500/30', label: priority };

    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${config.bg}`}>
        {config.label}
      </span>
    );
  };

  const renderStatusBadge = (status: IssueStatus) => {
    const config = {
      new: { bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30', label: 'NOVO' },
      investigating: { bg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30', label: 'INVESTIGANDO' },
      fixing: { bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: 'CORRIGINDO' },
      resolved: { bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: 'RESOLVIDO' },
      reopened: { bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse', label: 'REABERTO' }
    }[status] || { bg: 'bg-gray-500/15 text-gray-400 border-gray-500/30', label: status };

    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${config.bg}`}>
        {config.label}
      </span>
    );
  };

  const renderTrendBadge = (trend?: string) => {
    if (!trend) return null;
    switch (trend) {
      case 'increasing':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400">
            <TrendingUp className="w-3.5 h-3.5" /> Aumentando
          </span>
        );
      case 'decreasing':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
            <TrendingDown className="w-3.5 h-3.5" /> Diminuindo
          </span>
        );
      case 'reappeared':
        return (
          <span className="flex items-center gap-1 text-[11px] font-black text-rose-500 uppercase tracking-wider animate-pulse">
            <Flame className="w-3.5 h-3.5" /> Regressão
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-white/50">
            <Minus className="w-3.5 h-3.5" /> Estável
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Info */}
      <div className={`p-6 md:p-8 rounded-3xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'
      }`}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-500/10">
            <Bug className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black tracking-tight text-white">Central Inteligente de Feedbacks</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white">
                Cluster Engine
              </span>
            </div>
            <p className="text-xs text-white/60 mt-1">
              Agrupamento automático de falhas, detecção de regressões e geração de prompts determinísticos para correção.
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchData(false)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider border border-white/10 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {/* Alerta de Regressão */}
      {stats && stats.reopenedCount > 0 && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/30 flex items-center justify-center text-rose-300 shrink-0">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-black text-rose-300 uppercase tracking-wider">
                Alerta de Regressão Detectada ({stats.reopenedCount} {stats.reopenedCount === 1 ? 'problema' : 'problemas'})
              </h4>
              <p className="text-xs text-rose-200/80">
                Problemas que haviam sido marcados como resolvidos voltaram a receber novos relatos de usuários.
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('reopened')}
            className="px-4 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold tracking-wider uppercase transition-colors shrink-0"
          >
            Ver Regressões
          </button>
        </div>
      )}

      {/* Dashboard KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {[
          { label: 'Novos', value: stats?.newIssuesCount || 0, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
          { label: 'Críticos', value: stats?.criticalIssuesCount || 0, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
          { label: 'Recorrentes', value: stats?.recurrentIssuesCount || 0, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Investigando', value: stats?.investigatingCount || 0, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
          { label: 'Corrigindo', value: stats?.fixingCount || 0, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
          { label: 'Resolvidos', value: stats?.resolvedCount || 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Total Relatos', value: stats?.totalFeedbacksReceived || 0, color: 'text-white', bg: 'bg-white/5 border-white/10' }
        ].map((kpi, idx) => (
          <div key={idx} className={`p-4 rounded-2xl border ${kpi.bg} flex flex-col justify-between`}>
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">{kpi.label}</span>
            <span className={`text-2xl font-black mt-2 ${kpi.color}`}>{kpi.value}</span>
          </div>
        ))}
      </div>

      {/* Top 5 Problemas Mais Reportados */}
      {stats?.topReportedClusters && stats.topReportedClusters.length > 0 && (
        <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" />
              Ranking: Problemas Mais Reportados
            </h3>
            <span className="text-xs text-white/50">Prioridade imediata de correção</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.topReportedClusters.slice(0, 6).map((issue, idx) => (
              <div 
                key={issue.id}
                onClick={() => {
                  const target = clusters.find(c => c.id === issue.id);
                  if (target) handleSelectCluster(target);
                }}
                className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#007df7]/40 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[#007df7]/20 text-[#007df7] font-black text-xs flex items-center justify-center shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {renderPriorityBadge(issue.priority)}
                    {renderTrendBadge(issue.trend)}
                  </div>
                </div>

                <h4 className="text-sm font-bold text-white mt-2.5 group-hover:text-[#007df7] transition-colors line-clamp-1">
                  {issue.title}
                </h4>

                <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-xs text-white/60">
                  <span className="font-semibold text-white/80">
                    <strong className="text-white font-black">{issue.totalReports}</strong> {issue.totalReports === 1 ? 'relato' : 'relatos'}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-[#007df7] group-hover:underline font-semibold">
                    Ver detalhes <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros e Busca */}
      <div className={`p-4 md:p-5 rounded-2xl border flex flex-col md:flex-row items-center gap-3 ${
        isDarkMode ? 'bg-gray-900/40 border-gray-800' : 'bg-white shadow-sm'
      }`}>
        {/* Busca */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Buscar por título da obra, código do erro, relato ou ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder-white/30 focus:outline-none focus:border-[#007df7] transition-colors"
          />
        </div>

        {/* Filtros Seletores */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/5 border border-white/10 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none cursor-pointer"
          >
            <option value="all" className="bg-[#151C26]">Todos Status</option>
            <option value="new" className="bg-[#151C26]">Novos</option>
            <option value="investigating" className="bg-[#151C26]">Investigando</option>
            <option value="fixing" className="bg-[#151C26]">Corrigindo</option>
            <option value="resolved" className="bg-[#151C26]">Resolvidos</option>
            <option value="reopened" className="bg-[#151C26]">Reabertos (Regressões)</option>
          </select>

          {/* Prioridade */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-white/5 border border-white/10 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none cursor-pointer"
          >
            <option value="all" className="bg-[#151C26]">Todas Prioridades</option>
            <option value="critical" className="bg-[#151C26]">Crítica</option>
            <option value="high" className="bg-[#151C26]">Alta</option>
            <option value="medium" className="bg-[#151C26]">Média</option>
            <option value="low" className="bg-[#151C26]">Baixa</option>
          </select>

          {/* Categoria */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-white/5 border border-white/10 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none cursor-pointer max-w-[160px]"
          >
            <option value="all" className="bg-[#151C26]">Todas Categorias</option>
            {Object.entries(FEEDBACK_CATEGORY_LABELS).map(([catKey, label]) => (
              <option key={catKey} value={catKey} className="bg-[#151C26]">
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Clusters */}
      <div className={`rounded-3xl border overflow-hidden ${
        isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'
      }`}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-white">Clusters de Problemas</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-white/10 text-white/70">
              {clusters.length}
            </span>
          </div>
          <span className="text-xs text-white/50">Clique em qualquer linha para abrir a central de diagnóstico</span>
        </div>

        {error ? (
          <div className="p-12 text-center text-rose-400 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">Não foi possível carregar os relatos</h4>
            <p className="text-xs text-white/60 max-w-sm">
              {error}
            </p>
            <button
              onClick={() => fetchData(false)}
              className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <div className="p-12 text-center text-white/60 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#007df7]" />
            <span className="text-sm font-semibold">Carregando relatos e clusters...</span>
          </div>
        ) : clusters.length === 0 ? (
          <div className="p-12 text-center text-white/60 flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-1" />
            <h4 className="text-base font-bold text-white">Nenhum problema encontrado</h4>
            <p className="text-xs text-white/50 max-w-sm">
              Não existem clusters correspondentes aos filtros aplicados. O sistema está estável!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {clusters.map((cluster) => {
              const isSelected = selectedCluster?.id === cluster.id;
              return (
                <div
                  key={cluster.id}
                  onClick={() => handleSelectCluster(cluster)}
                  className={`p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all cursor-pointer ${
                    isSelected ? 'bg-[#007df7]/10 border-l-4 border-l-[#007df7]' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  {/* Informações Principais */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                      {CATEGORY_ICONS[cluster.category] || <AlertCircle className="w-4 h-4 text-gray-400" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {renderPriorityBadge(cluster.priority)}
                        {renderStatusBadge(cluster.status)}
                        {cluster.trend && renderTrendBadge(cluster.trend)}
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded">
                          Nível {cluster.fingerprintData.level}: {cluster.fingerprintData.level === 1 ? 'Exato' : cluster.fingerprintData.level === 2 ? 'Obra' : 'Sistêmico'}
                        </span>
                      </div>

                      <h4 className="text-sm sm:text-base font-bold text-white truncate group-hover:text-[#007df7]">
                        {cluster.title}
                      </h4>

                      <p className="text-xs text-white/60 line-clamp-1 mt-0.5">
                        {cluster.categoryLabel}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-white/40 mt-2 flex-wrap">
                        {cluster.affectedMedia[0]?.title && (
                          <span className="text-white/70 font-semibold truncate max-w-[200px]">
                            📺 {cluster.affectedMedia[0].title}
                          </span>
                        )}
                        {cluster.fingerprintData.season !== undefined && cluster.fingerprintData.episode !== undefined && (
                          <span className="text-amber-400/90 font-bold">
                            T{cluster.fingerprintData.season}:E{cluster.fingerprintData.episode}
                          </span>
                        )}
                        {cluster.fingerprintData.providerId && (
                          <span className="text-sky-400/90 font-medium">
                            Provedor: {cluster.fingerprintData.providerId}
                          </span>
                        )}
                        <span>Último relato: {formatTimeAgo(cluster.lastOccurrenceAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito: Contadores e Ações Rápidas */}
                  <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/5">
                    <div className="text-left lg:text-right">
                      <span className="text-lg font-black text-white block">
                        {cluster.totalReports} {cluster.totalReports === 1 ? 'relato' : 'relatos'}
                      </span>
                      <span className="text-[10px] text-white/40 block">
                        ID: {cluster.id.slice(0, 14)}...
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={cluster.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleUpdateStatus(cluster.id, e.target.value as IssueStatus)}
                        className="bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl px-2.5 py-1.5 border border-white/10 outline-none cursor-pointer"
                      >
                        <option value="new" className="bg-[#151C26]">Novo</option>
                        <option value="investigating" className="bg-[#151C26]">Investigando</option>
                        <option value="fixing" className="bg-[#151C26]">Corrigindo</option>
                        <option value="resolved" className="bg-[#151C26]">Resolvido</option>
                      </select>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCluster(cluster);
                        }}
                        className="px-3 py-1.5 bg-[#007df7] hover:bg-[#0069d9] text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all"
                      >
                        <span>Abrir</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal / Painel Lateral de Detalhes do Cluster */}
      {selectedCluster && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedCluster(null)}
        >
          <div 
            className="w-full max-w-4xl bg-[#0f1115] border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Drawer */}
            <div className="p-5 sm:p-6 border-b border-white/10 bg-[#161a22] flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#007df7]/20 border border-[#007df7]/40 flex items-center justify-center text-[#007df7] shrink-0 mt-0.5">
                  <Bug className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {renderPriorityBadge(selectedCluster.priority)}
                    {renderStatusBadge(selectedCluster.status)}
                    {selectedCluster.trend && renderTrendBadge(selectedCluster.trend)}
                    <span className="text-xs text-white/50">
                      • {selectedCluster.totalReports} {selectedCluster.totalReports === 1 ? 'relato' : 'relatos'}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    {selectedCluster.title}
                  </h3>
                  <p className="text-xs text-white/60 mt-0.5">
                    Cluster ID: <span className="font-mono text-white/80">{selectedCluster.id}</span> • Criado {formatTimeAgo(selectedCluster.firstOccurrenceAt)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCluster(null)}
                className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
              {/* Controles de Status e Prioridade */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-white/50 tracking-wider mb-1">Status</label>
                  <select
                    value={selectedCluster.status}
                    onChange={(e) => handleUpdateStatus(selectedCluster.id, e.target.value as IssueStatus)}
                    className="w-full bg-[#161a22] border border-white/10 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none"
                  >
                    <option value="new">Novo</option>
                    <option value="investigating">Investigando</option>
                    <option value="fixing">Corrigindo</option>
                    <option value="resolved">Resolvido</option>
                    <option value="reopened">Reaberto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-white/50 tracking-wider mb-1">Prioridade</label>
                  <select
                    value={selectedCluster.priority}
                    onChange={(e) => handleUpdatePriority(selectedCluster.id, e.target.value as IssuePriority)}
                    className="w-full bg-[#161a22] border border-white/10 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none"
                  >
                    <option value="critical">Crítica</option>
                    <option value="high">Alta</option>
                    <option value="medium">Média</option>
                    <option value="low">Baixa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-white/50 tracking-wider mb-1">Nível de Agrupamento</label>
                  <div className="text-xs font-bold text-white py-2">
                    Nível {selectedCluster.fingerprintData.level} ({selectedCluster.fingerprintData.level === 1 ? 'Específico' : selectedCluster.fingerprintData.level === 2 ? 'Obra' : 'Sistêmico'})
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-white/50 tracking-wider mb-1">Última Ocorrência</label>
                  <div className="text-xs font-bold text-white py-2">
                    {formatTimeAgo(selectedCluster.lastOccurrenceAt)}
                  </div>
                </div>
              </div>

              {/* Assinatura Técnica (Technical Fingerprint) */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <h4 className="text-xs font-black uppercase text-white/60 tracking-wider">
                  Assinatura Técnica do Cluster
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-white/40 block text-[10px] uppercase">Obra:</span>
                    <span className="font-semibold text-white truncate block">
                      {selectedCluster.affectedMedia[0]?.title || 'Não especificada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[10px] uppercase">Episódio:</span>
                    <span className="font-semibold text-white">
                      {selectedCluster.fingerprintData.season !== undefined && selectedCluster.fingerprintData.episode !== undefined
                        ? `T${selectedCluster.fingerprintData.season} : E${selectedCluster.fingerprintData.episode}`
                        : 'N/A (Filme/Geral)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[10px] uppercase">Provedor / Fonte:</span>
                    <span className="font-semibold text-sky-400 truncate block">
                      {selectedCluster.fingerprintData.providerId || 'Todos'}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[10px] uppercase">Código de Erro:</span>
                    <span className="font-semibold text-rose-400">
                      {selectedCluster.fingerprintData.errorCode || 'Nenhum'}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[10px] uppercase">Estágio de Falha:</span>
                    <span className="font-semibold text-amber-400">
                      {selectedCluster.fingerprintData.failureStage || 'playback'}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[10px] uppercase">Componente:</span>
                    <span className="font-semibold text-emerald-400">
                      {selectedCluster.fingerprintData.category}
                    </span>
                  </div>
                </div>
              </div>

              {/* Seção do Prompt Técnico Gerado Automaticamente */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#0b0d11] border border-white/15 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#007df7]" />
                    <h4 className="text-xs font-black uppercase text-white tracking-wider">
                      Prompt Técnico de Correção (Pronto para Uso)
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Botão Regenerar */}
                    <button
                      onClick={handleRegeneratePrompt}
                      disabled={regeneratingPrompt}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                      title="Regenerar prompt a partir dos relatos atuais"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${regeneratingPrompt ? 'animate-spin' : ''}`} />
                      <span>Regenerar</span>
                    </button>

                    {/* Botão Editar / Salvar */}
                    {isEditingPrompt ? (
                      <button
                        onClick={handleSaveEditedPrompt}
                        disabled={savingPrompt}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Salvar</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsEditingPrompt(true)}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                        title="Editar prompt manualmente"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                    )}

                    {/* Botão Copiar com Feedback Visual */}
                    <button
                      onClick={handleCopyPrompt}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                        copiedPrompt
                          ? 'bg-emerald-500 text-white shadow-emerald-500/25 scale-105'
                          : 'bg-[#007df7] hover:bg-[#0069d9] text-white shadow-[#007df7]/25 active:scale-95'
                      }`}
                      title="Copiar prompt para colar no chat do Antigravity"
                    >
                      {copiedPrompt ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Prompt</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {isEditingPrompt ? (
                  <textarea
                    value={editedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    rows={12}
                    className="w-full bg-[#151921] border border-[#007df7]/50 rounded-xl p-3 text-xs font-mono text-gray-200 focus:outline-none leading-relaxed"
                  />
                ) : (
                  <div className="relative">
                    <pre className="w-full bg-[#151921] border border-white/10 rounded-xl p-3.5 text-xs font-mono text-gray-200 overflow-x-auto max-h-72 leading-relaxed whitespace-pre-wrap select-all">
                      {selectedCluster.activePromptMarkdown || 'Nenhum prompt disponível.'}
                    </pre>
                  </div>
                )}
                <p className="text-[11px] text-white/40">
                  💡 Este prompt já vem estruturado com diagnóstico, arquivos afetados, contexto de reprodução e critérios de aceitação prontos para execução direta.
                </p>
              </div>

              {/* Lista dos Relatos dos Usuários que compõem este Cluster */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-white/70 tracking-wider flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-white/50" />
                    Relatos de Usuários Registrados ({clusterReports.length})
                  </h4>
                  <span className="text-[11px] text-white/40">Deduplicação e telemetria anônima</span>
                </div>

                {loadingDetails ? (
                  <div className="p-4 text-center text-white/50 text-xs">Carregando relatos...</div>
                ) : clusterReports.length === 0 ? (
                  <div className="p-4 text-center text-white/50 text-xs bg-white/5 rounded-xl">
                    Nenhum relato individual listado para este cluster.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {clusterReports.map((report) => (
                      <div 
                        key={report.id}
                        className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-[11px] text-white/50 mb-1">
                            <span className="font-semibold text-white/80">{formatTimeAgo(report.submissionTimestamp)}</span>
                            <span>•</span>
                            <span>{report.technicalContext?.browser || 'Browser'} / {report.technicalContext?.os || 'OS'} ({report.technicalContext?.deviceType || 'desktop'})</span>
                            {report.technicalContext?.currentTimeSeconds !== undefined && (
                              <>
                                <span>•</span>
                                <span className="text-amber-400 font-mono">
                                  Aos {Math.floor(report.technicalContext.currentTimeSeconds / 60)}m{Math.floor(report.technicalContext.currentTimeSeconds % 60)}s
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-white/80 font-medium">
                            {report.userDescription ? `"${report.userDescription}"` : <span className="text-white/40 italic">Sem comentário adicional</span>}
                          </p>
                        </div>

                        {clusterReports.length > 1 && (
                          <button
                            onClick={() => handleSplitReport(report.id)}
                            className="text-[10px] text-white/40 hover:text-amber-400 font-bold uppercase tracking-wider underline shrink-0 transition-colors"
                            title="Desmembrar este relato para um cluster separado"
                          >
                            Desmembrar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notas do Admin */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase text-white/70 tracking-wider">
                    Notas Internas da Equipe Técnica
                  </label>
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                  >
                    <Save className="w-3 h-3" />
                    <span>{savingNotes ? 'Salvando...' : 'Salvar Notas'}</span>
                  </button>
                </div>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Anotações técnicas sobre o bug, commit de correção, teste efetuado..."
                  rows={2}
                  className="w-full bg-[#161a22] border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#007df7]"
                />
              </div>
            </div>

            {/* Rodapé com Fechamento */}
            <div className="p-4 sm:p-5 border-t border-white/10 bg-[#161a22] flex items-center justify-between">
              <span className="text-xs text-white/40 font-mono">
                {selectedCluster.fingerprint}
              </span>
              <button
                onClick={() => setSelectedCluster(null)}
                className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

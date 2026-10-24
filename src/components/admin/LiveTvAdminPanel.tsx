import React, { useState, useEffect, useMemo } from 'react';
import { 
  Radio, Play, RefreshCw, CheckCircle, AlertTriangle, AlertCircle, 
  ExternalLink, Plus, Trash2, Edit3, Search, Filter, ShieldCheck, Eye, EyeOff, X,
  Tv, Database, Globe
} from 'lucide-react';
import { LiveChannel, LiveStreamSource, ChannelHealthStatus } from '../../core/livetv/types';
import { liveTvProviderRegistry } from '../../core/livetv/LiveTVProviderRegistry';
import { channelHealthService } from '../../core/livetv/channelHealthService';
import { liveStreamValidator } from '../../core/livetv/LiveStreamValidator';
import { LiveTvPlayer } from '../livetv/LiveTvPlayer';

interface LiveTvAdminPanelProps {
  isDarkMode: boolean;
}

export const LiveTvAdminPanel: React.FC<LiveTvAdminPanelProps> = ({ isDarkMode }) => {
  const [channels, setChannels] = useState<LiveChannel[]>(() => 
    liveTvProviderRegistry.getAllChannelsIncludingDisabled()
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Estado de verificação em massa
  const [isCheckingMass, setIsCheckingMass] = useState(false);
  const [massProgress, setMassProgress] = useState<{ completed: number; total: number } | null>(null);

  // Modal de teste de player
  const [testingChannel, setTestingChannel] = useState<LiveChannel | null>(null);

  // Modal de edição de fontes
  const [editingChannel, setEditingChannel] = useState<LiveChannel | null>(null);
  const [editStreamUrl, setEditStreamUrl] = useState('');
  const [editBackupUrls, setEditBackupUrls] = useState<string[]>([]);
  const [newBackupUrl, setNewBackupUrl] = useState('');

  // Modal de adicionar provedor M3U
  const [showAddM3uModal, setShowAddM3uModal] = useState(false);
  const [newM3uName, setNewM3uName] = useState('');
  const [newM3uUrl, setNewM3uUrl] = useState('');

  // Provedores M3U cadastrados
  const [m3uAdapters, setM3uAdapters] = useState(() => liveTvProviderRegistry.getM3UAdapters());

  // Escuta atualizações do catálogo
  useEffect(() => {
    const unsub = liveTvProviderRegistry.subscribe(() => {
      setChannels(liveTvProviderRegistry.getAllChannelsIncludingDisabled());
      setM3uAdapters(liveTvProviderRegistry.getM3UAdapters());
    });
    return unsub;
  }, []);

  // Métricas
  const metrics = useMemo(() => {
    const total = channels.length;
    const available = channels.filter(c => c.status === 'AVAILABLE').length;
    const external = channels.filter(c => c.status === 'EXTERNAL_ACCESS' || c.requiresExternalAccess).length;
    const unstableOrDown = channels.filter(c => c.status === 'UNSTABLE' || c.status === 'UNAVAILABLE' || c.status === 'ERROR').length;
    const disabled = channels.filter(c => c.isEnabled === false).length;
    return { total, available, external, unstableOrDown, disabled };
  }, [channels]);

  // Filtros
  const filteredChannels = useMemo(() => {
    return channels.filter(c => {
      if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
      if (selectedStatus === 'available' && c.status !== 'AVAILABLE') return false;
      if (selectedStatus === 'external' && !c.requiresExternalAccess && c.status !== 'EXTERNAL_ACCESS') return false;
      if (selectedStatus === 'unstable' && c.status !== 'UNSTABLE' && c.status !== 'UNAVAILABLE' && c.status !== 'ERROR') return false;
      if (selectedStatus === 'disabled' && c.isEnabled !== false) return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          (c.streamUrl && c.streamUrl.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [channels, selectedCategory, selectedStatus, searchTerm]);

  // Executa verificação em massa
  const handleMassHealthCheck = async () => {
    if (isCheckingMass) return;
    setIsCheckingMass(true);
    setMassProgress({ completed: 0, total: channels.length });

    try {
      await channelHealthService.verifyAllChannels((completed, total) => {
        setMassProgress({ completed, total });
      });
    } finally {
      setIsCheckingMass(false);
      setMassProgress(null);
    }
  };

  // Recarrega catálogo
  const handleRefreshCatalog = async () => {
    await liveTvProviderRegistry.refreshCatalog();
    setChannels(liveTvProviderRegistry.getAllChannelsIncludingDisabled());
    setM3uAdapters(liveTvProviderRegistry.getM3UAdapters());
  };

  // Abre modal de edição
  const handleOpenEdit = (channel: LiveChannel) => {
    setEditingChannel(channel);
    setEditStreamUrl(channel.streamUrl || '');
    setEditBackupUrls([...(channel.backupStreamUrls || [])]);
    setNewBackupUrl('');
  };

  // Salva edição de canal
  const handleSaveEdit = () => {
    if (!editingChannel) return;

    if (editStreamUrl.trim() !== editingChannel.streamUrl) {
      liveTvProviderRegistry.updateChannelStreamUrl(editingChannel.id, editStreamUrl.trim());
    }

    for (const bUrl of editBackupUrls) {
      liveTvProviderRegistry.addChannelBackupUrl(editingChannel.id, bUrl);
    }

    setEditingChannel(null);
  };

  // Alterna canal ativo/inativo
  const handleToggleChannel = (channel: LiveChannel) => {
    const next = channel.isEnabled === false ? true : false;
    liveTvProviderRegistry.toggleChannelEnabled(channel.id, next);
  };

  // Adiciona novo provedor M3U
  const handleAddM3u = () => {
    if (!newM3uName.trim() || !newM3uUrl.trim()) return;
    liveTvProviderRegistry.addM3UAdapter(newM3uName.trim(), newM3uUrl.trim());
    setShowAddM3uModal(false);
    setNewM3uName('');
    setNewM3uUrl('');
    setM3uAdapters(liveTvProviderRegistry.getM3UAdapters());
  };

  // Remove provedor M3U
  const handleRemoveM3u = (id: string) => {
    liveTvProviderRegistry.removeM3UAdapter(id);
    setM3uAdapters(liveTvProviderRegistry.getM3UAdapters());
  };

  const getStatusBadge = (status: ChannelHealthStatus, requiresExternal?: boolean) => {
    if (requiresExternal || status === 'EXTERNAL_ACCESS') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Acesso Externo
        </span>
      );
    }
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Disponível
          </span>
        );
      case 'CHECKING':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" /> Verificando
          </span>
        );
      case 'UNSTABLE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Instável
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Indisponível
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#0f121a] border-white/10' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total de Canais</span>
            <Radio className="w-4 h-4 text-[#007df7]" />
          </div>
          <p className="text-3xl font-black text-white">{metrics.total}</p>
        </div>

        <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#0f121a] border-white/10' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Disponíveis</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-black text-emerald-400">{metrics.available}</p>
        </div>

        <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#0f121a] border-white/10' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">Acesso Oficial</span>
            <ShieldCheck className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-3xl font-black text-purple-400">{metrics.external}</p>
        </div>

        <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#0f121a] border-white/10' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Instáveis / Off</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-black text-amber-400">{metrics.unstableOrDown}</p>
        </div>

        <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#0f121a] border-white/10' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Desativados</span>
            <EyeOff className="w-4 h-4 text-gray-500" />
          </div>
          <p className="text-3xl font-black text-gray-500">{metrics.disabled}</p>
        </div>
      </div>

      {/* Ações Rápidas de Administração */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={handleMassHealthCheck}
            disabled={isCheckingMass}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
              isCheckingMass
                ? 'bg-blue-600/50 text-white cursor-not-allowed'
                : 'bg-[#007df7] hover:bg-[#0069d9] text-white shadow-lg shadow-[#007df7]/25'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingMass ? 'animate-spin' : ''}`} />
            {isCheckingMass ? `Verificando (${massProgress?.completed}/${massProgress?.total})...` : 'Verificar Saúde em Massa'}
          </button>

          <button
            onClick={handleRefreshCatalog}
            className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10 flex items-center gap-2"
          >
            <Database className="w-3.5 h-3.5" /> Recarregar Catálogo
          </button>

          <button
            onClick={() => setShowAddM3uModal(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-emerald-600/80 hover:bg-emerald-600 text-white transition-all flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar Lista M3U
          </button>
        </div>

        {/* Provedores Ativos */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Globe className="w-4 h-4 text-[#007df7]" />
          <span>{m3uAdapters.length} Provedor(es) M3U Ativos</span>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, identificador ou URL..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-xs font-medium focus:outline-none focus:border-[#007df7]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold focus:outline-none"
          >
            <option value="all" className="bg-[#0f121a]">Todos os Status</option>
            <option value="available" className="bg-[#0f121a]">Apenas Disponíveis</option>
            <option value="external" className="bg-[#0f121a]">Apenas Acesso Externo</option>
            <option value="unstable" className="bg-[#0f121a]">Instáveis / Fora do Ar</option>
            <option value="disabled" className="bg-[#0f121a]">Desativados</option>
          </select>
        </div>
      </div>

      {/* Tabela de Canais */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0f121a]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-gray-400 font-black uppercase tracking-wider text-[10px]">
              <th className="py-3.5 px-4">Canal</th>
              <th className="py-3.5 px-4">Categoria</th>
              <th className="py-3.5 px-4">Stream Principal</th>
              <th className="py-3.5 px-4">Backups</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredChannels.map(channel => (
              <tr 
                key={channel.id} 
                className={`transition-colors hover:bg-white/[0.02] ${
                  channel.isEnabled === false ? 'opacity-40 bg-red-950/10' : ''
                }`}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10 p-1 border border-white/10 flex items-center justify-center shrink-0">
                      <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <p className="font-bold text-white leading-tight">{channel.name}</p>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">{channel.id}</p>
                    </div>
                  </div>
                </td>

                <td className="py-3 px-4 text-gray-300 font-medium">
                  {channel.categoryLabel}
                </td>

                <td className="py-3 px-4">
                  {channel.requiresExternalAccess ? (
                    <span className="text-purple-400 font-semibold flex items-center gap-1 text-[11px]">
                      <ExternalLink className="w-3 h-3" /> {channel.externalProviderName || 'Portal Oficial'}
                    </span>
                  ) : channel.streamUrl ? (
                    <span className="text-gray-400 font-mono text-[11px] truncate max-w-xs block" title={channel.streamUrl}>
                      {channel.streamUrl}
                    </span>
                  ) : (
                    <span className="text-gray-500 italic">Nenhum stream</span>
                  )}
                </td>

                <td className="py-3 px-4 text-gray-400">
                  {channel.backupStreamUrls && channel.backupStreamUrls.length > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-white font-bold text-[10px]">
                      {channel.backupStreamUrls.length} backup(s)
                    </span>
                  ) : (
                    <span className="text-gray-600 text-[11px]">Nenhum</span>
                  )}
                </td>

                <td className="py-3 px-4">
                  {getStatusBadge(channel.status, channel.requiresExternalAccess)}
                </td>

                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Botão de Testar Stream */}
                    <button
                      onClick={() => setTestingChannel(channel)}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-[#007df7] text-white transition-all"
                      title="Testar Reprodução"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>

                    {/* Botão de Editar Fontes */}
                    <button
                      onClick={() => handleOpenEdit(channel)}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                      title="Editar Fontes do Canal"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Alternar Ativo/Inativo */}
                    <button
                      onClick={() => handleToggleChannel(channel)}
                      className={`p-1.5 rounded-lg transition-all ${
                        channel.isEnabled === false
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40'
                          : 'bg-white/10 hover:bg-white/20 text-gray-300'
                      }`}
                      title={channel.isEnabled === false ? 'Ativar Canal' : 'Desativar Canal'}
                    >
                      {channel.isEnabled === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Teste Inline do Player */}
      {testingChannel && (
        <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in">
          <div className="relative w-full max-w-4xl bg-[#0f121a] border border-white/15 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radio className="w-5 h-5 text-[#007df7]" />
                <h3 className="text-white font-black text-sm">
                  Testando Transmissão: {testingChannel.name}
                </h3>
              </div>
              <button
                onClick={() => setTestingChannel(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="aspect-video w-full bg-black">
              <LiveTvPlayer channel={testingChannel} autoPlay={true} initialMuted={false} />
            </div>

            <div className="p-4 bg-black/40 text-xs text-gray-400 space-y-1">
              <p><strong className="text-white">URL de Transmissão:</strong> {testingChannel.streamUrl || 'Acesso Oficial Externo'}</p>
              <p><strong className="text-white">Qualidade:</strong> {testingChannel.quality || 'Auto'} | <strong className="text-white">Provedor:</strong> {testingChannel.isOfficial ? 'Oficial ZapiTV' : 'Lista Externa'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Fontes */}
      {editingChannel && (
        <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in">
          <div className="relative w-full max-w-lg bg-[#0f121a] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-black text-base flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#007df7]" /> Editar Fontes: {editingChannel.name}
              </h3>
              <button
                onClick={() => setEditingChannel(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">URL da Transmissão Principal (HLS .m3u8)</label>
                <input
                  type="text"
                  value={editStreamUrl}
                  onChange={(e) => setEditStreamUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-[#007df7]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Fontes Alternativas de Backup</label>
                <div className="space-y-2 mb-3">
                  {editBackupUrls.map((url, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-xs font-mono text-gray-300 truncate">{url}</span>
                      <button
                        onClick={() => setEditBackupUrls(editBackupUrls.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newBackupUrl}
                    onChange={(e) => setNewBackupUrl(e.target.value)}
                    placeholder="Adicionar nova URL de backup..."
                    className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-[#007df7]"
                  />
                  <button
                    onClick={() => {
                      if (newBackupUrl.trim()) {
                        setEditBackupUrls([...editBackupUrls, newBackupUrl.trim()]);
                        setNewBackupUrl('');
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setEditingChannel(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-5 py-2 bg-[#007df7] hover:bg-[#0069d9] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-[#007df7]/30"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Provedor M3U */}
      {showAddM3uModal && (
        <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in">
          <div className="relative w-full max-w-md bg-[#0f121a] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-black text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" /> Adicionar Lista M3U
              </h3>
              <button
                onClick={() => setShowAddM3uModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Nome do Provedor</label>
                <input
                  type="text"
                  value={newM3uName}
                  onChange={(e) => setNewM3uName(e.target.value)}
                  placeholder="Ex: IPTV Brasil Aberto"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">URL da Playlist M3U (.m3u / .m3u8)</label>
                <input
                  type="text"
                  value={newM3uUrl}
                  onChange={(e) => setNewM3uUrl(e.target.value)}
                  placeholder="https://exemplo.com/lista.m3u"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setShowAddM3uModal(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddM3u}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30"
              >
                Adicionar & Sincronizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

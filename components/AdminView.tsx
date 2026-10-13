
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Shield, Trash2, Search, Filter, Users, DollarSign, 
  X, Save, LayoutGrid, Plus, Film, Send, Download, Upload,
  Edit3, Trash, Star, Bell, Megaphone, CheckCircle, Info, AlertTriangle, Lock, Mail, Image as ImageIcon, CloudSync, Tv, Sparkles, Key, Play, Activity, Check,
  ShieldAlert, Ban, AlertOctagon
} from 'lucide-react';
import { User, ContentItem, ContentType, SiteNotification } from '../types';
import { providerRegistry, ProviderConfig } from '../src/core/providers/providerRegistry';
import { StremioStream } from '../src/core/stremio/stremioTypes';
import { videoAdBlocker, AdAuditRecord, AdAuditStatus } from '../src/core/security/videoAdBlocker';

interface AdminViewProps {
  isDarkMode: boolean;
  users: User[];
  onDeleteUser: (id: string) => void;
  onUpdateUser: (user: User) => void;
  content: ContentItem[];
  onAddContent: (item: ContentItem) => void;
  onUpdateContent: (item: ContentItem) => void;
  onDeleteContent: (id: string) => void;
  onSendGlobalNotification: (notification: SiteNotification) => void;
  onClearNotifications: () => void;
}

const AdminView: React.FC<AdminViewProps> = ({ 
  isDarkMode, users, onDeleteUser, onUpdateUser,
  content, onAddContent, onUpdateContent, onDeleteContent,
  onSendGlobalNotification, onClearNotifications
}) => {
  const [activeTab, setActiveTab] = useState<'providers' | 'users' | 'catalog' | 'notifications' | 'database' | 'video_ads'>('providers');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingMedia, setEditingMedia] = useState<ContentItem | null>(null);
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState('');
  
  // Stremio Providers State
  const [providers, setProviders] = useState<ProviderConfig[]>(() => providerRegistry.getProviders());
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testStreamInput, setTestStreamInput] = useState('550');
  const [resolvedTestStreams, setResolvedTestStreams] = useState<StremioStream[]>([]);
  const [isResolvingStreams, setIsResolvingStreams] = useState(false);
  const [newProvName, setNewProvName] = useState('');
  const [newProvUrl, setNewProvUrl] = useState('');
  const [newProvType, setNewProvType] = useState<ProviderConfig['type']>('stremio-addon');
  
  // Auditoria de Propaganda Embutida (1xBet / Apostas)
  const [adRecords, setAdRecords] = useState<AdAuditRecord[]>(() => videoAdBlocker.getAuditRecords());
  const [adStatusFilter, setAdStatusFilter] = useState<'todos' | AdAuditStatus>('todos');
  const [adSearchTerm, setAdSearchTerm] = useState('');
  const [manualAdUrl, setManualAdUrl] = useState('');
  const [manualAdTitle, setManualAdTitle] = useState('');
  const [manualAdReason, setManualAdReason] = useState('Contém publicidade ou marca de apostas embutida no vídeo');

  // Subscrever às atualizações do VideoAdBlocker
  React.useEffect(() => {
    return videoAdBlocker.subscribe(() => {
      setAdRecords(videoAdBlocker.getAuditRecords());
    });
  }, []);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  
  const [newGlobalNotify, setNewGlobalNotify] = useState<Partial<SiteNotification>>({
    title: '', message: '', type: 'info'
  });

  const [newMedia, setNewMedia] = useState<Partial<ContentItem>>({
    title: '', 
    type: ContentType.MOVIE, 
    rating: 8.5, 
    year: 2024, 
    image: '', 
    backdrop: '', 
    description: '', 
    platform: 'Netflix', 
    tmdbId: '',
    isFeatured: false
  });

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      const matchesPlan = planFilter === 'all' || u.plan === planFilter;
      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [users, searchTerm, statusFilter, planFilter]);

  const filteredCatalog = useMemo(() => {
    return content.filter(c => c.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [content, searchTerm]);

  const filteredAdRecords = useMemo(() => {
    return adRecords.filter(r => {
      const matchSearch = !adSearchTerm.trim() ||
        (r.streamUrl || '').toLowerCase().includes(adSearchTerm.toLowerCase()) ||
        (r.contentTitle || '').toLowerCase().includes(adSearchTerm.toLowerCase()) ||
        (r.reason || '').toLowerCase().includes(adSearchTerm.toLowerCase());
      const matchStatus = adStatusFilter === 'todos' || r.status === adStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [adRecords, adSearchTerm, adStatusFilter]);

  const handleManualBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAdUrl.trim()) return;
    videoAdBlocker.blockStreamManually(
      manualAdUrl.trim(),
      manualAdReason.trim() || 'Bloqueado manualmente por publicidade embutida no vídeo',
      manualAdTitle.trim() || undefined
    );
    setManualAdUrl('');
    setManualAdTitle('');
    setAdRecords(videoAdBlocker.getAuditRecords());
  };

  const handleUnblockAd = (url: string) => {
    videoAdBlocker.unblockStream(url);
    setAdRecords(videoAdBlocker.getAuditRecords());
  };

  const handleClearAdHistory = () => {
    if (confirm('Deseja limpar o histórico de auditoria de propagandas? (Bloqueios manuais serão preservados)')) {
      videoAdBlocker.clearAuditHistory();
      setAdRecords(videoAdBlocker.getAuditRecords());
    }
  };

  const handleCheckHealth = async (id: string) => {
    setTestingId(id);
    try {
      await providerRegistry.checkProviderHealth(id);
      setProviders(providerRegistry.getProviders());
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleProvider = (id: string) => {
    const p = providers.find(item => item.id === id);
    if (p) {
      providerRegistry.updateProvider(id, { enabled: !p.enabled });
      setProviders(providerRegistry.getProviders());
    }
  };

  const handleRemoveProvider = (id: string) => {
    providerRegistry.removeProvider(id);
    setProviders(providerRegistry.getProviders());
  };

  const handleAddProvider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProvName.trim() || !newProvUrl.trim()) return;
    const newConfig: ProviderConfig = {
      id: `prov-${Date.now()}`,
      name: newProvName.trim(),
      url: newProvUrl.trim(),
      type: newProvType,
      enabled: true,
      priority: providers.length + 1,
      isPtBr: newProvName.toLowerCase().includes('br') || newProvName.toLowerCase().includes('dublado'),
      status: 'online'
    };
    providerRegistry.addProvider(newConfig);
    setProviders(providerRegistry.getProviders());
    setNewProvName('');
    setNewProvUrl('');
  };

  const handleTestStreamResolution = async () => {
    if (!testStreamInput.trim()) return;
    setIsResolvingStreams(true);
    try {
      const isTmdbNumber = /^\d+$/.test(testStreamInput.trim());
      const res = await providerRegistry.resolveStreams(
        'movie',
        isTmdbNumber ? { tmdbId: testStreamInput.trim() } : { imdbId: testStreamInput.trim() }
      );
      setResolvedTestStreams(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsResolvingStreams(false);
    }
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      onUpdateUser(editingUser);
      setEditingUser(null);
    }
  };

  const handleMediaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMedia) {
      onUpdateContent(editingMedia);
      setEditingMedia(null);
    } else {
      onAddContent({ ...newMedia, id: Date.now().toString() } as ContentItem);
      setShowAddMedia(false);
      setNewMedia({ 
        title: '', type: ContentType.MOVIE, rating: 8.5, year: 2024, image: '', 
        backdrop: '', description: '', platform: 'Netflix', tmdbId: '', isFeatured: false 
      });
    }
  };

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGlobalNotify.title || !newGlobalNotify.message) return;
    onSendGlobalNotification({
      id: Date.now().toString(),
      title: newGlobalNotify.title,
      message: newGlobalNotify.message,
      type: (newGlobalNotify.type as any) || 'info',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      read: false
    });
    setNewGlobalNotify({ title: '', message: '', type: 'info' });
  };

  const exportDatabase = async () => {
    const { db } = await import('../db');
    const notifications = await db.notifications.toArray();
    const data = {
      users,
      content,
      notifications,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zapitv_backup_${new Date().toLocaleDateString()}.json`;
    link.click();
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    setImportStatus('Processando...');
    
    const lines = importText.split('\n');
    let added = 0;
    let updated = 0;
    
    // Expressão regular para capturar o formato: "- Título (Ano) - URL"
    const regex = /-\s*(.+?)\s*\((\d{4})\)\s*-\s*(https?:\/\/[^\s]+)/;
    
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        const title = match[1].trim();
        const year = parseInt(match[2]);
        const url = match[3].trim();
        
        // Tenta extrair o ID do IMDb da URL se possível
        const imdbMatch = url.match(/tt\d+/);
        const imdbId = imdbMatch ? imdbMatch[0] : '';
        
        // Procura se o filme já existe no catálogo
        const existing = content.find(c => 
          c.title.toLowerCase() === title.toLowerCase() || 
          (c.imdbId && c.imdbId === imdbId) ||
          (c.videoUrl && c.videoUrl.includes(imdbId))
        );
        
        if (existing) {
          // Atualiza apenas a URL do iframe
          if (existing.videoUrl !== url) {
            onUpdateContent({ ...existing, videoUrl: url, imdbId: imdbId || existing.imdbId });
            updated++;
          }
        } else {
          // Cria um novo filme
          const newItem: ContentItem = {
            id: `movie-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title,
            year,
            type: ContentType.MOVIE,
            rating: 0,
            image: `https://picsum.photos/seed/${imdbId || title.replace(/\s/g, '')}/400/600`,
            backdrop: imdbId ? `https://images.metahub.space/background/medium/${imdbId}/img` : `https://picsum.photos/seed/${title.replace(/\s/g, '')}-bg/1200/600`,
            description: 'Sinopse indisponível.',
            platform: 'Outros',
            videoUrl: url,
            imdbId: imdbId,
            isFeatured: false
          };
          onAddContent(newItem);
          added++;
        }
      }
    }
    
    setImportStatus(`Concluído! ${added} adicionados, ${updated} atualizados.`);
    setTimeout(() => {
      setShowImportModal(false);
      setImportText('');
      setImportStatus('');
    }, 3000);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* MODAL: EDITAR USUÁRIO - GLASSMORPHISM (PORTAL) */}
      {editingUser && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-xl bg-black/30 backdrop-blur-2xl border border-white/10 rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Glass Shine */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

            <div className="relative z-10 flex justify-between items-center mb-8 border-b border-white/5 pb-6">
              <h3 className="text-2xl font-black text-white">Editar Assinante</h3>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="relative z-10 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase font-black text-white/60 mb-2">Nome Completo</label>
                  <input 
                    type="text" 
                    value={editingUser.name} 
                    onChange={e => setEditingUser({...editingUser, name: e.target.value})} 
                    className="w-full p-4 rounded-2xl border border-white/10 bg-black/20 text-white outline-none focus:bg-black/40 transition-all font-bold text-sm placeholder:text-white/20" 
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase font-black text-white/60 mb-2">E-mail de Acesso</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                    <input 
                      type="email" 
                      value={editingUser.email} 
                      onChange={e => setEditingUser({...editingUser, email: e.target.value})} 
                      className="w-full pl-11 p-4 rounded-2xl border border-white/10 bg-black/20 text-white outline-none focus:bg-black/40 transition-all font-bold text-sm placeholder:text-white/20" 
                    />
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] uppercase font-black text-white/60 mb-2">Nova Senha (Opcional)</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                    <input 
                      type="password" 
                      placeholder="Digite para alterar a senha..." 
                      value={editingUser.password || ''} 
                      onChange={e => setEditingUser({...editingUser, password: e.target.value})} 
                      className="w-full pl-11 p-4 rounded-2xl border border-white/10 bg-black/20 text-white outline-none focus:bg-black/40 transition-all font-bold text-sm placeholder:text-white/20" 
                    />
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] uppercase font-black text-white/60 mb-2">Situação Financeira (Automático)</label>
                  <div className="w-full p-4 rounded-2xl border border-white/10 bg-black/20 flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${editingUser.status === 'Ativo' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : editingUser.status === 'Atrasado' ? 'bg-red-500' : 'bg-[#007df7]'}`} />
                    <span className="font-black text-xs uppercase tracking-widest text-white/80">
                      {editingUser.status === 'Ativo' ? 'Mensalidade em Dia' : editingUser.status === 'Atrasado' ? 'Pagamento Pendente / Atrasado' : 'Aguardando Processamento'}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/30 mt-2 italic">* O status é gerado pelo gateway de pagamento e não pode ser alterado manualmente.</p>
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-xl shadow-blue-600/20 hover:scale-[1.02] transition-all">SALVAR ALTERAÇÕES</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: ADICIONAR/EDITAR MÍDIA - GLASSMORPHISM (PORTAL) */}
      {(showAddMedia || editingMedia) && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-black/30 backdrop-blur-2xl border border-white/10 rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Glass Shine */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

            <div className="relative z-10 flex justify-between items-center mb-8 border-b border-white/5 pb-6">
              <h3 className="text-2xl font-black text-white">{editingMedia ? 'Editar Título' : 'Novo Título'}</h3>
              <button onClick={() => { setShowAddMedia(false); setEditingMedia(null); }} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleMediaSubmit} className="relative z-10 space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase font-black text-white/60 mb-2">Título da Obra</label>
                  <input required type="text" value={editingMedia ? editingMedia.title : newMedia.title} onChange={e => editingMedia ? setEditingMedia({...editingMedia, title: e.target.value}) : setNewMedia({...newMedia, title: e.target.value})} className="w-full p-4 rounded-2xl border border-white/10 bg-black/20 text-white outline-none focus:bg-black/40 transition-all font-bold text-sm placeholder:text-white/20" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-white/60 mb-2">Tipo de Conteúdo</label>
                  <select value={editingMedia ? editingMedia.type : newMedia.type} onChange={e => editingMedia ? setEditingMedia({...editingMedia, type: e.target.value as ContentType}) : setNewMedia({...newMedia, type: e.target.value as ContentType})} className="w-full p-4 rounded-2xl border border-white/10 bg-black/20 text-white outline-none focus:bg-black/40 transition-all font-bold text-sm">
                    <option value={ContentType.MOVIE} className="text-gray-900">Filme</option>
                    <option value={ContentType.SERIES} className="text-gray-900">Série</option>
                    <option value={ContentType.ANIME} className="text-gray-900">Anime</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-white/60 mb-2">ID do TMDB (Player)</label>
                  <input type="text" value={editingMedia ? editingMedia.tmdbId || '' : newMedia.tmdbId || ''} onChange={e => editingMedia ? setEditingMedia({...editingMedia, tmdbId: e.target.value}) : setNewMedia({...newMedia, tmdbId: e.target.value})} className="w-full p-4 rounded-2xl border border-white/10 bg-black/20 text-white outline-none focus:bg-black/40 transition-all font-bold text-sm placeholder:text-white/20" placeholder="Ex: 693134" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase font-black text-white/60 mb-2">Plataformas</label>
                  <div className="flex flex-wrap gap-2">
                    {['Netflix', 'Prime Video', 'Max', 'Disney+', 'Apple TV+', 'Crunchyroll', 'Globoplay', 'Paramount+', 'Star+'].map(platform => {
                      const currentPlatforms = (editingMedia ? editingMedia.platform : newMedia.platform)?.split(',').map(p => p.trim()).filter(Boolean) || [];
                      const isSelected = currentPlatforms.includes(platform);
                      return (
                        <button
                          key={platform}
                          type="button"
                          onClick={() => {
                            const newPlatforms = isSelected 
                              ? currentPlatforms.filter(p => p !== platform)
                              : [...currentPlatforms, platform];
                            const newPlatformString = newPlatforms.join(', ');
                            if (editingMedia) {
                              setEditingMedia({...editingMedia, platform: newPlatformString});
                            } else {
                              setNewMedia({...newMedia, platform: newPlatformString});
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isSelected ? 'bg-[#007df7] text-white' : 'bg-black/20 text-white/60 hover:bg-black/40 border border-white/5'}`}
                        >
                          {platform}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-white/60 mb-2">Nota (IMDb)</label>
                  <input type="number" step="0.1" value={editingMedia ? editingMedia.rating : newMedia.rating} onChange={e => editingMedia ? setEditingMedia({...editingMedia, rating: parseFloat(e.target.value)}) : setNewMedia({...newMedia, rating: parseFloat(e.target.value)})} className="w-full p-4 rounded-2xl border border-white/10 bg-black/20 text-white outline-none focus:bg-black/40 transition-all font-bold text-sm placeholder:text-white/20" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-white/60 mb-2">Ano</label>
                  <input type="number" value={editingMedia ? editingMedia.year : newMedia.year} onChange={e => editingMedia ? setEditingMedia({...editingMedia, year: parseInt(e.target.value)}) : setNewMedia({...newMedia, year: parseInt(e.target.value)})} className="w-full p-4 rounded-2xl border border-white/10 bg-black/20 text-white outline-none focus:bg-black/40 transition-all font-bold text-sm placeholder:text-white/20" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase font-black text-white/60 mb-2">URL da Capa (Vertical)</label>
                  <input type="text" value={editingMedia ? editingMedia.image : newMedia.image} onChange={e => editingMedia ? setEditingMedia({...editingMedia, image: e.target.value}) : setNewMedia({...newMedia, image: e.target.value})} className="w-full p-4 rounded-2xl border border-white/10 bg-black/20 text-white outline-none focus:bg-black/40 transition-all font-bold text-sm placeholder:text-white/20" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase font-black text-white/60 mb-2">URL do Banner (Horizontal)</label>
                  <input type="text" value={editingMedia ? editingMedia.backdrop : newMedia.backdrop} onChange={e => editingMedia ? setEditingMedia({...editingMedia, backdrop: e.target.value}) : setNewMedia({...newMedia, backdrop: e.target.value})} className="w-full p-4 rounded-2xl border border-white/10 bg-black/20 text-white outline-none focus:bg-black/40 transition-all font-bold text-sm placeholder:text-white/20" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase font-black text-white/60 mb-2">Sinopse</label>
                  <textarea rows={3} value={editingMedia ? editingMedia.description : newMedia.description} onChange={e => editingMedia ? setEditingMedia({...editingMedia, description: e.target.value}) : setNewMedia({...newMedia, description: e.target.value})} className="w-full p-4 rounded-2xl border border-white/10 bg-black/20 text-white outline-none focus:bg-black/40 transition-all font-bold text-sm resize-none placeholder:text-white/20" />
                </div>
                <div className="col-span-2 flex items-center gap-3 p-2">
                  <input type="checkbox" id="featured" checked={editingMedia ? editingMedia.isFeatured : newMedia.isFeatured} onChange={e => editingMedia ? setEditingMedia({...editingMedia, isFeatured: e.target.checked}) : setNewMedia({...newMedia, isFeatured: e.target.checked})} className="w-5 h-5 rounded border-gray-600 bg-black/20 text-[#007df7] focus:ring-[#007df7]" />
                  <label htmlFor="featured" className="text-sm font-bold text-white/80 cursor-pointer">Destacar no Banner Inicial</label>
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-[#007df7] hover:bg-[#0069d9] text-white rounded-2xl font-black shadow-xl shadow-[#007df7]/20 hover:scale-[1.02] transition-all">
                {editingMedia ? 'ATUALIZAR TÍTULO' : 'ADICIONAR AO CATÁLOGO'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* CABEÇALHO DASHBOARD */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-600/30"><Shield className="w-8 h-8" /></div>
            <div>
              <h2 className={`text-3xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Central Dev Mode</h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <p className="text-[10px] font-black uppercase tracking-widest text-green-500">Persistência Local Ativada</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-black/10 backdrop-blur-md">
          {[
            { id: 'providers', label: 'PROVEDORES STREMIO', icon: Tv, color: 'bg-orange-600' },
            { id: 'video_ads', label: 'PROPAGANDA (1XBET)', icon: ShieldAlert, color: 'bg-red-600' },
            { id: 'users', label: 'ASSINANTES', icon: Users, color: 'bg-blue-600' },
            { id: 'catalog', label: 'CATÁLOGO', icon: Film, color: 'bg-[#007df7]' },
            { id: 'notifications', label: 'COMUNICADOS', icon: Bell, color: 'bg-purple-600' },
            { id: 'database', label: 'BANCO', icon: CloudSync, color: 'bg-emerald-600' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-3 rounded-xl font-black text-[10px] tracking-widest flex items-center gap-2 transition-all ${
                activeTab === tab.id ? `${tab.color} text-white shadow-lg` : 'text-gray-500 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* FILTROS E BUSCA */}
      {(activeTab === 'users' || activeTab === 'catalog') && (
        <div className={`mb-6 p-4 rounded-3xl border flex flex-col md:flex-row gap-4 items-center ${isDarkMode ? 'bg-gray-900/40 border-gray-800' : 'bg-white shadow-sm'}`}>
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder={`Buscar em ${activeTab === 'users' ? 'assinantes' : 'títulos'}...`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`w-full pl-11 p-3 rounded-2xl border-none outline-none text-sm font-bold ${isDarkMode ? 'bg-white/5 text-white' : 'bg-gray-100 text-gray-900'}`} 
            />
          </div>
          
          {activeTab === 'users' && (
            <div className="flex gap-2 w-full md:w-auto">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`p-3 rounded-2xl text-xs font-black outline-none ${isDarkMode ? 'bg-white/5 border border-gray-800 text-white' : 'bg-gray-100 border border-gray-200 text-gray-900'}`}>
                <option value="all" className="text-gray-900 bg-white">TODOS STATUS</option>
                <option value="Ativo" className="text-gray-900 bg-white">MENSALIDADE PAGA</option>
                <option value="Atrasado" className="text-gray-900 bg-white">ATRASADOS</option>
              </select>
              <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className={`p-3 rounded-2xl text-xs font-black outline-none ${isDarkMode ? 'bg-white/5 border border-gray-800 text-white' : 'bg-gray-100 border border-gray-200 text-gray-900'}`}>
                <option value="all" className="text-gray-900 bg-white">TODOS PLANOS</option>
                <option value="Premium 4K" className="text-gray-900 bg-white">PREMIUM 4K</option>
                <option value="Premium" className="text-gray-900 bg-white">PREMIUM</option>
                <option value="Padrão" className="text-gray-900 bg-white">PADRÃO</option>
              </select>
            </div>
          )}

          {activeTab === 'catalog' && (
            <div className="flex gap-2 w-full md:w-auto">
              <button 
                onClick={() => setShowAddMedia(true)}
                className="px-6 py-3 bg-[#007df7] text-white rounded-2xl font-black text-[10px] tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-[#007df7]/20"
              >
                <Plus className="w-4 h-4" /> ADICIONAR TÍTULO
              </button>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO DAS ABAS */}
      <div className="animate-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'providers' ? (
          <div className="space-y-8">
            {/* Header info */}
            <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-black flex items-center gap-2">
                    <Tv className="w-5 h-5 text-orange-500" /> Provedores de Streaming & Stremio Addons
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Gerencie provedores automáticos, resolva manifests Stremio v3 e teste endpoints de reprodução.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-bold">
                    {providers.filter(p => p.enabled).length} Provedores Ativos
                  </span>
                </div>
              </div>

              {/* Tabela de provedores */}
              <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/20">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[9px] uppercase font-black tracking-widest text-gray-400 bg-white/5">
                      <th className="px-6 py-3.5">Nome / Identificador</th>
                      <th className="px-6 py-3.5">Tipo</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Latência</th>
                      <th className="px-6 py-3.5">Prioridade</th>
                      <th className="px-6 py-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {providers.map((p) => (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-white flex items-center gap-2">
                              {p.name}
                              {p.isPtBr && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-green-500/20 text-green-400 border border-green-500/30">
                                  PT-BR
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-gray-500 font-mono mt-0.5 truncate max-w-sm">
                              {p.url}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-white/10 text-gray-300">
                            {p.type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            p.status === 'online' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'online' ? 'bg-green-400' : 'bg-red-400'}`} />
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-gray-300">
                          {p.latencyMs ? `${p.latencyMs}ms` : '—'}
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-400">
                          #{p.priority}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleCheckHealth(p.id)}
                              disabled={testingId === p.id}
                              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                            >
                              {testingId === p.id ? 'Testando...' : 'Testar Ping'}
                            </button>
                            <button
                              onClick={() => handleToggleProvider(p.id)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                p.enabled ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-gray-800 text-gray-400'
                              }`}
                            >
                              {p.enabled ? 'Ativo' : 'Inativo'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Grid: Adicionar Provedor & Testador de Resolução */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Box 1: Adicionar Novo Provedor */}
              <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
                <h4 className="text-lg font-black mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#007df7]" /> Registrar Novo Provedor / Addon
                </h4>
                <form onSubmit={handleAddProvider} className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Nome do Provedor</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Torrentio BR ou Meu Addon"
                      value={newProvName}
                      onChange={e => setNewProvName(e.target.value)}
                      className="w-full p-3 rounded-xl border border-white/10 bg-black/30 text-white text-xs font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">URL Base / Manifest URL</label>
                    <input
                      type="text"
                      required
                      placeholder="https://exemplo.com/manifest.json"
                      value={newProvUrl}
                      onChange={e => setNewProvUrl(e.target.value)}
                      className="w-full p-3 rounded-xl border border-white/10 bg-black/30 text-white text-xs font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Tipo de Integração</label>
                    <select
                      value={newProvType}
                      onChange={e => setNewProvType(e.target.value as any)}
                      className="w-full p-3 rounded-xl border border-white/10 bg-[#151C26] text-white text-xs font-bold outline-none"
                    >
                      <option value="stremio-addon">Stremio Addon (Protocolo Oficial v3 JSON)</option>
                      <option value="direct-stream">Direct Video / HLS Stream (.m3u8, .mp4)</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg"
                  >
                    Salvar e Registrar Provedor
                  </button>
                </form>
              </div>

              {/* Box 2: Testador de Streams em Tempo Real */}
              <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
                <h4 className="text-lg font-black mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" /> Testador de Resolução de Fontes
                </h4>
                <p className="text-xs text-gray-400 mb-4">
                  Digite um TMDB ID (ex: 550 para Clube da Luta) ou IMDb ID (ex: tt0133093 para Matrix) para resolver streams agora:
                </p>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={testStreamInput}
                    onChange={e => setTestStreamInput(e.target.value)}
                    placeholder="TMDB ID ou IMDb ID..."
                    className="flex-1 p-3 rounded-xl border border-white/10 bg-black/30 text-white text-xs font-mono outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleTestStreamResolution}
                    disabled={isResolvingStreams}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                  >
                    {isResolvingStreams ? 'Consultando...' : 'Resolver'}
                  </button>
                </div>

                {resolvedTestStreams.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    <span className="text-[10px] font-bold uppercase text-gray-400">
                      {resolvedTestStreams.length} fontes encontradas (ordenadas por prioridade PT-BR):
                    </span>
                    {resolvedTestStreams.map((s, idx) => (
                      <div key={idx} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-white truncate">{s.title || s.name}</p>
                          <p className="text-[10px] text-gray-500 truncate">{s.providerName}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {s.isPtBr && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-green-500/20 text-green-400 border border-green-500/30">
                              DUBLADO
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded text-[9px] font-black bg-white/10 text-white">
                            {s.quality || 'HD'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'video_ads' ? (
          <div className="space-y-8">
            {/* Header info */}
            <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-black flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-500" /> Auditoria & Bloqueio Rígido de Propaganda Embutida (1xBet / Apostas)
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Política de tolerância zero: Vídeos com banners, marcas d'água de cassino ou overlays gravados na imagem são automaticamente rejeitados.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearAdHistory}
                    className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all"
                  >
                    Limpar Histórico
                  </button>
                </div>
              </div>

              {/* Cards de Métricas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-black/20 border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">Total Auditadas</p>
                  <p className="text-2xl font-black text-white">{adRecords.length}</p>
                </div>
                <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20">
                  <p className="text-[10px] font-black uppercase tracking-wider text-green-400 mb-1">Fontes Limpas</p>
                  <p className="text-2xl font-black text-green-400">
                    {adRecords.filter(r => r.status === 'limpo').length}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-[10px] font-black uppercase tracking-wider text-yellow-400 mb-1">Fontes Suspeitas</p>
                  <p className="text-2xl font-black text-yellow-400">
                    {adRecords.filter(r => r.status === 'suspeito').length}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                  <p className="text-[10px] font-black uppercase tracking-wider text-red-400 mb-1">Bloqueadas (1xBet / Ad)</p>
                  <p className="text-2xl font-black text-red-400">
                    {adRecords.filter(r => r.status === 'bloqueado por propaganda embutida').length}
                  </p>
                </div>
              </div>
            </div>

            {/* Bloqueio Manual & Filtros */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Formulário de Bloqueio Manual */}
              <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
                <h4 className="text-lg font-black mb-4 flex items-center gap-2">
                  <Ban className="w-5 h-5 text-red-500" /> Bloquear Fonte Manualmente
                </h4>
                <form onSubmit={handleManualBlock} className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">URL da Fonte / Stream</label>
                    <input
                      type="text"
                      required
                      placeholder="https://exemplo.com/video.mp4 ou .m3u8"
                      value={manualAdUrl}
                      onChange={e => setManualAdUrl(e.target.value)}
                      className="w-full p-3 rounded-xl border border-white/10 bg-black/30 text-white text-xs font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Título da Obra (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: Doraemon ou Anime XYZ"
                      value={manualAdTitle}
                      onChange={e => setManualAdTitle(e.target.value)}
                      className="w-full p-3 rounded-xl border border-white/10 bg-black/30 text-white text-xs font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Motivo do Bloqueio</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Contém banner 1xBet no topo aos 15s"
                      value={manualAdReason}
                      onChange={e => setManualAdReason(e.target.value)}
                      className="w-full p-3 rounded-xl border border-white/10 bg-black/30 text-white text-xs outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-600/20"
                  >
                    Adicionar Bloqueio Rígido
                  </button>
                </form>
              </div>

              {/* Lista e Tabela de Auditoria de Fontes */}
              <div className={`lg:col-span-2 p-8 rounded-3xl border flex flex-col ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por URL, título ou motivo..."
                      value={adSearchTerm}
                      onChange={e => setAdSearchTerm(e.target.value)}
                      className="p-2 bg-transparent text-white text-xs outline-none border-b border-white/10 w-48 sm:w-64"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['todos', 'limpo', 'suspeito', 'bloqueado por propaganda embutida'] as const).map(st => (
                      <button
                        key={st}
                        onClick={() => setAdStatusFilter(st)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                          adStatusFilter === st
                            ? st === 'bloqueado por propaganda embutida'
                              ? 'bg-red-500 text-white'
                              : st === 'suspeito'
                              ? 'bg-yellow-500 text-black'
                              : st === 'limpo'
                              ? 'bg-green-500 text-white'
                              : 'bg-white/20 text-white'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        {st === 'bloqueado por propaganda embutida' ? 'Bloqueados' : st === 'todos' ? 'Todos' : st}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredAdRecords.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-400">
                    <ShieldAlert className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm font-bold">Nenhum registro encontrado</p>
                    <p className="text-xs opacity-60 max-w-sm mt-1">
                      Conforme os streams forem inspecionados ou reproduzidos, os registros de análise visual e metadados aparecerão aqui.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {filteredAdRecords.map(record => (
                      <div
                        key={record.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          record.status === 'bloqueado por propaganda embutida'
                            ? 'bg-red-950/20 border-red-500/30'
                            : record.status === 'suspeito'
                            ? 'bg-yellow-950/20 border-yellow-500/30'
                            : 'bg-black/20 border-white/5'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                record.status === 'bloqueado por propaganda embutida'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : record.status === 'suspeito'
                                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                  : 'bg-green-500/20 text-green-400 border border-green-500/30'
                              }`}
                            >
                              {record.status === 'bloqueado por propaganda embutida'
                                ? 'BLOQUEADO'
                                : record.status.toUpperCase()}
                            </span>
                            {record.contentTitle && (
                              <span className="font-bold text-xs text-white">
                                {record.contentTitle}
                                {record.episode ? ` (Ep ${record.episode})` : ''}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-gray-400">
                            Risco: <strong className={record.riskScore >= 50 ? 'text-red-400' : 'text-green-400'}>{record.riskScore}%</strong>
                          </span>
                        </div>

                        <p className="text-xs text-gray-300 font-medium mb-2">
                          {record.reason}
                        </p>

                        {record.evidences.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {record.evidences.map((ev, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded text-[9px] bg-white/5 text-gray-300 border border-white/10"
                              >
                                {ev.region}: {ev.description}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-white/5">
                          <span className="text-[10px] font-mono text-gray-500 truncate max-w-md">
                            {record.streamUrl}
                          </span>
                          <div className="flex items-center gap-2">
                            {record.status === 'bloqueado por propaganda embutida' ? (
                              <button
                                onClick={() => handleUnblockAd(record.streamUrl)}
                                className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-lg text-[10px] font-bold uppercase transition-all"
                              >
                                Desbloquear
                              </button>
                            ) : (
                              <button
                                onClick={() => videoAdBlocker.blockStreamManually(record.streamUrl, 'Bloqueado manualmente no painel administrativo', record.contentTitle)}
                                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-[10px] font-bold uppercase transition-all"
                              >
                                Bloquear
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'users' ? (
          <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
            <table className="w-full text-left">
              <thead>
                <tr className={`text-[9px] uppercase font-black tracking-widest border-b ${isDarkMode ? 'bg-gray-900/50 border-gray-800 text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
                  <th className="px-8 py-4">Assinante</th>
                  <th className="px-8 py-4 text-center">Plano</th>
                  <th className="px-8 py-4 text-center">Pagamento</th>
                  <th className="px-8 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/30">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="group hover:bg-blue-600/5 transition-colors">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black bg-blue-600 text-xs shadow-lg">{user.name.charAt(0)}</div>
                        <div>
                          <p className="font-bold text-sm mb-0.5">{user.name}</p>
                          <p className="text-[10px] opacity-50">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-center font-bold text-xs">{user.plan}</td>
                    <td className="px-8 py-4 text-center">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                        user.status === 'Ativo' ? 'bg-green-500/10 text-green-500' : 
                        user.status === 'Atrasado' ? 'bg-[#007df7]/10 text-[#007df7]' : 'bg-[#007df7]/10 text-[#007df7]'
                      }`}>
                        {user.status === 'Ativo' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {user.status === 'Ativo' ? 'PAGO' : user.status === 'Atrasado' ? 'ATRASADO' : 'PENDENTE'}
                      </div>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setEditingUser(user)} className="p-2 rounded-xl bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => onDeleteUser(user.id)} className="p-2 rounded-xl bg-[#007df7]/10 text-[#007df7] hover:bg-[#007df7] hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'catalog' ? (
          <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
            <table className="w-full text-left">
              <thead>
                <tr className={`text-[9px] uppercase font-black tracking-widest border-b ${isDarkMode ? 'bg-gray-900/50 border-gray-800 text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
                  <th className="px-8 py-4">Obra</th>
                  <th className="px-8 py-4 text-center">Nota</th>
                  <th className="px-8 py-4 text-center">Ano</th>
                  <th className="px-8 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/30">
                {filteredCatalog.map(item => (
                  <tr key={item.id} className="group hover:bg-[#007df7]/5 transition-colors">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-4">
                        <img src={item.image} className="w-10 h-14 rounded-lg object-cover shadow-lg border border-white/10" />
                        <div>
                          <p className="font-bold text-sm mb-1">{item.title}</p>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black text-white bg-[#007df7]">{item.type}</span>
                            <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest">{item.platform}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-center">
                      <div className="inline-flex items-center gap-1 text-[#007df7] font-black text-sm">
                        <Star className="w-3.5 h-3.5 fill-current" /> {item.rating}
                      </div>
                    </td>
                    <td className="px-8 py-4 text-center text-xs font-bold opacity-60">{item.year}</td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setEditingMedia(item)} className="p-2 rounded-xl bg-[#007df7]/10 text-[#007df7] hover:bg-[#007df7] hover:text-white transition-all"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => onDeleteContent(item.id)} className="p-2 rounded-xl bg-[#007df7]/10 text-[#007df7] hover:bg-[#007df7] hover:text-white transition-all"><Trash className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'notifications' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-[#151C26] border-gray-800' : 'bg-white shadow-xl'}`}>
              <div className="flex items-center gap-3 mb-6">
                <Megaphone className="text-purple-600 w-6 h-6" />
                <h3 className="text-xl font-black">Broadcast Global</h3>
              </div>
              <form onSubmit={handleBroadcast} className="space-y-4">
                <input required type="text" placeholder="Título do Comunicado" value={newGlobalNotify.title} onChange={e => setNewGlobalNotify({...newGlobalNotify, title: e.target.value})} className={`w-full p-4 rounded-2xl border outline-none font-bold text-sm ${isDarkMode ? 'bg-gray-900 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'}`} />
                <div className="grid grid-cols-3 gap-2">
                  {['info', 'alert', 'promo'].map(type => (
                    <button 
                      key={type}
                      type="button"
                      onClick={() => setNewGlobalNotify({...newGlobalNotify, type: type as any})}
                      className={`py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${
                        newGlobalNotify.type === type 
                          ? (type === 'info' ? 'bg-blue-600 text-white border-blue-600' : type === 'alert' ? 'bg-[#007df7] text-white border-[#007df7]' : 'bg-[#007df7] text-white border-[#007df7]')
                          : 'border-gray-800 text-gray-500 hover:border-gray-600'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <textarea required rows={4} placeholder="Mensagem para todos os usuários..." value={newGlobalNotify.message} onChange={e => setNewGlobalNotify({...newGlobalNotify, message: e.target.value})} className={`w-full p-4 rounded-2xl border outline-none font-bold text-sm resize-none ${isDarkMode ? 'bg-gray-900 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'}`} />
                <button type="submit" className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black shadow-xl flex items-center justify-center gap-3">
                  <Send className="w-5 h-5" /> DISPARAR ALERTA
                </button>
              </form>
            </div>
            
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 rounded-3xl bg-purple-600/10 flex items-center justify-center text-purple-600 mb-6"><CloudSync className="w-10 h-10 animate-spin-slow" /></div>
              <h4 className="text-lg font-black mb-2">Monitor de Sincronia</h4>
              <p className="text-sm opacity-50 mb-8 max-w-xs">Todas as mensagens são enviadas via WebSocket simulado e persistidas para todos os perfis ativos.</p>
              <button onClick={onClearNotifications} className="px-6 py-3 border border-[#007df7]/50 text-[#007df7] rounded-xl font-black text-[10px] tracking-widest hover:bg-[#007df7] hover:text-white transition-all">LIMPAR HISTÓRICO</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className={`p-10 rounded-3xl border flex flex-col items-center text-center ${isDarkMode ? 'bg-[#151C26] border-gray-800' : 'bg-white shadow-xl'}`}>
              <Download className="w-16 h-16 text-emerald-500 mb-6" />
              <h3 className="text-xl font-black mb-2">Exportar Backup</h3>
              <p className="text-gray-500 mb-8 text-sm max-w-xs">Gere um arquivo físico com todo o estado do site para restauração futura.</p>
              <button onClick={exportDatabase} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-3">
                <Download className="w-5 h-5" /> BAIXAR JSON
              </button>
            </div>
            <div className={`p-10 rounded-3xl border flex flex-col items-center text-center ${isDarkMode ? 'bg-[#151C26] border-gray-800' : 'bg-white shadow-xl'}`}>
              <Upload className="w-16 h-16 text-blue-500 mb-6" />
              <h3 className="text-xl font-black mb-2">Importar Filmes em Massa</h3>
              <p className="text-gray-500 mb-8 text-sm max-w-xs">Cole a lista de filmes com links para adicionar ou atualizar o catálogo.</p>
              <button onClick={() => setShowImportModal(true)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-3">
                <Upload className="w-5 h-5" /> IMPORTAR LISTA
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: IMPORTAR FILMES EM MASSA */}
      {showImportModal && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-3xl bg-black/30 backdrop-blur-2xl border border-white/10 rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

            <div className="relative z-10 flex justify-between items-center mb-8 border-b border-white/5 pb-6">
              <h3 className="text-2xl font-black text-white">Importar Filmes em Massa</h3>
              <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="relative z-10 space-y-4">
              <p className="text-sm text-white/60">
                Cole a lista de filmes no formato: <br />
                <code className="bg-black/40 p-1 rounded text-xs">- Nome do Filme (Ano) - https://link-do-iframe.com</code>
              </p>
              <textarea 
                rows={10} 
                value={importText} 
                onChange={e => setImportText(e.target.value)} 
                placeholder="- Conselhos De Um Serial Killer Aposentado (2025) - https://watchplayer.lat/movie/tt17492148"
                className="w-full p-4 rounded-2xl border border-white/10 bg-black/20 text-white outline-none focus:bg-black/40 transition-all font-mono text-xs resize-none placeholder:text-white/20" 
              />
              
              {importStatus && (
                <div className="p-4 rounded-xl bg-blue-600/20 text-blue-400 font-bold text-sm text-center">
                  {importStatus}
                </div>
              )}

              <button 
                onClick={handleImport} 
                disabled={!importText.trim() || importStatus.includes('Processando')}
                className="w-full py-4 bg-[#007df7] hover:bg-[#0069d9] text-white rounded-2xl font-black shadow-xl shadow-[#007df7]/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                PROCESSAR LISTA
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      <style>{`
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default AdminView;

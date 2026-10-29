
import React, { useState, useMemo, useEffect } from 'react';
import { fetchAdminAccounts, mergeAdminAccounts, type AdminAccount } from '../src/core/admin/adminAccountsClient';
import { createPortal } from 'react-dom';
import { 
  Shield, Trash2, Search, Filter, Users, DollarSign, 
  X, Save, LayoutGrid, Plus, Film, Send, Download, Upload,
  Edit3, Trash, Star, Bell, Megaphone, CheckCircle, Info, AlertTriangle, Lock, Mail, Image as ImageIcon, CloudSync, Tv, Sparkles, Key, Play, Activity, Check,
  ShieldAlert, Ban, AlertOctagon, Flame, RefreshCw, FastForward, Clock, SkipForward,
  Bug, Radio
} from 'lucide-react';
import { FeedbackAdminPanel } from '../src/components/admin/FeedbackAdminPanel';
import { LiveTvAdminPanel } from '../src/components/admin/LiveTvAdminPanel';
import { User, ContentItem, ContentType, SiteNotification } from '../types';
import { providerRegistry, ProviderConfig } from '../src/core/providers/providerRegistry';
import { StremioStream } from '../src/core/stremio/stremioTypes';
import { videoAdBlocker, AdAuditRecord, AdAuditStatus } from '../src/core/security/videoAdBlocker';
import { catalogEligibilityService, MediaEligibilityRecord } from '../src/core/catalog/CatalogEligibilityService';
import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService';
import { FeaturedSelectionResult, FeaturedAuditItem } from '../src/core/rankings/featuredRankingTypes';
import { imdbWeeklyRankingService, CorrespondenceAuditResult } from '../src/core/rankings/IMDbWeeklyRankingService';
import { 
  skipService, 
  AdminSkipEntry, 
  SkipType, 
  parseTimeToSeconds, 
  formatSecondsToTime, 
  VERIFIED_SERIES_INTERVALS 
} from '../src/core/skip/skipService';

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
  const [activeTab, setActiveTab] = useState<'providers' | 'eligibility' | 'video_ads' | 'rankings' | 'skip_intervals' | 'users' | 'catalog' | 'notifications' | 'feedbacks' | 'database' | 'livetv'>('providers');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentAccounts, setCurrentAccounts] = useState<AdminAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState('');
  useEffect(() => {
    if (activeTab !== 'users') return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setAccountsLoading(true); setAccountsError('');
    fetchAdminAccounts(controller.signal).then(accounts => {
      if (active) setCurrentAccounts(accounts);
    }).catch(() => {
      if (active) setAccountsError('Não foi possível carregar as contas atuais. Reabra esta aba para tentar novamente.');
    }).finally(() => {
      clearTimeout(timeout);
      if (active) setAccountsLoading(false);
    });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [activeTab]);
  const listedUsers = useMemo(() => mergeAdminAccounts(users, currentAccounts), [users, currentAccounts]);
  const [editingMedia, setEditingMedia] = useState<ContentItem | null>(null);
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState('');

  // Diagnóstico e Gestão de Rankings Em Destaque (IMDb)
  const [featuredData, setFeaturedData] = useState<FeaturedSelectionResult>(() => featuredRankingService.getFeaturedSelectionSync());
  const [isUpdatingFeatured, setIsUpdatingFeatured] = useState(false);
  const [featuredAuditCategory, setFeaturedAuditCategory] = useState<'all' | 'movies' | 'series'>('all');
  const [featuredAuditStatus, setFeaturedAuditStatus] = useState<'all' | 'approved' | 'rejected'>('all');
  const [featuredSearchTerm, setFeaturedSearchTerm] = useState('');

  // Auditoria de Correspondência Oficial com IMDb
  const [correspondenceResult, setCorrespondenceResult] = useState<CorrespondenceAuditResult | null>(null);
  const [showCorrespondenceModal, setShowCorrespondenceModal] = useState(false);
  const [showImportSnapshotModal, setShowImportSnapshotModal] = useState(false);
  const [importSnapshotJson, setImportSnapshotJson] = useState('');
  const [importSnapshotError, setImportSnapshotError] = useState('');

  React.useEffect(() => {
    return featuredRankingService.subscribe((res) => {
      setFeaturedData(res);
    });
  }, []);

  const handleRefreshFeatured = async () => {
    setIsUpdatingFeatured(true);
    try {
      const res = await featuredRankingService.refreshFeaturedSelection(content);
      setFeaturedData(res);
    } finally {
      setIsUpdatingFeatured(false);
    }
  };

  const handleVerifyCorrespondence = () => {
    const res = imdbWeeklyRankingService.verifyCorrespondence(
      featuredData.featuredMovies,
      featuredData.featuredSeries
    );
    setCorrespondenceResult(res);
    setShowCorrespondenceModal(true);
  };

  const handleImportSnapshotSubmit = () => {
    try {
      setImportSnapshotError('');
      const parsed = JSON.parse(importSnapshotJson);
      const res = imdbWeeklyRankingService.importAuthorizedSnapshot(parsed);
      if (!res.success) {
        setImportSnapshotError(res.message);
        return;
      }
      const updated = featuredRankingService.recomputeFeaturedSelectionSync(content);
      setFeaturedData(updated);
      setShowImportSnapshotModal(false);
      setImportSnapshotJson('');
    } catch (e: any) {
      setImportSnapshotError(e?.message || 'JSON inválido');
    }
  };
  
  // Stremio Providers State
  const [providers, setProviders] = useState<ProviderConfig[]>(() => providerRegistry.getProviders());
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testStreamInput, setTestStreamInput] = useState('550');
  const [resolvedTestStreams, setResolvedTestStreams] = useState<StremioStream[]>([]);
  const [isResolvingStreams, setIsResolvingStreams] = useState(false);
  const [newProvName, setNewProvName] = useState('');
  const [newProvUrl, setNewProvUrl] = useState('');
  const [newProvType, setNewProvType] = useState<ProviderConfig['type']>('stremio-addon');
  
  // Auditoria de Elegibilidade & Disponibilidade de Fontes
  const [eligibilityRecords, setEligibilityRecords] = useState<MediaEligibilityRecord[]>(() => catalogEligibilityService.getAllRecords());
  const [eligibilitySearch, setEligibilitySearch] = useState('');
  const [eligibilityFilter, setEligibilityFilter] = useState<'all' | 'approved' | 'rejected' | 'not_released' | 'in_theaters'>('all');
  const [auditQueryInput, setAuditQueryInput] = useState('');
  const [isAuditingItem, setIsAuditingItem] = useState(false);
  const [auditResultRecord, setAuditResultRecord] = useState<MediaEligibilityRecord | null>(null);

  // Subscrever às atualizações do CatalogEligibilityService
  React.useEffect(() => {
    return catalogEligibilityService.subscribe(() => {
      setEligibilityRecords(catalogEligibilityService.getAllRecords());
    });
  }, []);

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

  // Gestão de Intervalos de Abertura e Créditos (Pular Abertura / Recapitulação / Créditos)
  const [adminSkipList, setAdminSkipList] = useState<AdminSkipEntry[]>(() => skipService.getAllAdminIntervals());
  const [skipSearchTerm, setSkipSearchTerm] = useState('');
  const [skipTypeFilter, setSkipTypeFilter] = useState<'all' | 'op' | 'recap' | 'ed'>('all');
  const [skipSelectedMediaId, setSkipSelectedMediaId] = useState('');
  const [skipCustomTitleInput, setSkipCustomTitleInput] = useState('');
  const [skipSeasonInput, setSkipSeasonInput] = useState('1');
  const [skipEpisodeInput, setSkipEpisodeInput] = useState('1');
  const [skipTypeInput, setSkipTypeInput] = useState<SkipType>('op');
  const [skipStartInput, setSkipStartInput] = useState('');
  const [skipEndInput, setSkipEndInput] = useState('');
  const [skipEditingId, setSkipEditingId] = useState<string | null>(null);
  const [skipFormError, setSkipFormError] = useState('');
  const [skipSuccessToast, setSkipSuccessToast] = useState('');

  // Séries e Animes do catálogo disponíveis para seleção rápida
  const availableSeriesList = useMemo(() => {
    return content.filter(c => c.type === ContentType.SERIES || c.type === ContentType.ANIME || (c as any).type === 'serie');
  }, [content]);

  // Handler para Salvar Intervalo
  const handleSaveSkipInterval = (e: React.FormEvent) => {
    e.preventDefault();
    setSkipFormError('');

    const startSec = parseTimeToSeconds(skipStartInput);
    const endSec = parseTimeToSeconds(skipEndInput);

    if (isNaN(startSec) || isNaN(endSec) || (startSec === 0 && endSec === 0)) {
      setSkipFormError('Por favor informe tempos válidos (ex: 450 ou 07:30).');
      return;
    }

    if (endSec <= startSec) {
      setSkipFormError('O tempo de término deve ser estritamente posterior ao tempo de início.');
      return;
    }

    const seasonNum = parseInt(skipSeasonInput, 10) || 1;
    const epNum = parseInt(skipEpisodeInput, 10) || 1;

    let targetId = skipSelectedMediaId.trim();
    let targetTitle = skipCustomTitleInput.trim();

    if (!targetId && targetTitle) {
      targetId = targetTitle.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').trim();
    }

    if (!targetId && !targetTitle) {
      setSkipFormError('Selecione uma série do catálogo ou digite o identificador/título da obra.');
      return;
    }

    const foundMedia = availableSeriesList.find(m => m.id === targetId || m.tmdbId === targetId || m.imdbId === targetId);
    if (foundMedia && !targetTitle) {
      targetTitle = foundMedia.title;
    }

    const saved = skipService.saveAdminInterval({
      id: skipEditingId || undefined,
      contentId: targetId,
      contentTitle: targetTitle || targetId,
      season: seasonNum,
      episode: epNum,
      type: skipTypeInput,
      startTime: startSec,
      endTime: endSec,
      label: skipService.getLabelForType(skipTypeInput),
      source: 'admin'
    });

    setAdminSkipList(skipService.getAllAdminIntervals());
    setSkipEditingId(null);
    setSkipStartInput('');
    setSkipEndInput('');
    setSkipSuccessToast(`Intervalo "${saved.label}" salvo com sucesso para ${targetTitle || targetId} S${seasonNum}E${epNum}!`);
    setTimeout(() => setSkipSuccessToast(''), 4000);
  };

  const handleDeleteSkipInterval = (id: string) => {
    skipService.deleteAdminInterval(id);
    setAdminSkipList(skipService.getAllAdminIntervals());
  };

  const handleEditSkipInterval = (entry: AdminSkipEntry) => {
    setSkipEditingId(entry.id);
    setSkipSelectedMediaId(entry.contentId);
    setSkipCustomTitleInput(entry.contentTitle || entry.contentId);
    setSkipSeasonInput(String(entry.season));
    setSkipEpisodeInput(String(entry.episode));
    setSkipTypeInput(entry.type);
    setSkipStartInput(formatSecondsToTime(entry.startTime));
    setSkipEndInput(formatSecondsToTime(entry.endTime));
    setSkipFormError('');
  };

  const handleLoadVerifiedDexter = () => {
    const dexterConfig = VERIFIED_SERIES_INTERVALS.find(v => v.title.toLowerCase() === 'dexter');
    if (!dexterConfig) return;

    let count = 0;
    Object.entries(dexterConfig.seasons).forEach(([seasonStr, episodes]) => {
      const seasonNum = parseInt(seasonStr, 10);
      Object.entries(episodes).forEach(([epStr, intervals]) => {
        const epNum = parseInt(epStr, 10);
        intervals.forEach(inv => {
          skipService.saveAdminInterval({
            contentId: '1405',
            contentTitle: 'Dexter',
            season: seasonNum,
            episode: epNum,
            type: inv.type,
            startTime: inv.startTime,
            endTime: inv.endTime,
            source: 'verified'
          });
          count++;
        });
      });
    });

    setAdminSkipList(skipService.getAllAdminIntervals());
    setSkipSuccessToast(`${count} intervalos oficiais verificados de Dexter (Season 1) importados para o painel!`);
    setTimeout(() => setSkipSuccessToast(''), 4000);
  };

  // Filtro de intervalos da tabela
  const filteredSkipList = useMemo(() => {
    return adminSkipList.filter(item => {
      const matchSearch = !skipSearchTerm.trim() ||
        (item.contentTitle || '').toLowerCase().includes(skipSearchTerm.toLowerCase()) ||
        (item.contentId || '').toLowerCase().includes(skipSearchTerm.toLowerCase()) ||
        `s${item.season}e${item.episode}`.includes(skipSearchTerm.toLowerCase()) ||
        `s${item.season}`.includes(skipSearchTerm.toLowerCase());
      const matchType = skipTypeFilter === 'all' || item.type === skipTypeFilter;
      return matchSearch && matchType;
    });
  }, [adminSkipList, skipSearchTerm, skipTypeFilter]);

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
    return listedUsers.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || (!u.readOnlyAccount && u.status === statusFilter);
      const matchesPlan = planFilter === 'all' || u.plan === planFilter;
      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [listedUsers, searchTerm, statusFilter, planFilter]);

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

  const handleUpdatePriority = (id: string, newPriority: number) => {
    providerRegistry.updateProvider(id, { priority: newPriority });
    setProviders(providerRegistry.getProviders());
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
    const sectionTitles = await db.keyValueStore.get('zapitv_section_titles');
    const heroCarouselRaw = localStorage.getItem('zapitv_hero_carousel_v1');
    const data = {
      users: users.map(({ password, ...safeUser }) => safeUser),
      content,
      notifications,
      customSections: await db.customSections.toArray(),
      sectionTitles: sectionTitles?.value ?? null,
      heroCarouselRaw,
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
            { id: 'livetv', label: 'TV AO VIVO & CANAIS', icon: Radio, color: 'bg-emerald-600' },
            { id: 'eligibility', label: 'ELEGIBILIDADE & FONTES', icon: Activity, color: 'bg-indigo-600' },
            { id: 'video_ads', label: 'PROPAGANDA (1XBET)', icon: ShieldAlert, color: 'bg-red-600' },
            { id: 'rankings', label: 'EM DESTAQUE (IMDb)', icon: Flame, color: 'bg-amber-600' },
            { id: 'skip_intervals', label: 'INTERVALOS DE SKIP', icon: FastForward, color: 'bg-cyan-600' },
            { id: 'users', label: 'ASSINANTES', icon: Users, color: 'bg-blue-600' },
            { id: 'catalog', label: 'CATÁLOGO', icon: Film, color: 'bg-[#007df7]' },
            { id: 'notifications', label: 'COMUNICADOS', icon: Bell, color: 'bg-purple-600' },
            { id: 'feedbacks', label: 'FEEDBACKS & ERROS', icon: Bug, color: 'bg-rose-600' },
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
                          {p.errorMessage && (
                            <span className="text-[10px] text-red-400 block max-w-xs truncate mt-1" title={p.errorMessage}>
                              {p.errorMessage}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-gray-300">
                          {p.latencyMs ? `${p.latencyMs}ms` : '—'}
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-400">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 text-xs font-mono">#</span>
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={p.priority}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val)) {
                                  handleUpdatePriority(p.id, val);
                                }
                              }}
                              className="w-12 px-1.5 py-0.5 rounded-lg bg-black/40 border border-white/10 text-white font-mono text-xs font-bold text-center focus:border-orange-500 outline-none"
                              title="Alterar prioridade de resolução do provedor"
                            />
                          </div>
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
        ) : activeTab === 'eligibility' ? (
          <div className="space-y-8">
            {/* Header info e Estatísticas */}
            <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-black flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-500" /> Diagnóstico Central de Elegibilidade e Fontes Reais
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Separação de lançamento e reprodução real. Títulos futuros ou sem fontes funcionais são excluídos antes da renderização.
                  </p>
                </div>
              </div>

              {/* Grid de Métricas */}
              {(() => {
                const stats = catalogEligibilityService.getStats();
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Total Avaliados</p>
                      <p className="text-2xl font-black text-white mt-1">{stats.totalEvaluated}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
                      <p className="text-[10px] font-black uppercase tracking-wider text-green-400">Aprovados</p>
                      <p className="text-2xl font-black text-green-400 mt-1">{stats.approvedCount}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
                      <p className="text-[10px] font-black uppercase tracking-wider text-red-400">Não Lançados</p>
                      <p className="text-2xl font-black text-red-400 mt-1">{stats.notReleasedCount}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                      <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">Em Cartaz (BR)</p>
                      <p className="text-2xl font-black text-amber-400 mt-1">{stats.inTheatersCount}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                      <p className="text-[10px] font-black uppercase tracking-wider text-rose-400">Sem Fontes</p>
                      <p className="text-2xl font-black text-rose-400 mt-1">{stats.unavailableSourceCount}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-center">
                      <p className="text-[10px] font-black uppercase tracking-wider text-purple-400">Erros Temp.</p>
                      <p className="text-2xl font-black text-purple-400 mt-1">{stats.temporaryErrorCount}</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Testador / Auditor em Tempo Real */}
            <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
              <h4 className="text-sm font-black uppercase tracking-wider text-indigo-400 mb-4 flex items-center gap-2">
                <Search className="w-4 h-4" /> Auditar Título ou IMDb ID em Tempo Real
              </h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Ex: VisionQuest, Tyson, Profundezas, O Intruso, tt0111161..."
                  value={auditQueryInput}
                  onChange={e => setAuditQueryInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (async () => {
                    if (!auditQueryInput.trim()) return;
                    setIsAuditingItem(true);
                    setAuditResultRecord(null);
                    try {
                      const existing = content.find(c => 
                        c.title.toLowerCase().includes(auditQueryInput.toLowerCase()) || 
                        c.id === auditQueryInput || 
                        c.imdbId === auditQueryInput
                      );
                      const targetItem: ContentItem = existing || {
                        id: auditQueryInput.startsWith('tt') ? auditQueryInput : `query-${Date.now()}`,
                        imdbId: auditQueryInput.startsWith('tt') ? auditQueryInput : undefined,
                        title: auditQueryInput.trim(),
                        type: ContentType.MOVIE,
                        rating: 7.0,
                        year: 2026,
                        image: '',
                        genres: []
                      };
                      const res = await catalogEligibilityService.evaluateItem(targetItem);
                      setAuditResultRecord(res);
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setIsAuditingItem(false);
                    }
                  })()}
                  className={`flex-1 p-3.5 rounded-2xl border outline-none font-bold text-sm ${
                    isDarkMode ? 'bg-white/5 border-gray-800 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'
                  }`}
                />
                <button
                  disabled={isAuditingItem || !auditQueryInput.trim()}
                  onClick={async () => {
                    if (!auditQueryInput.trim()) return;
                    setIsAuditingItem(true);
                    setAuditResultRecord(null);
                    try {
                      const existing = content.find(c => 
                        c.title.toLowerCase().includes(auditQueryInput.toLowerCase()) || 
                        c.id === auditQueryInput || 
                        c.imdbId === auditQueryInput
                      );
                      const targetItem: ContentItem = existing || {
                        id: auditQueryInput.startsWith('tt') ? auditQueryInput : `query-${Date.now()}`,
                        imdbId: auditQueryInput.startsWith('tt') ? auditQueryInput : undefined,
                        title: auditQueryInput.trim(),
                        type: ContentType.MOVIE,
                        rating: 7.0,
                        year: 2026,
                        image: '',
                        genres: []
                      };
                      const res = await catalogEligibilityService.evaluateItem(targetItem);
                      setAuditResultRecord(res);
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setIsAuditingItem(false);
                    }
                  }}
                  className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                >
                  {isAuditingItem ? <Activity className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                  {isAuditingItem ? 'AUDITANDO...' : 'AUDITAR AGORA'}
                </button>
              </div>

              {/* Resultado do Teste em Tempo Real */}
              {auditResultRecord && (
                <div className="mt-6 p-6 rounded-2xl bg-black/30 border border-white/10 space-y-4 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
                    <div>
                      <h5 className="text-base font-black text-white">{auditResultRecord.title}</h5>
                      <span className="text-xs text-gray-400 font-mono">ID: {auditResultRecord.canonicalId} • {auditResultRecord.mediaType.toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider ${
                        auditResultRecord.isPubliclyPlayable
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {auditResultRecord.isPubliclyPlayable ? '✓ ELEGÍVEL / REPRODUZÍVEL' : '✕ INELIGÍVEL (OCULTADO)'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                      <p className="text-gray-400 font-bold mb-1">Status Lançamento</p>
                      <p className="font-mono font-black text-white">{auditResultRecord.releaseStatus}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                      <p className="text-gray-400 font-bold mb-1">Status Reprodução</p>
                      <p className="font-mono font-black text-white">{auditResultRecord.playbackStatus}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                      <p className="text-gray-400 font-bold mb-1">Fontes Válidas</p>
                      <p className="font-mono font-black text-white">{auditResultRecord.validSourceCount} / {auditResultRecord.candidateSourceCount}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                      <p className="text-gray-400 font-bold mb-1">Melhor Qualidade</p>
                      <p className="font-mono font-black text-white">{auditResultRecord.bestQuality || 'N/A'}</p>
                    </div>
                  </div>

                  {auditResultRecord.rejectionReasons.length > 0 && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
                      <p className="font-bold mb-1">Motivos da Inelegibilidade:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {auditResultRecord.rejectionReasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tabela de Títulos Auditados */}
            <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h4 className="text-sm font-black uppercase tracking-wider text-white">
                  Títulos Avaliados no Índice ({eligibilityRecords.length})
                </h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Filtrar por título..."
                    value={eligibilitySearch}
                    onChange={e => setEligibilitySearch(e.target.value)}
                    className="p-2.5 px-4 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white outline-none"
                  />
                  <select
                    value={eligibilityFilter}
                    onChange={e => setEligibilityFilter(e.target.value as any)}
                    className="p-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white outline-none"
                  >
                    <option value="all" className="bg-[#151C26]">Todos</option>
                    <option value="approved" className="bg-[#151C26]">Apenas Aprovados</option>
                    <option value="rejected" className="bg-[#151C26]">Apenas Rejeitados</option>
                    <option value="not_released" className="bg-[#151C26]">Não Lançados</option>
                    <option value="in_theaters" className="bg-[#151C26]">Em Cartaz</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] uppercase font-black text-gray-400 tracking-wider">
                      <th className="py-3 px-4">Título</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Lançamento</th>
                      <th className="py-3 px-4">Reprodução</th>
                      <th className="py-3 px-4 text-center">Fontes</th>
                      <th className="py-3 px-4 text-center">Decisão</th>
                      <th className="py-3 px-4">Motivo / Revalidação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {eligibilityRecords
                      .filter(r => {
                        if (eligibilitySearch.trim()) {
                          const q = eligibilitySearch.toLowerCase();
                          if (!r.title.toLowerCase().includes(q) && !r.canonicalId.toLowerCase().includes(q)) return false;
                        }
                        if (eligibilityFilter === 'approved') return r.isPubliclyPlayable;
                        if (eligibilityFilter === 'rejected') return !r.isPubliclyPlayable;
                        if (eligibilityFilter === 'not_released') return r.releaseStatus === 'NOT_RELEASED';
                        if (eligibilityFilter === 'in_theaters') return r.releaseStatus === 'IN_THEATERS';
                        return true;
                      })
                      .slice(0, 100)
                      .map((rec) => (
                        <tr key={rec.canonicalId} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-bold text-white">
                            <div>{rec.title}</div>
                            <span className="text-[10px] font-mono text-gray-500">{rec.canonicalId}</span>
                          </td>
                          <td className="py-3 px-4 uppercase text-[10px] font-black text-gray-400">{rec.mediaType}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rec.releaseStatus === 'RELEASED'
                                ? 'bg-green-500/20 text-green-400'
                                : rec.releaseStatus === 'IN_THEATERS'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {rec.releaseStatus}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rec.playbackStatus === 'AVAILABLE'
                                ? 'bg-green-500/20 text-green-400'
                                : rec.playbackStatus === 'TEMPORARY_ERROR'
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}>
                              {rec.playbackStatus}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold">
                            {rec.validSourceCount} / {rec.candidateSourceCount}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              rec.isPubliclyPlayable
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              {rec.isPubliclyPlayable ? 'APROVADO' : 'OCULTADO'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-400 text-[11px] max-w-xs truncate">
                            {rec.rejectionReasons.length > 0 ? rec.rejectionReasons.join('; ') : 'Fonte válida autorizada'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
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
        ) : activeTab === 'rankings' ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header com Diagnóstico e Métricas */}
            <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Flame className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white">
                        Diagnóstico de Rankings Em Destaque (IMDb Semanal)
                      </h3>
                      <p className="text-xs text-gray-400">
                        Classificação semanal automática do IMDb (MOVIEmeter e TVmeter) cruzada com disponibilidade real do ZapiTV.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleVerifyCorrespondence}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer"
                    title="Auditar correspondência dos 10 filmes e 10 séries com o snapshot oficial do IMDb"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Verificar correspondência
                  </button>
                  <button
                    onClick={() => setShowImportSnapshotModal(true)}
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 border border-white/10 cursor-pointer"
                    title="Importar snapshot autorizado do IMDb em JSON"
                  >
                    <Upload className="w-4 h-4" />
                    Importar Snapshot
                  </button>
                  <button
                    onClick={handleRefreshFeatured}
                    disabled={isUpdatingFeatured}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isUpdatingFeatured ? 'animate-spin' : ''}`} />
                    {isUpdatingFeatured ? 'Atualizando...' : 'Atualizar agora'}
                  </button>
                </div>
              </div>

              {/* Banner de Erro/Fallback (se houver tentativa com falha) */}
              {featuredData.lastErrorReason && (
                <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><strong>Aviso de Atualização:</strong> {featuredData.lastErrorReason}. A seleção anterior validada foi mantida atomicamente sem descontinuidade no catálogo.</span>
                  </div>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Fallback Seguro Ativo
                  </span>
                </div>
              )}

              {/* Cards de Métricas Principais da Semana */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                <div className="p-4 rounded-2xl bg-black/20 border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">Ranking da Semana</p>
                  <p className="text-base font-black text-white">{featuredData.weekLabel || 'Semana Recente'}</p>
                  <span className="text-[10px] font-mono text-amber-400 mt-1 block">
                    Ref: {featuredData.referenceDate || 'IMDb Atual'} • MOVIEmeter & TVmeter
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-400 mb-1">Última Versão Válida</p>
                  <p className="text-2xl font-black text-blue-400">
                    {featuredData.featuredMovies.length} Filmes <span className="text-sm font-normal text-gray-300">• {featuredData.featuredSeries.length} Séries</span>
                  </p>
                  <span className="text-[10px] text-gray-400">
                    Total: {featuredData.totalCandidatesEvaluated.movies + featuredData.totalCandidatesEvaluated.series} candidatos examinados
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                  <p className="text-[10px] font-black uppercase tracking-wider text-purple-400 mb-1">Próxima Atualização Prevista</p>
                  <p className="text-xs font-black text-purple-300 leading-snug">
                    {featuredData.nextScheduledUpdateFormatted || 'Segunda-feira às 06:00 (BRT)'}
                  </p>
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    Vercel Cron: 0 9 * * 1 (UTC-3)
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-black/20 border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">Data da Última Atualização</p>
                  <p className="text-sm font-bold text-gray-200">
                    {new Date(featuredData.lastUpdatedAt).toLocaleDateString('pt-BR')} às {new Date(featuredData.lastUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <span className="text-[10px] text-emerald-400 font-mono mt-1 block">
                    ✓ {featuredData.updateStatus === 'SUCCESS' ? 'Publicação Atômica Concluída' : featuredData.updateStatus === 'UP_TO_DATE' ? 'Sincronizado (Sem novos dados)' : 'Cache Persistente em Disco'}
                  </span>
                </div>
              </div>
            </div>

            {/* TABELAS DE APROVADOS (TOP 10 FILMES & TOP 10 SÉRIES) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* TOP 10 FILMES APROVADOS */}
              <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Film className="w-5 h-5 text-[#007df7]" />
                    <h4 className="font-black text-base text-white">Top 10 Filmes Elegíveis</h4>
                  </div>
                  <span className="text-xs font-bold text-[#007df7] bg-[#007df7]/10 px-2 py-0.5 rounded-lg border border-[#007df7]/20">
                    {featuredData.featuredMovies.length} de 10
                  </span>
                </div>
                <div className="space-y-2">
                  {featuredData.auditTrail.approvedMovies.map((item) => (
                    <div key={`app-m-${item.imdbId}`} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                          #{item.finalPosition}
                        </span>
                        <div className="truncate">
                          <p className="font-bold text-xs text-white truncate">{item.title}</p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            IMDb #{item.rankPosition} • {item.imdbId} • {item.year || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.hasAudioPtBr ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-600/20 text-blue-400 rounded">
                            PT-BR
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white/10 text-gray-300 rounded">
                            Original
                          </span>
                        )}
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Elegível
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TOP 10 SÉRIES APROVADAS */}
              <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Tv className="w-5 h-5 text-purple-400" />
                    <h4 className="font-black text-base text-white">Top 10 Séries Elegíveis</h4>
                  </div>
                  <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">
                    {featuredData.featuredSeries.length} de 10
                  </span>
                </div>
                <div className="space-y-2">
                  {featuredData.auditTrail.approvedSeries.map((item) => (
                    <div key={`app-s-${item.imdbId}`} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                          #{item.finalPosition}
                        </span>
                        <div className="truncate">
                          <p className="font-bold text-xs text-white truncate">{item.title}</p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            IMDb #{item.rankPosition} • {item.imdbId} • {item.year || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.hasAudioPtBr ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-600/20 text-blue-400 rounded">
                            PT-BR
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white/10 text-gray-300 rounded">
                            Original
                          </span>
                        )}
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Elegível
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* PAINEL DE AUDITORIA INTERNO DE CANDIDATOS (SEÇÃO 16) */}
            <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h4 className="text-lg font-black text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    Painel de Auditoria de Candidatos & Elegibilidade (IMDb)
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Rastreamento completo de todos os candidatos do MOVIEmeter e TVmeter avaliados na ordem estrita de popularidade.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Filtro de Categoria */}
                  <div className="flex rounded-xl bg-white/5 p-1 border border-white/10">
                    <button
                      onClick={() => setFeaturedAuditCategory('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${featuredAuditCategory === 'all' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setFeaturedAuditCategory('movies')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${featuredAuditCategory === 'movies' ? 'bg-[#007df7] text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      Filmes
                    </button>
                    <button
                      onClick={() => setFeaturedAuditCategory('series')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${featuredAuditCategory === 'series' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      Séries
                    </button>
                  </div>

                  {/* Filtro de Status de Elegibilidade */}
                  <div className="flex rounded-xl bg-white/5 p-1 border border-white/10">
                    <button
                      onClick={() => setFeaturedAuditStatus('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${featuredAuditStatus === 'all' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setFeaturedAuditStatus('approved')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${featuredAuditStatus === 'approved' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                      Apenas Aprovados
                    </button>
                    <button
                      onClick={() => setFeaturedAuditStatus('rejected')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${featuredAuditStatus === 'rejected' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      Apenas Descartados
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Filtrar por título, ID ou motivo..."
                    value={featuredSearchTerm}
                    onChange={(e) => setFeaturedSearchTerm(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 outline-none w-56"
                  />
                </div>
              </div>

              {/* Tabela Unificada de 10 Colunas */}
              {(() => {
                const allItems: FeaturedAuditItem[] = [
                  ...featuredData.auditTrail.approvedMovies,
                  ...featuredData.auditTrail.approvedSeries,
                  ...featuredData.auditTrail.rejectedMovies,
                  ...featuredData.auditTrail.rejectedSeries
                ];

                // Ordenar por tipo e rank do IMDb
                allItems.sort((a, b) => {
                  if (a.mediaType !== b.mediaType) {
                    return a.mediaType === 'movie' ? -1 : 1;
                  }
                  return (a.imdbRank || a.rankPosition) - (b.imdbRank || b.rankPosition);
                });

                const filtered = allItems.filter(item => {
                  const matchesCat = featuredAuditCategory === 'all' || 
                    (featuredAuditCategory === 'movies' && item.mediaType === 'movie') ||
                    (featuredAuditCategory === 'series' && item.mediaType === 'series');
                  
                  const matchesStatus = featuredAuditStatus === 'all' ||
                    (featuredAuditStatus === 'approved' && item.status === 'APPROVED') ||
                    (featuredAuditStatus === 'rejected' && item.status === 'REJECTED');

                  const term = featuredSearchTerm.toLowerCase().trim();
                  const matchesSearch = !term ||
                    item.title.toLowerCase().includes(term) ||
                    (item.imdbTitle || '').toLowerCase().includes(term) ||
                    (item.canonicalTitle || '').toLowerCase().includes(term) ||
                    item.imdbId.toLowerCase().includes(term) ||
                    (item.canonicalId || '').toLowerCase().includes(term) ||
                    (item.rejectionReason || '').toLowerCase().includes(term);

                  return matchesCat && matchesStatus && matchesSearch;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center text-gray-500 text-xs">
                      Nenhum candidato encontrado com os filtros selecionados.
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-white/10 text-[9px] uppercase font-black text-gray-400 tracking-wider bg-white/[0.02]">
                          <th className="py-3 px-3">1. IMDb #</th>
                          <th className="py-3 px-3">2. Título IMDb</th>
                          <th className="py-3 px-3">3. IMDb ID</th>
                          <th className="py-3 px-3">4. Título ZapiTV</th>
                          <th className="py-3 px-3">5. ID Canônico</th>
                          <th className="py-3 px-3">6. Disponibilidade</th>
                          <th className="py-3 px-3">7. Elegibilidade</th>
                          <th className="py-3 px-3">8. Seleção</th>
                          <th className="py-3 px-3">9. Motivo do Descarte</th>
                          <th className="py-3 px-3 text-center">10. Pos. Final</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-sans">
                        {filtered.map((item, i) => {
                          const isApproved = item.status === 'APPROVED';
                          const originalRank = item.imdbRank || item.rankPosition;
                          const finalPos = item.displayRank || item.finalPosition;

                          return (
                            <tr key={`audit-row-${item.imdbId}-${i}`} className={`hover:bg-white/[0.03] transition-colors ${isApproved ? 'bg-emerald-500/[0.02]' : ''}`}>
                              {/* 1. Posição original IMDb */}
                              <td className="py-3 px-3 font-mono font-bold text-amber-400">
                                #{originalRank}
                              </td>

                              {/* 2. Título IMDb */}
                              <td className="py-3 px-3 font-semibold text-white max-w-[200px] truncate" title={item.imdbTitle || item.title}>
                                {item.imdbTitle || item.title} {item.year ? `(${item.year})` : ''}
                              </td>

                              {/* 3. IMDb ID */}
                              <td className="py-3 px-3 font-mono text-[10px] text-gray-400">
                                <a
                                  href={`https://www.imdb.com/title/${item.imdbId}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline hover:text-amber-400"
                                >
                                  {item.imdbId}
                                </a>
                              </td>

                              {/* 4. Título ZapiTV */}
                              <td className="py-3 px-3 font-medium text-gray-200 max-w-[180px] truncate" title={item.canonicalTitle || item.title}>
                                {item.canonicalTitle || item.title}
                              </td>

                              {/* 5. ID Canônico */}
                              <td className="py-3 px-3 font-mono text-[10px] text-gray-500">
                                {item.canonicalId || '—'}
                              </td>

                              {/* 6. Status de Disponibilidade */}
                              <td className="py-3 px-3">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                                  isApproved 
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                    : 'bg-white/5 text-gray-400'
                                }`}>
                                  {item.availabilityStatus || (isApproved ? 'Disponível' : 'Indisponível')}
                                </span>
                              </td>

                              {/* 7. Resultado da Elegibilidade */}
                              <td className="py-3 px-3">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                                  isApproved 
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                                }`}>
                                  {isApproved ? 'Aprovado' : 'Rejeitado'}
                                </span>
                              </td>

                              {/* 8. Incluído ou Descartado */}
                              <td className="py-3 px-3">
                                {item.isIncluded ? (
                                  <span className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-500 text-black">
                                    INCLUÍDO
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black px-2 py-0.5 rounded bg-white/10 text-gray-400">
                                    DESCARTADO
                                  </span>
                                )}
                              </td>

                              {/* 9. Motivo do Descarte */}
                              <td className="py-3 px-3 max-w-[280px] truncate text-amber-300/80 text-[11px]" title={item.rejectionReason || 'Atende a todos os critérios de reprodução e elegibilidade'}>
                                {item.rejectionReason || '—'}
                              </td>

                              {/* 10. Posição final na seleção (#1 a #10 ou '-') */}
                              <td className="py-3 px-3 text-center">
                                {finalPos ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 font-black text-xs font-mono">
                                    #{finalPos}
                                  </span>
                                ) : (
                                  <span className="text-gray-600 font-mono">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : activeTab === 'skip_intervals' ? (
          <div className="space-y-8">
            {/* Header info */}
            <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-black flex items-center gap-2">
                    <FastForward className="w-5 h-5 text-cyan-400" /> Intervalos de Skip: Pular Abertura, Recapitulação e Créditos
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Cadastre tempos precisos de abertura e créditos para séries e animes. Sobrescreve APIs externas e funciona instantaneamente no player.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleLoadVerifiedDexter}
                    className="px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                    title="Importa os intervalos oficiais verificados de Dexter (Season 1)"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Carregar Padrões de Dexter S1
                  </button>
                  <span className="px-3 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full text-xs font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> {adminSkipList.length} Intervalos Cadastrados
                  </span>
                </div>
              </div>

              {/* Feedback Toasts */}
              {skipSuccessToast && (
                <div className="mb-6 p-4 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-300">
                  <CheckCircle className="w-4 h-4 shrink-0 text-green-400" />
                  <span>{skipSuccessToast}</span>
                </div>
              )}

              {skipFormError && (
                <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{skipFormError}</span>
                </div>
              )}

              {/* Grid: Formulário + Guia */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Cadastro */}
                <form onSubmit={handleSaveSkipInterval} className="lg:col-span-2 p-6 rounded-2xl bg-black/20 border border-white/5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-cyan-400" />
                      {skipEditingId ? 'Editar Intervalo de Skip' : 'Cadastrar Novo Intervalo'}
                    </h4>
                    {skipEditingId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSkipEditingId(null);
                          setSkipStartInput('');
                          setSkipEndInput('');
                          setSkipFormError('');
                        }}
                        className="text-[10px] font-bold text-gray-400 hover:text-white"
                      >
                        Cancelar Edição
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Selecionar Série do Catálogo */}
                    <div>
                      <label className="block text-[10px] uppercase font-black text-gray-400 mb-1.5">Série do Catálogo</label>
                      <select
                        value={skipSelectedMediaId}
                        onChange={(e) => {
                          setSkipSelectedMediaId(e.target.value);
                          const sel = availableSeriesList.find(m => m.id === e.target.value);
                          if (sel) {
                            setSkipCustomTitleInput(sel.title);
                          }
                        }}
                        className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold outline-none focus:border-cyan-500"
                      >
                        <option value="">-- Selecione do Catálogo ou digite abaixo --</option>
                        {availableSeriesList.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.title} ({s.year || s.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Ou Nome Customizado / ID Externo */}
                    <div>
                      <label className="block text-[10px] uppercase font-black text-gray-400 mb-1.5">Nome da Série / ID Externo</label>
                      <input
                        type="text"
                        placeholder="Ex: Dexter ou 1405 ou tt0773262"
                        value={skipCustomTitleInput}
                        onChange={(e) => setSkipCustomTitleInput(e.target.value)}
                        className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Temporada e Episódio */}
                    <div>
                      <label className="block text-[10px] uppercase font-black text-gray-400 mb-1.5">Temporada (Season)</label>
                      <input
                        type="number"
                        min="1"
                        value={skipSeasonInput}
                        onChange={(e) => setSkipSeasonInput(e.target.value)}
                        className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold outline-none focus:border-cyan-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black text-gray-400 mb-1.5">Episódio (Episode)</label>
                      <input
                        type="number"
                        min="1"
                        value={skipEpisodeInput}
                        onChange={(e) => setSkipEpisodeInput(e.target.value)}
                        className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold outline-none focus:border-cyan-500"
                        required
                      />
                    </div>

                    {/* Tipo de Intervalo */}
                    <div>
                      <label className="block text-[10px] uppercase font-black text-gray-400 mb-1.5">Tipo de Pulo (Intervalo)</label>
                      <select
                        value={skipTypeInput}
                        onChange={(e) => setSkipTypeInput(e.target.value as SkipType)}
                        className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold outline-none focus:border-cyan-500"
                      >
                        <option value="op">Abertura (Pular Abertura)</option>
                        <option value="recap">Recapitulação (Pular Recapitulação)</option>
                        <option value="ed">Créditos Finais (Pular Créditos)</option>
                      </select>
                    </div>

                    {/* Início e Término */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] uppercase font-black text-gray-400 mb-1.5">Início (mm:ss ou seg)</label>
                        <input
                          type="text"
                          placeholder="Ex: 07:30 ou 450"
                          value={skipStartInput}
                          onChange={(e) => setSkipStartInput(e.target.value)}
                          className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold outline-none focus:border-cyan-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-black text-gray-400 mb-1.5">Término (mm:ss ou seg)</label>
                        <input
                          type="text"
                          placeholder="Ex: 09:15 ou 555"
                          value={skipEndInput}
                          onChange={(e) => setSkipEndInput(e.target.value)}
                          className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold outline-none focus:border-cyan-500"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-cyan-600/30 flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {skipEditingId ? 'Atualizar Intervalo' : 'Salvar Intervalo'}
                    </button>
                  </div>
                </form>

                {/* Card Informativo / Guia */}
                <div className="p-6 rounded-2xl bg-black/20 border border-white/5 space-y-4 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-cyan-400 mb-2 flex items-center gap-2">
                      <Info className="w-4 h-4" /> Guia de Calibração
                    </h4>
                    <ul className="text-[11px] text-gray-300 space-y-2 list-disc list-inside">
                      <li>
                        <strong>Formatos aceitos:</strong> <span className="font-mono text-cyan-300">07:30</span> ou <span className="font-mono text-cyan-300">450</span> segundos.
                      </li>
                      <li>
                        <strong>Exemplo Dexter S01E01:</strong> O cold open vai até 07:30; a abertura toca de <span className="font-mono text-cyan-300">07:30</span> a <span className="font-mono text-cyan-300">09:15</span> (450s a 555s) e os créditos de <span className="font-mono text-cyan-300">51:28</span> a <span className="font-mono text-cyan-300">53:10</span>.
                      </li>
                      <li>
                        <strong>Prioridade Máxima:</strong> Intervalos cadastrados no painel têm precedência absoluta sobre APIs de anime e IntroDB.
                      </li>
                      <li>
                        <strong>Dinâmico:</strong> O botão aparece automaticamente no player e reaparece instantaneamente em retrocessos ou avanços na barra.
                      </li>
                    </ul>
                  </div>

                  <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-300">
                    💡 Pular apenas altera o tempo do vídeo (sem reiniciar o player, trocar fontes ou repetir a intro).
                  </div>
                </div>
              </div>

              {/* Filtros e Tabela de Intervalos */}
              <div className="mt-8 space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Filtrar por série, temporada ou episódio (ex: Dexter, S1E1)..."
                      value={skipSearchTerm}
                      onChange={(e) => setSkipSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs outline-none focus:border-cyan-500 font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={skipTypeFilter}
                      onChange={(e) => setSkipTypeFilter(e.target.value as any)}
                      className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold outline-none focus:border-cyan-500"
                    >
                      <option value="all">TODOS OS TIPOS</option>
                      <option value="op">Aberturas (op)</option>
                      <option value="recap">Recapitulações (recap)</option>
                      <option value="ed">Créditos (ed)</option>
                    </select>
                  </div>
                </div>

                {/* Tabela de Intervalos */}
                <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/20">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[9px] uppercase font-black tracking-widest text-gray-400 bg-white/5">
                        <th className="px-6 py-3.5">Obra / Série</th>
                        <th className="px-6 py-3.5 text-center">Episódio</th>
                        <th className="px-6 py-3.5">Tipo</th>
                        <th className="px-6 py-3.5">Início</th>
                        <th className="px-6 py-3.5">Término</th>
                        <th className="px-6 py-3.5 text-center">Duração</th>
                        <th className="px-6 py-3.5 text-center">Origem</th>
                        <th className="px-6 py-3.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredSkipList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-8 text-center text-gray-400 text-xs">
                            Nenhum intervalo cadastrado. Clique em "Carregar Padrões de Dexter S1" ou utilize o formulário acima para cadastrar.
                          </td>
                        </tr>
                      ) : (
                        filteredSkipList.map((entry) => {
                          const durationSec = Math.max(0, entry.endTime - entry.startTime);
                          return (
                            <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4 font-bold text-white">
                                <div className="flex flex-col">
                                  <span>{entry.contentTitle || entry.contentId}</span>
                                  <span className="text-[10px] text-gray-500 font-mono">{entry.contentId}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center font-mono font-bold text-cyan-300">
                                S{entry.season}E{entry.episode}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                  entry.type === 'op'
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : entry.type === 'recap'
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                }`}>
                                  {entry.label || skipService.getLabelForType(entry.type)}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-mono text-gray-200">
                                {formatSecondsToTime(entry.startTime)} <span className="text-gray-500 text-[10px]">({entry.startTime}s)</span>
                              </td>
                              <td className="px-6 py-4 font-mono text-gray-200">
                                {formatSecondsToTime(entry.endTime)} <span className="text-gray-500 text-[10px]">({entry.endTime}s)</span>
                              </td>
                              <td className="px-6 py-4 text-center font-mono text-cyan-400 font-bold">
                                {durationSec}s
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="px-2 py-0.5 rounded text-[8px] font-black bg-white/10 text-gray-300 uppercase">
                                  {entry.source}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleEditSkipInterval(entry)}
                                    className="p-1.5 rounded-lg bg-cyan-600/10 text-cyan-400 hover:bg-cyan-600 hover:text-white transition-all"
                                    title="Editar intervalo"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSkipInterval(entry.id)}
                                    className="p-1.5 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600 hover:text-white transition-all"
                                    title="Remover intervalo"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'users' ? (
          <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-[#151C26]/40 border-gray-800' : 'bg-white shadow-xl'}`}>
            {accountsLoading && <p role="status" className="px-8 py-3 text-xs opacity-60">Carregando contas atuais...</p>}
            {accountsError && <p role="alert" className="px-8 py-3 text-xs text-amber-400">{accountsError}</p>}
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
                      {user.readOnlyAccount ? <span className="text-xs opacity-50">Não informado</span> : <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                        user.status === 'Ativo' ? 'bg-green-500/10 text-green-500' : 
                        user.status === 'Atrasado' ? 'bg-[#007df7]/10 text-[#007df7]' : 'bg-[#007df7]/10 text-[#007df7]'
                      }`}>
                        {user.status === 'Ativo' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {user.status === 'Ativo' ? 'PAGO' : user.status === 'Atrasado' ? 'ATRASADO' : 'PENDENTE'}
                      </div>}
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button disabled={user.readOnlyAccount} title={user.readOnlyAccount ? 'Conta do sistema atual: a edição legada não se aplica a este cadastro.' : 'Editar'} onClick={() => setEditingUser(user)} className="p-2 rounded-xl bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30"><Edit3 className="w-4 h-4" /></button>
                        <button disabled={user.readOnlyAccount} title={user.readOnlyAccount ? 'Conta do sistema atual: a exclusão legada não se aplica a este cadastro.' : 'Excluir'} onClick={() => onDeleteUser(user.id)} className="p-2 rounded-xl bg-[#007df7]/10 text-[#007df7] hover:bg-[#007df7] hover:text-white transition-all disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
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
        ) : activeTab === 'feedbacks' ? (
          <FeedbackAdminPanel isDarkMode={isDarkMode} />
        ) : activeTab === 'livetv' ? (
          <LiveTvAdminPanel isDarkMode={isDarkMode} />
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

      {/* MODAL: VERIFICAR CORRESPONDÊNCIA OFICIAL IMDb */}
      {showCorrespondenceModal && correspondenceResult && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-4xl max-h-[90vh] bg-[#0f141c] border border-white/10 rounded-[32px] p-6 md:p-8 shadow-2xl relative flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between pb-5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${correspondenceResult.isCompliant ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                  {correspondenceResult.isCompliant ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Auditoria de Correspondência Oficial (IMDb)</h3>
                  <p className="text-xs text-gray-400">
                    Semana: {correspondenceResult.weekKey} • Data de Referência: {correspondenceResult.referenceDate}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowCorrespondenceModal(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Resultado Principal (100% de correspondência ou Divergência) */}
            <div className="py-4 shrink-0">
              {correspondenceResult.isCompliant ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="font-black text-base text-white">100% de correspondência</h4>
                    <p className="text-xs text-emerald-300/90 mt-0.5">
                      Todos os {correspondenceResult.totalMoviesChecked} filmes e {correspondenceResult.totalSeriesChecked} séries publicados pertencem ao ranking oficial do IMDb da semana e respeitam a ordem estrita de popularidade.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 space-y-2">
                  <div className="flex items-center gap-2 font-black text-sm text-red-200">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                    <span>Divergência detectada com o snapshot oficial do IMDb:</span>
                  </div>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    {correspondenceResult.movieMismatches.map((m, idx) => (
                      <li key={`mm-${idx}`}>Filme "{m.title}": {m.reason}</li>
                    ))}
                    {correspondenceResult.seriesMismatches.map((s, idx) => (
                      <li key={`ms-${idx}`}>Série "{s.title}": {s.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Listas Comparativas */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Filmes Verificados */}
                <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-blue-400 flex items-center gap-2">
                    <Film className="w-4 h-4" /> 10 Filmes Publicados ({correspondenceResult.verifiedMovies.length}/10)
                  </h5>
                  <div className="space-y-1.5 font-mono text-xs">
                    {correspondenceResult.verifiedMovies.map((vm) => (
                      <div key={vm.imdbId} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
                        <div className="truncate">
                          <span className="font-bold text-amber-400">#{vm.displayRank}</span>
                          <span className="text-gray-400 text-[10px] ml-1.5">(IMDb #{vm.imdbRank})</span>
                          <span className="text-white ml-2">{vm.title}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">{vm.imdbId}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Séries Verificadas */}
                <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-purple-400 flex items-center gap-2">
                    <Tv className="w-4 h-4" /> 10 Séries Publicadas ({correspondenceResult.verifiedSeries.length}/10)
                  </h5>
                  <div className="space-y-1.5 font-mono text-xs">
                    {correspondenceResult.verifiedSeries.map((vs) => (
                      <div key={vs.imdbId} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
                        <div className="truncate">
                          <span className="font-bold text-amber-400">#{vs.displayRank}</span>
                          <span className="text-gray-400 text-[10px] ml-1.5">(IMDb #{vs.imdbRank})</span>
                          <span className="text-white ml-2">{vs.title}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">{vs.imdbId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-white/10 flex justify-end shrink-0">
              <button
                onClick={() => setShowCorrespondenceModal(false)}
                className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: IMPORTAR SNAPSHOT AUTORIZADO DO IMDb */}
      {showImportSnapshotModal && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-[#0f141c] border border-white/10 rounded-[32px] p-6 md:p-8 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between pb-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Importar Snapshot Oficial do IMDb</h3>
                  <p className="text-xs text-gray-400">Cole a estrutura JSON do snapshot oficial (MOVIEmeter ou TVmeter).</p>
                </div>
              </div>
              <button 
                onClick={() => setShowImportSnapshotModal(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <p className="text-xs text-gray-400">
                Formato aceito: Objeto JSON contendo <code className="bg-black/50 px-1 py-0.5 rounded text-amber-400">weekKey</code>, <code className="bg-black/50 px-1 py-0.5 rounded text-amber-400">rankType</code> ("movie" ou "series") e <code className="bg-black/50 px-1 py-0.5 rounded text-amber-400">items</code> (array com <code className="text-white">position</code>, <code className="text-white">imdbId</code> e <code className="text-white">title</code>).
              </p>

              <textarea
                rows={10}
                value={importSnapshotJson}
                onChange={(e) => setImportSnapshotJson(e.target.value)}
                placeholder={'{\n  "weekKey": "2026-W42",\n  "rankType": "movie",\n  "referenceDate": "2026-10-19",\n  "items": [\n    { "position": 1, "imdbId": "tt29971038", "title": "Sobrevivência" }\n  ]\n}'}
                className="w-full p-4 rounded-2xl border border-white/10 bg-black/40 text-white outline-none focus:border-amber-400/50 font-mono text-xs resize-none"
              />

              {importSnapshotError && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-medium">
                  {importSnapshotError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowImportSnapshotModal(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportSnapshotSubmit}
                  disabled={!importSnapshotJson.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  Validar e Salvar Snapshot
                </button>
              </div>
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

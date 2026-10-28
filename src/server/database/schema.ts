import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Server-only tables. Browser data (history, progress, favorites) stays private and local.
export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['FILME', 'SÉRIE', 'ANIME'] }).notNull(),
  title: text('title').notNull(),
  originalTitle: text('original_title'),
  year: integer('year'),
  description: text('description'),
  posterUrl: text('poster_url'),
  backdropUrl: text('backdrop_url'),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('media_type_title_idx').on(table.type, table.title),
  index('media_type_year_idx').on(table.type, table.year),
]);

export const mediaExternalIds = sqliteTable('media_external_ids', {
  mediaId: text('media_id').notNull().references(() => media.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['imdb', 'tmdb', 'anilist', 'mal'] }).notNull(),
  externalId: text('external_id').notNull(),
}, (table) => [
  primaryKey({ columns: [table.mediaId, table.provider] }),
  uniqueIndex('media_external_provider_id_idx').on(table.provider, table.externalId),
]);

export const episodes = sqliteTable('episodes', {
  id: text('id').primaryKey(),
  mediaId: text('media_id').notNull().references(() => media.id, { onDelete: 'cascade' }),
  seasonNumber: integer('season_number').notNull(),
  episodeNumber: integer('episode_number').notNull(),
  title: text('title'),
  airDate: text('air_date'),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  uniqueIndex('episodes_media_season_number_idx').on(table.mediaId, table.seasonNumber, table.episodeNumber),
]);

export const globalSettings = sqliteTable('global_settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: integer('updated_at').notNull(),
  updatedBy: text('updated_by').notNull(),
});

export const adminAudit = sqliteTable('admin_audit', {
  id: text('id').primaryKey(),
  settingKey: text('setting_key').notNull(),
  previousVersion: integer('previous_version').notNull(),
  nextVersion: integer('next_version').notNull(),
  actorUid: text('actor_uid').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [index('admin_audit_setting_time_idx').on(table.settingKey, table.createdAt)]);

// Aggregated playback evidence. sourceRef is a stable provider descriptor, never a media URL.
export const sourceReliability = sqliteTable('source_reliability', {
  canonicalId: text('canonical_id').notNull(),
  mediaType: text('media_type').notNull(),
  season: integer('season').notNull().default(0),
  episode: integer('episode').notNull().default(0),
  providerId: text('provider_id').notNull(),
  sourceRef: text('source_ref').notNull(),
  format: text('format').notNull(),
  audioLanguage: text('audio_language'),
  quality: text('quality'),
  successes: integer('successes').notNull().default(0),
  startupFailures: integer('startup_failures').notNull().default(0),
  playbackFailures: integer('playback_failures').notNull().default(0),
  lastSuccessAt: integer('last_success_at'),
  lastFailureAt: integer('last_failure_at'),
  averageStartupMs: integer('average_startup_ms'),
  status: text('status').notNull().default('provisional'),
  expiresAt: integer('expires_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.canonicalId, table.mediaType, table.season, table.episode, table.providerId, table.sourceRef] }),
  index('source_reliability_lookup_idx').on(table.canonicalId, table.mediaType, table.season, table.episode, table.expiresAt),
]);

// Short-lived, single-use evidence tickets. No account, IP, URL or watch history is stored.
export const sourceEvidenceTickets = sqliteTable('source_evidence_tickets', {
  id: text('id').primaryKey(),
  canonicalId: text('canonical_id').notNull(),
  mediaType: text('media_type').notNull(),
  season: integer('season').notNull(),
  episode: integer('episode').notNull(),
  providerId: text('provider_id').notNull(),
  sourceRef: text('source_ref').notNull(),
  format: text('format').notNull(),
  issuedAt: integer('issued_at').notNull(),
  outcome: text('outcome'),
}, (table) => [index('source_evidence_tickets_issued_idx').on(table.issuedAt)]);

export const watchpartyRooms = sqliteTable('watchparty_rooms', {
  roomId: text('room_id').primaryKey(),
  hostPeerId: text('host_peer_id').notNull(),
  hostNickname: text('host_nickname').notNull(),
  mediaJson: text('media_json'),
  transmissionMode: text('transmission_mode').notNull().default('host_broadcast'),
  lifecycleState: text('lifecycle_state').notNull().default('LOBBY'),
  introStartTimestamp: integer('intro_start_timestamp'),
  introDuration: integer('intro_duration'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  isClosed: integer('is_closed').notNull().default(0),
  participantsJson: text('participants_json').notNull().default('[]'),
}, (table) => [
  index('watchparty_rooms_updated_idx').on(table.updatedAt),
]);

export const watchpartySignals = sqliteTable('watchparty_signals', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull(),
  senderPeerId: text('sender_peer_id').notNull(),
  targetPeerId: text('target_peer_id'),
  type: text('type').notNull(),
  dataJson: text('data_json'),
  timestamp: integer('timestamp').notNull(),
}, (table) => [
  index('watchparty_signals_room_time_idx').on(table.roomId, table.timestamp),
]);

// ============================================================================
// AUTENTICAÇÃO REAL E GESTÃO DE CONTAS (P3.A)
// ============================================================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  status: text('status', { enum: ['active', 'suspended', 'pending_verification'] }).notNull().default('active'),
  termsAcceptedAt: integer('terms_accepted_at').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  uniqueIndex('users_email_idx').on(table.email),
  index('users_created_at_idx').on(table.createdAt),
]);

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  expiresAt: integer('expires_at').notNull(),
  revokedAt: integer('revoked_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  uniqueIndex('sessions_token_hash_idx').on(table.tokenHash),
  index('sessions_user_id_idx').on(table.userId),
  index('sessions_expires_at_idx').on(table.expiresAt),
]);

export const loginAttempts = sqliteTable('login_attempts', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  attemptAt: integer('attempt_at').notNull(),
  success: integer('success').notNull().default(0),
  ipAddress: text('ip_address'),
}, (table) => [
  index('login_attempts_identifier_time_idx').on(table.identifier, table.attemptAt),
]);

// ============================================================================
// MÚLTIPLOS PERFIS POR CONTA (P3.B)
// ============================================================================

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  avatarId: text('avatar_id').notNull(),
  isDefault: integer('is_default').notNull().default(0),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('profiles_user_id_idx').on(table.userId),
  index('profiles_user_id_order_idx').on(table.userId, table.displayOrder),
]);

// ============================================================================
// VINCULAÇÃO DE SMART TVS POR QR CODE (P3.C)
// RFC 8628 (OAuth 2.0 Device Authorization Grant adaptado)
// ============================================================================

export const deviceLinkChallenges = sqliteTable('device_link_challenges', {
  id: text('id').primaryKey(),
  deviceCodeHash: text('device_code_hash').notNull(),
  userCode: text('user_code').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected', 'consumed', 'expired'] }).notNull().default('pending'),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  deviceName: text('device_name').notNull().default('Smart TV'),
  deviceType: text('device_type').notNull().default('smart_tv'),
  clientIp: text('client_ip'),
  userAgent: text('user_agent'),
  pollCount: integer('poll_count').notNull().default(0),
  lastPolledAt: integer('last_polled_at'),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  approvedAt: integer('approved_at'),
  consumedAt: integer('consumed_at'),
}, (table) => [
  uniqueIndex('device_link_challenges_device_code_hash_idx').on(table.deviceCodeHash),
  uniqueIndex('device_link_challenges_user_code_idx').on(table.userCode),
  index('device_link_challenges_status_expires_idx').on(table.status, table.expiresAt),
]);

export const linkedDevices = sqliteTable('linked_devices', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  deviceName: text('device_name').notNull(),
  deviceType: text('device_type').notNull(),
  clientIp: text('client_ip'),
  userAgent: text('user_agent'),
  lastActiveAt: integer('last_active_at').notNull(),
  createdAt: integer('created_at').notNull(),
  revokedAt: integer('revoked_at'),
}, (table) => [
  index('linked_devices_user_id_idx').on(table.userId),
  index('linked_devices_session_id_idx').on(table.sessionId),
]);

// ============================================================================
// SINCRONIZAÇÃO SEGURA ENTRE DISPOSITIVOS POR PERFIL (P3.D)
// Progresso, Histórico, Minha Lista e Favoritos
// ============================================================================

export const profilePlaybackProgress = sqliteTable('profile_playback_progress', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  canonicalId: text('canonical_id').notNull(),
  contentType: text('content_type').notNull(),
  season: integer('season').notNull().default(0),
  episode: integer('episode').notNull().default(0),
  positionSec: integer('position_sec').notNull(),
  durationSec: integer('duration_sec').notNull(),
  progressPercent: integer('progress_percent').notNull().default(0),
  isCompleted: integer('is_completed').notNull().default(0),
  version: integer('version').notNull().default(1),
  deviceName: text('device_name'),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  uniqueIndex('profile_progress_key_idx').on(table.profileId, table.canonicalId, table.season, table.episode),
  index('profile_progress_profile_updated_idx').on(table.profileId, table.updatedAt),
]);

export const profileWatchHistory = sqliteTable('profile_watch_history', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  canonicalId: text('canonical_id').notNull(),
  contentType: text('content_type').notNull(),
  season: integer('season').notNull().default(0),
  episode: integer('episode').notNull().default(0),
  title: text('title'),
  posterUrl: text('poster_url'),
  year: integer('year'),
  watchedAt: integer('watched_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  version: integer('version').notNull().default(1),
}, (table) => [
  uniqueIndex('profile_history_key_idx').on(table.profileId, table.canonicalId, table.season, table.episode),
  index('profile_history_profile_watched_idx').on(table.profileId, table.watchedAt),
]);

export const profileMyList = sqliteTable('profile_my_list', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  canonicalId: text('canonical_id').notNull(),
  addedAt: integer('added_at').notNull(),
  isRemoved: integer('is_removed').notNull().default(0),
  removedAt: integer('removed_at'),
  updatedAt: integer('updated_at').notNull(),
  version: integer('version').notNull().default(1),
}, (table) => [
  uniqueIndex('profile_mylist_key_idx').on(table.profileId, table.canonicalId),
  index('profile_mylist_profile_status_idx').on(table.profileId, table.isRemoved, table.updatedAt),
]);

export const profileFavorites = sqliteTable('profile_favorites', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  canonicalId: text('canonical_id').notNull(),
  addedAt: integer('added_at').notNull(),
  isRemoved: integer('is_removed').notNull().default(0),
  removedAt: integer('removed_at'),
  updatedAt: integer('updated_at').notNull(),
  version: integer('version').notNull().default(1),
}, (table) => [
  uniqueIndex('profile_favorites_key_idx').on(table.profileId, table.canonicalId),
  index('profile_favorites_profile_status_idx').on(table.profileId, table.isRemoved, table.updatedAt),
]);

// ============================================================================
// IDEMPOTÊNCIA PERSISTENTE DE MUTAÇÕES DE SINCRONIZAÇÃO (P4.A)
// Prevenção de repetição de mutações por reconexão, retries de rede ou concorrência serverless
// ============================================================================

export const processedSyncMutations = sqliteTable('processed_sync_mutations', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  mutationType: text('mutation_type').notNull(),
  canonicalId: text('canonical_id').notNull(),
  processedAt: integer('processed_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, (table) => [
  index('processed_sync_mutations_profile_id_idx').on(table.profileId),
  index('processed_sync_mutations_expires_at_idx').on(table.expiresAt),
]);






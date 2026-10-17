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

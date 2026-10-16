import Dexie, { Table } from 'dexie';
import { User, ContentItem, SiteNotification, CustomSection } from './types';
import { MOCK_USERS, filmesData } from './constants';
import { bannedContentRegistry } from './src/core/catalog/BannedContentRegistry';

export class ZapiTVDatabase extends Dexie {
  users!: Table<User, string>;
  content!: Table<ContentItem, string>;
  notifications!: Table<SiteNotification, string>;
  customSections!: Table<CustomSection, string>;
  
  // For simple key-value pairs like settings, active profile, mylist, favorites
  keyValueStore!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('ZapiTVDatabase');
    
    // Define the database schema
    this.version(1).stores({
      users: 'id, email, role', // Primary key and indexed props
      content: 'id, type, title, rating, year',
      notifications: 'id, type, timestamp',
      customSections: 'id, title',
      keyValueStore: 'key'
    });
  }
}

export const db = new ZapiTVDatabase();

const SEED_SYNC_STAMP_KEY = 'zapitv_seed_sync_stamp_v6';

// Initialize the database with mock data if it's empty
export async function initializeDatabase(): Promise<ContentItem[]> {
  const [usersCount, existingDbItems, themeEntry, sectionTitlesEntry] = await Promise.all([
    db.users.count(),
    db.content.toArray(),
    db.keyValueStore.get('zapitv_theme'),
    db.keyValueStore.get('zapitv_section_titles')
  ]);

  const bgWrites: Promise<unknown>[] = [];

  if (usersCount === 0) {
    bgWrites.push(db.users.bulkAdd(MOCK_USERS).catch(() => {}));
  }

  if (!themeEntry) {
    bgWrites.push(db.keyValueStore.put({ key: 'zapitv_theme', value: true }));
  }

  if (!sectionTitlesEntry) {
    bgWrites.push(
      db.keyValueStore.put({
        key: 'zapitv_section_titles',
        value: {
          premium: "Novidades Premium",
          recent: "Adicionados Recentemente",
          netflix: "Assista na Netflix",
          prime: "Prime Video",
          hbo: "HBO Max Originals"
        }
      })
    );
  }

  const cleanFilmesData = bannedContentRegistry.filterCleanItems(filmesData);
  const currentStamp = `${cleanFilmesData.length}_v6`;

  if (existingDbItems.length === 0) {
    await db.content.bulkPut(cleanFilmesData);
    try {
      localStorage.setItem(SEED_SYNC_STAMP_KEY, currentStamp);
    } catch {}
    if (bgWrites.length > 0) await Promise.all(bgWrites);
    return [...cleanFilmesData];
  }

  // Purga de segurança para itens banidos persistidos em sessões anteriores
  const bannedIds: string[] = [];
  const activeContent: ContentItem[] = [];
  for (const item of existingDbItems) {
    if (bannedContentRegistry.isBanned(item)) {
      bannedIds.push(item.id);
    } else {
      activeContent.push(item);
    }
  }

  if (bannedIds.length > 0) {
    bgWrites.push(db.content.bulkDelete(bannedIds).catch(() => {}));
  }

  let savedStamp: string | null = null;
  try {
    savedStamp = localStorage.getItem(SEED_SYNC_STAMP_KEY);
  } catch {}

  // Só executa diff profundo de JSON quando a versão da seed ainda não foi sincronizada
  if (savedStamp !== currentStamp) {
    const existingById = new Map(activeContent.map(c => [c.id, c]));
    const updates: ContentItem[] = [];

    for (const constItem of cleanFilmesData) {
      const item = existingById.get(constItem.id);
      if (!item) {
        updates.push(constItem);
        activeContent.push(constItem);
      } else {
        let changed = false;
        if (item.backdrop !== constItem.backdrop) { item.backdrop = constItem.backdrop; changed = true; }
        if (item.image !== constItem.image) { item.image = constItem.image; changed = true; }
        if (item.videoUrl !== constItem.videoUrl) { item.videoUrl = constItem.videoUrl; changed = true; }
        if (item.availabilityStatus !== constItem.availabilityStatus) { item.availabilityStatus = constItem.availabilityStatus; changed = true; }
        if (item.audioStatus !== constItem.audioStatus) { item.audioStatus = constItem.audioStatus; changed = true; }
        if ((item.episodes?.length || 0) !== (constItem.episodes?.length || 0) || JSON.stringify(item.episodes) !== JSON.stringify(constItem.episodes)) {
          item.episodes = constItem.episodes;
          changed = true;
        }
        if ((item.verifiedStreams?.length || 0) !== (constItem.verifiedStreams?.length || 0) || JSON.stringify(item.verifiedStreams) !== JSON.stringify(constItem.verifiedStreams)) {
          item.verifiedStreams = constItem.verifiedStreams;
          changed = true;
        }
        if (changed) {
          updates.push(item);
        }
      }
    }

    if (updates.length > 0) {
      await db.content.bulkPut(updates);
    }
    try {
      localStorage.setItem(SEED_SYNC_STAMP_KEY, currentStamp);
    } catch {}
  }

  if (bgWrites.length > 0) {
    await Promise.all(bgWrites);
  }

  return activeContent;
}


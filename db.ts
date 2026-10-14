import Dexie, { Table } from 'dexie';
import { User, ContentItem, SiteNotification, CustomSection } from './types';
import { MOCK_USERS, filmesData } from './constants';

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

// Initialize the database with mock data if it's empty
export async function initializeDatabase() {
  const usersCount = await db.users.count();
  if (usersCount === 0) {
    await db.users.bulkAdd(MOCK_USERS);
  }

  const contentCount = await db.content.count();
  
  if (contentCount === 0) {
    await db.content.bulkPut(filmesData);
  } else {
    // Sincroniza filmes novos que foram adicionados no constants.tsx
    const existingContent = await db.content.toArray();
    const existingIds = new Set(existingContent.map(c => c.id));
    const newItems = filmesData.filter(c => !existingIds.has(c.id));
    if (newItems.length > 0) {
      await db.content.bulkPut(newItems);
    }

    // Atualiza backdrops e imagens que diferem do constants.tsx
    const updates = [];
    for (const item of existingContent) {
      const constItem = filmesData.find(c => c.id === item.id);
      if (constItem) {
        let changed = false;
        if (item.backdrop !== constItem.backdrop) {
          item.backdrop = constItem.backdrop;
          changed = true;
        }
        if (item.image !== constItem.image) {
          item.image = constItem.image;
          changed = true;
        }
        if (item.videoUrl !== constItem.videoUrl) {
          item.videoUrl = constItem.videoUrl;
          changed = true;
        }
        if (JSON.stringify(item.episodes) !== JSON.stringify(constItem.episodes)) {
          item.episodes = constItem.episodes;
          changed = true;
        }
        if (JSON.stringify(item.verifiedStreams) !== JSON.stringify(constItem.verifiedStreams)) {
          item.verifiedStreams = constItem.verifiedStreams;
          changed = true;
        }
        if (item.availabilityStatus !== constItem.availabilityStatus) {
          item.availabilityStatus = constItem.availabilityStatus;
          changed = true;
        }
        if (item.audioStatus !== constItem.audioStatus) {
          item.audioStatus = constItem.audioStatus;
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
  }

  // Initialize default key-value pairs if they don't exist
  const theme = await db.keyValueStore.get('zapitv_theme');
  if (!theme) {
    await db.keyValueStore.put({ key: 'zapitv_theme', value: true });
  }

  const sectionTitles = await db.keyValueStore.get('zapitv_section_titles');
  if (!sectionTitles) {
    await db.keyValueStore.put({
      key: 'zapitv_section_titles',
      value: {
        premium: "Novidades Premium",
        recent: "Adicionados Recentemente",
        netflix: "Assista na Netflix",
        prime: "Prime Video",
        hbo: "HBO Max Originals"
      }
    });
  }
}

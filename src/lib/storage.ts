import type { ProcessedFile } from './file-processor';

export interface NotebookData {
  id: string;
  title: string;
  description?: string;
  sources: ProcessedFile[];
  createdAt: number;
  updatedAt: number;
  summary?: string;
  tags?: string[];
}

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: number;
  sources?: string[]; // File IDs that were referenced
}

export interface NotebookChat {
  notebookId: string;
  messages: ChatMessage[];
}

// Local Storage keys
const STORAGE_KEYS = {
  NOTEBOOKS: 'notebooklm_notebooks',
  CHATS: 'notebooklm_chats',
  SETTINGS: 'notebooklm_settings',
} as const;

// IndexedDB setup for large files
const DB_NAME = 'NotebookLM';
const DB_VERSION = 1;
const STORES = {
  FILES: 'files',
  NOTEBOOKS: 'notebooks',
} as const;

class StorageManager {
  private db: IDBDatabase | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initIndexedDB();
    }
  }

  // Initialize IndexedDB
  private async initIndexedDB(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains(STORES.FILES)) {
          const fileStore = db.createObjectStore(STORES.FILES, { keyPath: 'id' });
          fileStore.createIndex('notebookId', 'notebookId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.NOTEBOOKS)) {
          const notebookStore = db.createObjectStore(STORES.NOTEBOOKS, { keyPath: 'id' });
          notebookStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  // Generate unique ID
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Local Storage operations
  private getFromLocalStorage<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  }

  private saveToLocalStorage<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  // IndexedDB operations
  private async getFromIndexedDB<T>(storeName: string, key: string): Promise<T | null> {
    if (!this.db) await this.initIndexedDB();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async saveToIndexedDB<T>(storeName: string, data: T): Promise<void> {
    if (!this.db) await this.initIndexedDB();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getAllFromIndexedDB<T>(storeName: string): Promise<T[]> {
    if (!this.db) await this.initIndexedDB();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Notebook operations
  async createNotebook(title: string, description?: string): Promise<NotebookData> {
    const notebook: NotebookData = {
      id: this.generateId(),
      title,
      description,
      sources: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
    };

    await this.saveToIndexedDB(STORES.NOTEBOOKS, notebook);
    return notebook;
  }

  async getNotebook(id: string): Promise<NotebookData | null> {
    return await this.getFromIndexedDB<NotebookData>(STORES.NOTEBOOKS, id);
  }

  async getAllNotebooks(): Promise<NotebookData[]> {
    const notebooks = await this.getAllFromIndexedDB<NotebookData>(STORES.NOTEBOOKS);
    return notebooks.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async updateNotebook(notebook: NotebookData): Promise<void> {
    notebook.updatedAt = Date.now();
    await this.saveToIndexedDB(STORES.NOTEBOOKS, notebook);
  }

  async deleteNotebook(id: string): Promise<void> {
    if (!this.db) await this.initIndexedDB();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.NOTEBOOKS], 'readwrite');
      const store = transaction.objectStore(STORES.NOTEBOOKS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // File operations
  async saveFile(file: ProcessedFile, notebookId: string): Promise<void> {
    const fileWithNotebook = { ...file, notebookId };
    await this.saveToIndexedDB(STORES.FILES, fileWithNotebook);
  }

  async getFile(id: string): Promise<ProcessedFile | null> {
    return await this.getFromIndexedDB<ProcessedFile>(STORES.FILES, id);
  }

  async getFilesByNotebook(notebookId: string): Promise<ProcessedFile[]> {
    if (!this.db) await this.initIndexedDB();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.FILES], 'readonly');
      const store = transaction.objectStore(STORES.FILES);
      const index = store.index('notebookId');
      const request = index.getAll(notebookId);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Chat operations
  async saveChat(notebookId: string, messages: ChatMessage[]): Promise<void> {
    const chats = this.getFromLocalStorage<Record<string, ChatMessage[]>>(STORAGE_KEYS.CHATS) || {};
    chats[notebookId] = messages;
    this.saveToLocalStorage(STORAGE_KEYS.CHATS, chats);
  }

  async getChat(notebookId: string): Promise<ChatMessage[]> {
    const chats = this.getFromLocalStorage<Record<string, ChatMessage[]>>(STORAGE_KEYS.CHATS) || {};
    return chats[notebookId] || [];
  }

  async addChatMessage(notebookId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    const chatMessage: ChatMessage = {
      ...message,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    const existingMessages = await this.getChat(notebookId);
    const updatedMessages = [...existingMessages, chatMessage];
    await this.saveChat(notebookId, updatedMessages);

    return chatMessage;
  }

  // Settings operations
  saveSettings(settings: Record<string, unknown>): void {
    this.saveToLocalStorage(STORAGE_KEYS.SETTINGS, settings);
  }

  getSettings(): Record<string, unknown> {
    return this.getFromLocalStorage(STORAGE_KEYS.SETTINGS) || {};
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    // Clear localStorage
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });

    // Clear IndexedDB
    if (!this.db) await this.initIndexedDB();
    if (!this.db) return;

    const transaction = this.db.transaction([STORES.FILES, STORES.NOTEBOOKS], 'readwrite');

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(STORES.FILES).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(STORES.NOTEBOOKS).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
    ]);
  }
}

// Export singleton instance
export const storage = new StorageManager();

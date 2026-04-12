import { runtimeConnectivity } from '@/lib/runtime';

export interface OfflineQueueItem {
    id: string;
    conversationId: string;
    content: string;
    createdAt: string;
    retryCount: number;
    status: 'pending' | 'syncing' | 'failed';
}

type QueueListener = (items: OfflineQueueItem[]) => void;

const STORAGE_KEY = 'chat_offline_queue';

class OfflineQueueStore {
    private items: OfflineQueueItem[] = [];
    private listeners = new Set<QueueListener>();
    private initialized = false;

    init() {
        if (this.initialized) {
            return;
        }

        this.initialized = true;
        this.items = this.load();
    }

    subscribe(listener: QueueListener) {
        this.init();
        this.listeners.add(listener);
        listener(this.items);

        return () => {
            this.listeners.delete(listener);
        };
    }

    getItems() {
        this.init();
        return this.items;
    }

    isOnline() {
        return runtimeConnectivity.isOnline();
    }

    enqueue(item: Omit<OfflineQueueItem, 'retryCount' | 'status'>) {
        this.init();
        if (this.items.some((existing) => existing.id === item.id)) {
            return;
        }
        this.items = [...this.items, { ...item, retryCount: 0, status: 'pending' }];
        this.persist();
    }

    remove(itemId: string) {
        this.init();
        this.items = this.items.filter((item) => item.id !== itemId);
        this.persist();
    }

    update(itemId: string, updater: (current: OfflineQueueItem) => OfflineQueueItem) {
        this.init();
        this.items = this.items.map((item) => (item.id === itemId ? updater(item) : item));
        this.persist();
    }

    clear() {
        this.items = [];
        this.persist();
    }

    private load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? (JSON.parse(raw) as OfflineQueueItem[]) : [];
            return parsed.map((item) => ({
                ...item,
                status: item.status === 'syncing' ? 'pending' : item.status,
            }));
        } catch {
            return [];
        }
    }

    private persist() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
        for (const listener of this.listeners) {
            listener(this.items);
        }
    }
}

export const offlineQueueStore = new OfflineQueueStore();

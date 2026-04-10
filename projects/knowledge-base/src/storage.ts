import { getItem, getItemByUrl, insertItem, itemExistsByUrl, listItems, updateItem } from './db.ts';
import type { KnowledgeItem } from './types.ts';

export async function saveItem(item: KnowledgeItem): Promise<void> {
  insertItem({ id: item.id, url: item.url, type: item.type, dateAdded: item.dateAdded });
  updateItem(item.id, {
    title: item.title,
    author: item.author,
    status: item.status,
    transcript: item.transcript,
    summary: item.summary,
    sections: item.sections,
    tags: item.tags,
  });
}

export async function loadIndex(): Promise<KnowledgeItem[]> {
  return listItems();
}

export async function loadItem(id: string): Promise<KnowledgeItem | null> {
  return getItem(id);
}

export async function itemExists(url: string): Promise<boolean> {
  return itemExistsByUrl(url);
}

export { getItemByUrl };

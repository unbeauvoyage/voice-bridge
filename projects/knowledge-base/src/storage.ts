import { getItem, getItemByUrl, insertItem, itemExistsByUrl, listItems, updateItem } from './db.ts';
import type { KnowledgeItem } from './types.ts';

export async function saveItem(item: KnowledgeItem): Promise<void> {
  insertItem({ id: item.id, url: item.url, type: item.type, createdAt: item.createdAt });
  const fields: Parameters<typeof updateItem>[1] = {
    title: item.title,
    status: item.status,
    summary: item.summary,
    sections: item.sections,
    tags: item.tags,
  };
  if (item.author !== undefined) fields.author = item.author;
  if (item.transcript !== undefined) fields.transcript = item.transcript;
  updateItem(item.id, fields);
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

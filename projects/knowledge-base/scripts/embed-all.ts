// Run once to embed all existing items that have no embedding yet
import { db, saveEmbedding } from '../src/db.ts';
import { generateEmbedding, itemEmbedText } from '../src/embed.ts';

const items = db.query(`
  SELECT i.* FROM items i
  LEFT JOIN item_embeddings e ON e.item_id = i.id
  WHERE e.item_id IS NULL AND i.status = 'done'
`).all() as any[];

console.log(`Embedding ${items.length} items...`);
for (const item of items) {
  try {
    const text = itemEmbedText({ title: item.title, summary: item.summary, tldr: item.tldr ? JSON.parse(item.tldr) : [] });
    const embedding = await generateEmbedding(text);
    saveEmbedding(item.id, embedding);
    console.log(`✓ ${item.id}`);
  } catch (e) {
    console.error(`✗ ${item.id}:`, e);
  }
}
console.log('Done.');

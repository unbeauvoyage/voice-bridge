export interface KnowledgeSection {
  title: string;
  points: string[];
}

export interface KnowledgeItem {
  id: string;
  url: string;
  type: 'youtube' | 'web';
  title: string;
  author?: string;
  dateAdded: string;
  tags: string[];
  summary: string;
  sections: KnowledgeSection[];
  content: string;
}

export interface ExtractedContent {
  title: string;
  author?: string;
  content: string;
  url: string;
}

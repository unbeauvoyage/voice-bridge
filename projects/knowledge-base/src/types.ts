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
  tldr: string[];
  summary: string;
  sections: KnowledgeSection[];
  transcript: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  error?: string;
  readAt?: string;
}

export interface ExtractedContent {
  title: string;
  author?: string;
  content: string;
  url: string;
}

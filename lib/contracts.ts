export type ContentType = 'news' | 'topic' | 'history' | 'fiction';
export type Level = 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export type ReadingLength = 'short' | 'medium' | 'long';

export type GenerationRequest = {
  type: ContentType;
  topic: string;
  genre: string;
  idea: string;
  level: Level;
  length: ReadingLength;
};

export type StorySummary = {
  id: string;
  title: string;
  subtitle: string;
  summaryEnglish: string;
  type: ContentType;
  topic: string;
  genre: string;
  level: Level;
  length: ReadingLength;
  readingMinutes: number;
  wordCount: number;
  createdAt: string;
  read: boolean;
  favourite: boolean;
  hasNotes: boolean;
};

export type Annotation = {
  word: string;
  lemma: string;
  meaning: string;
  partOfSpeech: string;
  difficulty: 'common' | 'useful' | 'advanced';
  exampleNl: string;
  exampleEn: string;
};

export type SentenceTranslation = {
  paragraphIndex: number;
  sentenceIndex: number;
  dutch: string;
  english: string;
};

export type Story = {
  schemaVersion: number;
  id: string;
  request: GenerationRequest;
  title: string;
  subtitle: string;
  summaryEnglish: string;
  paragraphs: string[];
  tags: string[];
  sources: Array<{
    title: string;
    publisher: string;
    url: string;
    publishedAt: string;
    retrievedAt: string;
  }>;
  wordCount: number;
  readingMinutes: number;
  annotations: Record<string, Annotation>;
  sentenceTranslations: SentenceTranslation[];
  state: { read: boolean; favourite: boolean; notes: string };
  createdAt: string;
  updatedAt: string;
};

export type GenerationJob = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage: string;
  detail: string;
  request: GenerationRequest;
  storyId: string | null;
  createdAt: string;
  updatedAt: string;
  error: string | null;
};

export type ChatAnswer = {
  answer: string;
  exampleNl: string;
  exampleEn: string;
};

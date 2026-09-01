'use client';

import {
  ArrowLeft,
  BookOpen,
  Check,
  Clock3,
  ExternalLink,
  Heart,
  Languages,
  Library,
  MessageCircle,
  Plus,
  Save,
  Send,
  Sparkles,
  StickyNote,
} from 'lucide-react';
import {
  Fragment,
  ReactNode,
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import type {
  Annotation,
  ChatAnswer,
  ContentType,
  GenerationJob,
  GenerationRequest,
  Level,
  ReadingLength,
  SentenceTranslation,
  Story,
  StorySummary,
} from '@/lib/contracts';

const TOPICS = [
  ['technology', 'Technology'],
  ['science', 'Science'],
  ['sports', 'Sports'],
  ['entertainment', 'Entertainment'],
  ['netherlands', 'The Netherlands'],
  ['world', 'World'],
  ['business', 'Business'],
  ['history', 'History'],
  ['arts-and-culture', 'Arts & culture'],
] as const;

const GENRES = [
  ['slice-of-life', 'Slice of life'],
  ['mystery', 'Mystery'],
  ['science-fiction', 'Science fiction'],
  ['fantasy', 'Fantasy'],
  ['comedy', 'Comedy'],
  ['drama', 'Drama'],
  ['romance', 'Romance'],
] as const;

const TYPE_LABELS: Record<ContentType, string> = {
  news: 'Current news',
  topic: 'Topic explainer',
  history: 'History & culture',
  fiction: 'Fiction',
};

const LENGTH_LABELS: Record<ReadingLength, string> = {
  short: 'Short · 1–2 min',
  medium: 'Medium · 4–6 min',
  long: 'Long · 8–10 min',
};

const DEFAULT_REQUEST: GenerationRequest = {
  type: 'news',
  topic: 'technology',
  genre: 'slice-of-life',
  idea: '',
  level: 'A2',
  length: 'medium',
};

const WORD_SPLITTER = /([\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*)/gu;
const WORD_ONLY = /^[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*$/u;

type AppView = 'library' | 'reader';
type LibraryFilter = 'all' | 'unread' | 'favourites';
type ChatMessage =
  | { id: string; role: 'user'; text: string; selection: string }
  | { id: string; role: 'assistant'; answer: ChatAnswer };

function normalizeWord(value: string) {
  return value.normalize('NFC').toLocaleLowerCase('nl-NL');
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="field-label">{children}</span>;
}

function Word({
  surface,
  annotation,
}: {
  surface: string;
  annotation?: Annotation;
}) {
  const fallback: Annotation = {
    word: normalizeWord(surface),
    lemma: normalizeWord(surface),
    meaning: 'Translation unavailable',
    partOfSpeech: 'word',
    difficulty: 'common',
    exampleNl: '',
    exampleEn: '',
  };
  const entry = annotation || fallback;

  return (
    <Popover>
      <PopoverTrigger
        className={`explained-word explained-word-${entry.difficulty}`}
      >
        {surface}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-xl p-4">
        <PopoverHeader>
          <div className="flex items-baseline justify-between gap-4">
            <PopoverTitle className="font-serif text-lg">
              {surface}
            </PopoverTitle>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {entry.partOfSpeech}
            </span>
          </div>
          <PopoverDescription className="text-sm text-foreground">
            {entry.meaning}
          </PopoverDescription>
        </PopoverHeader>
        <div className="text-xs text-muted-foreground">
          Lemma: {entry.lemma}
        </div>
        {entry.exampleNl && entry.exampleEn ? (
          <div className="mt-1 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
            <p className="text-foreground">{entry.exampleNl}</p>
            <p>{entry.exampleEn}</p>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function AnnotatedText({
  text,
  annotations,
}: {
  text: string;
  annotations: Story['annotations'];
}) {
  return (
    <>
      {text
        .split(WORD_SPLITTER)
        .map((part, index) =>
          WORD_ONLY.test(part) ? (
            <Word
              key={`${index}-${part}`}
              surface={part}
              annotation={annotations[normalizeWord(part)]}
            />
          ) : (
            <Fragment key={`${index}-${part}`}>{part}</Fragment>
          ),
        )}
    </>
  );
}

function AnnotatedParagraph({
  text,
  annotations,
}: {
  text: string;
  annotations: Story['annotations'];
}) {
  return (
    <p lang="nl">
      <AnnotatedText text={text} annotations={annotations} />
    </p>
  );
}

function TranslatedParagraph({
  paragraphIndex,
  paragraph,
  translations,
  annotations,
}: {
  paragraphIndex: number;
  paragraph: string;
  translations: SentenceTranslation[];
  annotations: Story['annotations'];
}) {
  const sentences = translations
    .filter((entry) => entry.paragraphIndex === paragraphIndex)
    .sort((a, b) => a.sentenceIndex - b.sentenceIndex);

  if (!sentences.length) {
    return <AnnotatedParagraph text={paragraph} annotations={annotations} />;
  }

  return (
    <div className="space-y-5">
      {sentences.map((sentence) => (
        <div key={`${sentence.paragraphIndex}-${sentence.sentenceIndex}`}>
          <p lang="nl">
            <AnnotatedText text={sentence.dutch} annotations={annotations} />
          </p>
          <p className="sentence-translation" lang="en">
            {sentence.english}
          </p>
        </div>
      ))}
    </div>
  );
}

function JobCard({
  job,
  onOpen,
}: {
  job: GenerationJob;
  onOpen: (storyId: string) => void;
}) {
  const active = job.status === 'queued' || job.status === 'running';

  return (
    <div
      className={`job-card ${job.status === 'failed' ? 'job-card-error' : ''}`}
    >
      <div className="flex items-start gap-3">
        {active ? (
          <div className="mt-0.5 size-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        ) : job.status === 'completed' ? (
          <Check className="mt-0.5 size-4 text-primary" />
        ) : (
          <span className="mt-1 size-2 rounded-full bg-destructive" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {job.request.idea || TYPE_LABELS[job.request.type]}
          </p>
          <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
            {job.status === 'failed'
              ? job.error
              : `${job.detail} · ${job.request.level}`}
          </p>
          {job.storyId ? (
            <button
              className="mt-2 text-xs font-medium text-primary"
              type="button"
              onClick={() => onOpen(job.storyId!)}
            >
              Open text
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StoryCard({
  item,
  onOpen,
}: {
  item: StorySummary;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className="story-card group"
      onClick={() => onOpen(item.id)}
    >
      <span className="flex items-start justify-between gap-4">
        <span className="flex items-center gap-2">
          <span className="rounded-md bg-level px-2 py-1 text-[11px] font-semibold text-level-foreground">
            {item.level}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {TYPE_LABELS[item.type]}
          </span>
        </span>
        {item.favourite ? (
          <Heart className="size-4 fill-current text-primary" />
        ) : !item.read ? (
          <span
            className="mt-1 size-2 rounded-full bg-primary"
            aria-label="Unread"
          />
        ) : null}
      </span>
      <span className="mt-5 block font-serif text-[22px] font-medium leading-7 tracking-[-0.02em] group-hover:text-primary">
        {item.title}
      </span>
      <span className="mt-2 line-clamp-2 block text-sm leading-6 text-muted-foreground">
        {item.summaryEnglish || item.subtitle}
      </span>
      <span className="mt-6 flex items-center gap-4 border-t border-border/80 pt-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock3 className="size-3.5" /> {item.readingMinutes} min
        </span>
        <span>{item.read ? 'Read' : 'Unread'}</span>
        {item.hasNotes ? (
          <span className="ml-auto flex items-center gap-1.5">
            <StickyNote className="size-3.5" /> Notes
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function ReaderApp() {
  const [view, setView] = useState<AppView>('library');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [request, setRequest] = useState(DEFAULT_REQUEST);
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [story, setStory] = useState<Story | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [showSentenceTranslations, setShowSentenceTranslations] =
    useState(false);
  const [selection, setSelection] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const knownStoryIds = useRef(new Set<string>());
  const articleRef = useRef<HTMLElement>(null);

  const refreshLibrary = useCallback(async () => {
    const result = await api.listStories();
    setStories(result.stories);
    knownStoryIds.current = new Set(result.stories.map((item) => item.id));
    return result.stories;
  }, []);

  const openStory = useCallback((id: string) => {
    setStory(null);
    setSelectedId(id);
    setSelection('');
    setChatMessages([]);
    setShowSentenceTranslations(false);
    setView('reader');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  function returnToLibrary() {
    setView('library');
    setChatOpen(false);
    setSelection('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showGenerator() {
    setError('');
    setGenerateOpen(true);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listStories(), api.listJobs()])
      .then(([libraryResult, jobResult]) => {
        if (cancelled) return;
        setStories(libraryResult.stories);
        knownStoryIds.current = new Set(
          libraryResult.stories.map((item) => item.id),
        );
        setJobs(jobResult.jobs);
      })
      .catch((reason) => !cancelled && setError(reason.message))
      .finally(() => !cancelled && setLoadingLibrary(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    api
      .getStory(selectedId)
      .then(({ story: nextStory }) => {
        if (cancelled) return;
        setStory(nextStory);
        setNotes(nextStory.state.notes);
      })
      .catch((reason) => !cancelled && setError(reason.message));
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    const poll = async () => {
      try {
        const { jobs: nextJobs } = await api.listJobs();
        setJobs(nextJobs);
        const unseenCompleted = nextJobs.find(
          (job) =>
            job.status === 'completed' &&
            job.storyId &&
            !knownStoryIds.current.has(job.storyId),
        );
        if (unseenCompleted) await refreshLibrary();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    };
    const interval = window.setInterval(poll, 1_500);
    return () => window.clearInterval(interval);
  }, [refreshLibrary]);

  const visibleStories = useMemo(() => {
    if (filter === 'unread') return stories.filter((item) => !item.read);
    if (filter === 'favourites')
      return stories.filter((item) => item.favourite);
    return stories;
  }, [filter, stories]);

  const activeJobs = jobs.filter(
    (job) => job.status === 'queued' || job.status === 'running',
  );
  const failedJobs = jobs.filter((job) => job.status === 'failed').slice(0, 2);
  const visibleJobs = [...activeJobs, ...failedJobs];
  const readCount = stories.filter((item) => item.read).length;
  const favouriteCount = stories.filter((item) => item.favourite).length;

  async function submitGeneration(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...request,
        topic: request.type === 'fiction' ? 'fiction' : request.topic,
      };
      const { job } = await api.generate(payload);
      setJobs((current) => [job, ...current]);
      setRequest((current) => ({ ...current, idea: '' }));
      setGenerateOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStory(patch: {
    read?: boolean;
    favourite?: boolean;
    notes?: string;
  }) {
    if (!story) return;
    setError('');
    try {
      const { story: updated } = await api.updateStory(story.id, patch);
      setStory(updated);
      setNotes(updated.state.notes);
      await refreshLibrary();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function saveNotes() {
    if (!story) return;
    setSavingNotes(true);
    await updateStory({ notes });
    setSavingNotes(false);
  }

  function captureSelection() {
    window.setTimeout(() => {
      const selected = window.getSelection();
      if (!selected || selected.isCollapsed || !articleRef.current) {
        setSelection('');
        return;
      }
      const node = selected.anchorNode;
      if (node && articleRef.current.contains(node))
        setSelection(selected.toString().trim().slice(0, 1_000));
    }, 0);
  }

  async function sendChat(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!story || !chatQuestion.trim() || chatLoading) return;
    const question = chatQuestion.trim();
    const selectedText = selection;
    setChatMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'user',
        text: question,
        selection: selectedText,
      },
    ]);
    setChatQuestion('');
    setChatLoading(true);
    try {
      const { answer } = await api.chat(story.id, question, selectedText);
      setChatMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', answer },
      ]);
    } catch (reason) {
      setChatMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          answer: {
            answer: reason instanceof Error ? reason.message : String(reason),
            exampleNl: '',
            exampleEn: '',
          },
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5 lg:px-8">
          <button
            type="button"
            className="flex items-center gap-3 text-left"
            onClick={returnToLibrary}
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookOpen className="size-4" />
            </div>
            <div>
              <div className="text-[15px] font-semibold tracking-[-0.02em]">
                Lees
              </div>
              <div className="text-[10px] text-muted-foreground">
                Dutch reading
              </div>
            </div>
          </button>

          {view === 'library' ? (
            <Button size="sm" onClick={showGenerator}>
              <Plus /> Generate text
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={returnToLibrary}>
              <ArrowLeft /> Library
            </Button>
          )}
        </div>
      </header>

      {view === 'library' ? (
        <div className="mx-auto max-w-[1180px] px-5 py-10 sm:py-14 lg:px-8">
          <section className="border-b border-border pb-9">
            <div>
              <p className="eyebrow">Library</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                Your Dutch texts
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                Choose a text to start reading. New generations run in the
                background and appear here when they are ready.
              </p>
            </div>
          </section>

          {error && !generateOpen ? (
            <p
              className="mt-5 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {visibleJobs.length ? (
            <section className="mt-8" aria-live="polite">
              <div className="mb-3 flex items-center gap-2">
                <FieldLabel>Generating</FieldLabel>
                {activeJobs.length ? (
                  <span
                    className="status-dot"
                    aria-label={`${activeJobs.length} active generations`}
                  />
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleJobs.map((job) => (
                  <JobCard key={job.id} job={job} onOpen={openStory} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid w-full grid-cols-3 rounded-lg bg-muted p-0.5 sm:w-[300px]">
                {(['all', 'unread', 'favourites'] as const).map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={`filter-tab ${filter === value ? 'filter-tab-active' : ''}`}
                    onClick={() => setFilter(value)}
                  >
                    {value === 'all'
                      ? 'All'
                      : value === 'unread'
                        ? 'Unread'
                        : 'Favourites'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {stories.length} saved · {readCount} read · {favouriteCount}{' '}
                favourites
              </p>
            </div>

            {loadingLibrary ? (
              <div className="flex min-h-64 items-center justify-center">
                <span className="size-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
              </div>
            ) : visibleStories.length ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleStories.map((item) => (
                  <StoryCard key={item.id} item={item} onOpen={openStory} />
                ))}
              </div>
            ) : (
              <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 text-center">
                <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-background">
                  <Library className="size-5 text-primary" />
                </div>
                <h2 className="mt-4 font-serif text-xl font-medium">
                  {stories.length
                    ? 'No texts in this view'
                    : 'Your library is empty'}
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  {stories.length
                    ? 'Try another filter to see the rest of your library.'
                    : 'Generate a short Dutch text and it will be saved here automatically.'}
                </p>
                {!stories.length ? (
                  <Button className="mt-5" onClick={showGenerator}>
                    <Plus /> Generate a text
                  </Button>
                ) : null}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="min-h-[calc(100vh-65px)] bg-paper">
          {story ? (
            <article
              ref={articleRef}
              className="mx-auto max-w-[780px] px-5 py-10 sm:px-10 sm:py-14"
              onPointerUp={captureSelection}
            >
              <button
                type="button"
                className="mb-8 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={returnToLibrary}
              >
                <ArrowLeft className="size-3.5" /> Back to library
              </button>

              <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                <span className="rounded-md bg-level px-2 py-1 font-semibold text-level-foreground">
                  {story.request.level}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock3 className="size-3.5" /> {story.readingMinutes} min
                </span>
                <span>{TYPE_LABELS[story.request.type]}</span>
                <span className="sm:ml-auto">
                  {new Date(story.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                {story.sentenceTranslations?.length ? (
                  <Button
                    variant={showSentenceTranslations ? 'secondary' : 'ghost'}
                    size="xs"
                    className="ml-auto sm:ml-0"
                    aria-pressed={showSentenceTranslations}
                    onClick={() =>
                      setShowSentenceTranslations((current) => !current)
                    }
                  >
                    <Languages />
                    {showSentenceTranslations
                      ? 'Hide English'
                      : 'Sentence translations'}
                  </Button>
                ) : null}
              </div>

              <h1 className="article-title">{story.title}</h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
                {story.subtitle}
              </p>

              <div
                className={`article-copy mt-9 ${showSentenceTranslations ? 'space-y-8' : 'space-y-6'}`}
              >
                {story.paragraphs.map((paragraph, index) =>
                  showSentenceTranslations ? (
                    <TranslatedParagraph
                      key={index}
                      paragraphIndex={index}
                      paragraph={paragraph}
                      translations={story.sentenceTranslations || []}
                      annotations={story.annotations}
                    />
                  ) : (
                    <AnnotatedParagraph
                      key={index}
                      text={paragraph}
                      annotations={story.annotations}
                    />
                  ),
                )}
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-border pt-5">
                <Button
                  variant={story.state.favourite ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() =>
                    updateStory({ favourite: !story.state.favourite })
                  }
                >
                  <Heart
                    className={story.state.favourite ? 'fill-current' : ''}
                  />{' '}
                  {story.state.favourite ? 'Favourited' : 'Favourite'}
                </Button>
                <Button
                  variant={story.state.read ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => updateStory({ read: !story.state.read })}
                >
                  <Check /> {story.state.read ? 'Read' : 'Mark as read'}
                </Button>
              </div>

              <section className="mt-8 rounded-xl border border-border bg-card/70 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <StickyNote className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Personal notes</h2>
                </div>
                <Textarea
                  className="min-h-28 resize-y bg-background text-sm"
                  placeholder="Add a note about this text…"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    Saved with the text
                  </span>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={savingNotes || notes === story.state.notes}
                    onClick={saveNotes}
                  >
                    <Save /> {savingNotes ? 'Saving' : 'Save'}
                  </Button>
                </div>
              </section>

              {story.sources.length ? (
                <section className="mt-6 rounded-xl border border-border bg-card/70 p-5 text-xs leading-5">
                  <h2 className="font-semibold text-foreground">Sources</h2>
                  <ul className="mt-2 space-y-2 text-muted-foreground">
                    {story.sources.map((source) => (
                      <li key={source.url}>
                        <a
                          className="inline-flex items-start gap-1.5 hover:text-foreground hover:underline"
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span>
                            {source.title} — {source.publisher}
                            {source.publishedAt
                              ? `, ${source.publishedAt}`
                              : ''}
                          </span>
                          <ExternalLink className="mt-0.5 size-3 shrink-0" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {error ? (
                <p className="mt-5 text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </article>
          ) : (
            <div className="flex min-h-[65vh] items-center justify-center">
              <span className="size-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
            </div>
          )}

          {story ? (
            <Button
              className="fixed right-5 bottom-5 z-40 h-12 max-w-[calc(100%-2.5rem)] rounded-full px-5 shadow-[0_10px_32px_rgba(29,43,37,0.2)] sm:right-7 sm:bottom-7"
              onClick={() => setChatOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={chatOpen}
            >
              <MessageCircle />
              <span className="truncate">
                {selection ? 'Ask about selection' : 'Ask AI'}
              </span>
            </Button>
          ) : null}
        </div>
      )}

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-[560px]">
          <form onSubmit={submitGeneration}>
            <DialogHeader className="px-5 pt-5 pr-12 sm:px-6 sm:pt-6">
              <DialogTitle className="text-lg">
                Generate a Dutch text
              </DialogTitle>
              <DialogDescription>
                Choose the kind of text, reading level, and length.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-6">
              <div className="grid gap-2">
                <FieldLabel>Type</FieldLabel>
                <Select
                  value={request.type}
                  onValueChange={(value) =>
                    value &&
                    setRequest((current) => ({
                      ...current,
                      type: value as ContentType,
                    }))
                  }
                >
                  <SelectTrigger className="h-10 w-full bg-background">
                    <SelectValue>{TYPE_LABELS[request.type]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <SelectItem value={value} key={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {request.type === 'fiction' ? (
                <div className="grid gap-2">
                  <FieldLabel>Genre</FieldLabel>
                  <Select
                    value={request.genre}
                    onValueChange={(genre) =>
                      genre && setRequest((current) => ({ ...current, genre }))
                    }
                  >
                    <SelectTrigger className="h-10 w-full bg-background">
                      <SelectValue>
                        {GENRES.find(([value]) => value === request.genre)?.[1]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="start">
                      {GENRES.map(([value, label]) => (
                        <SelectItem value={value} key={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="grid gap-2">
                  <FieldLabel>Topic</FieldLabel>
                  <Select
                    value={request.topic}
                    onValueChange={(topic) =>
                      topic && setRequest((current) => ({ ...current, topic }))
                    }
                  >
                    <SelectTrigger className="h-10 w-full bg-background">
                      <SelectValue>
                        {TOPICS.find(([value]) => value === request.topic)?.[1]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="start">
                      {TOPICS.map(([value, label]) => (
                        <SelectItem value={value} key={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <label
                className="grid gap-2 sm:col-span-2"
                htmlFor="specific-idea"
              >
                <FieldLabel>Specific idea — optional</FieldLabel>
                <Input
                  id="specific-idea"
                  className="h-10 bg-background"
                  placeholder={
                    request.type === 'fiction'
                      ? 'e.g. a lost key in Utrecht'
                      : 'e.g. reusable rockets'
                  }
                  value={request.idea}
                  onChange={(event) =>
                    setRequest((current) => ({
                      ...current,
                      idea: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="grid gap-2">
                <FieldLabel>Level</FieldLabel>
                <Select
                  value={request.level}
                  onValueChange={(level) =>
                    level &&
                    setRequest((current) => ({
                      ...current,
                      level: level as Level,
                    }))
                  }
                >
                  <SelectTrigger className="h-10 w-full bg-background">
                    <SelectValue>{request.level}</SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {(['A0', 'A1', 'A2', 'B1', 'B2', 'C1'] as const).map(
                      (level) => (
                        <SelectItem value={level} key={level}>
                          {level}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <FieldLabel>Length</FieldLabel>
                <Select
                  value={request.length}
                  onValueChange={(length) =>
                    length &&
                    setRequest((current) => ({
                      ...current,
                      length: length as ReadingLength,
                    }))
                  }
                >
                  <SelectTrigger className="h-10 w-full bg-background">
                    <SelectValue>
                      {request.length[0].toUpperCase() +
                        request.length.slice(1)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {Object.entries(LENGTH_LABELS).map(([value, label]) => (
                      <SelectItem value={value} key={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error ? (
                <p
                  className="text-xs leading-5 text-destructive sm:col-span-2"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </div>

            <DialogFooter className="mx-0 mb-0 rounded-b-xl px-5 sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setGenerateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-current/25 border-t-current" />
                ) : (
                  <Sparkles />
                )}
                Generate text
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader className="border-b border-border px-5 py-5">
            <SheetTitle>Ask about the text</SheetTitle>
            <SheetDescription>
              English explanations, with Dutch examples when useful.
            </SheetDescription>
          </SheetHeader>
          {selection ? (
            <div className="mx-5 rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
              Selected: “{selection}”
            </div>
          ) : null}
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-2">
            {!chatMessages.length ? (
              <p className="py-8 text-center text-sm leading-6 text-muted-foreground">
                Ask about a word, grammar, or passage. The conversation stays in
                this session.
              </p>
            ) : null}
            {chatMessages.map((message) =>
              message.role === 'user' ? (
                <div
                  key={message.id}
                  className="ml-10 rounded-xl bg-primary px-3.5 py-2.5 text-sm leading-6 text-primary-foreground"
                >
                  {message.selection ? (
                    <p className="mb-1 border-b border-primary-foreground/20 pb-1 text-xs opacity-75">
                      “{message.selection}”
                    </p>
                  ) : null}
                  {message.text}
                </div>
              ) : (
                <div
                  key={message.id}
                  className="mr-6 rounded-xl border border-border bg-background px-3.5 py-3 text-sm leading-6"
                >
                  <p>{message.answer.answer}</p>
                  {message.answer.exampleNl ? (
                    <div className="mt-2 border-t border-border pt-2 text-xs">
                      <p>{message.answer.exampleNl}</p>
                      <p className="text-muted-foreground">
                        {message.answer.exampleEn}
                      </p>
                    </div>
                  ) : null}
                </div>
              ),
            )}
            {chatLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-3 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />{' '}
                Thinking…
              </div>
            ) : null}
          </div>
          <form className="border-t border-border p-4" onSubmit={sendChat}>
            <Textarea
              className="min-h-20 resize-none"
              placeholder="What does this mean?"
              value={chatQuestion}
              onChange={(event) => setChatQuestion(event.target.value)}
            />
            <div className="mt-2 flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={!story || !chatQuestion.trim() || chatLoading}
              >
                <Send /> Send
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </main>
  );
}

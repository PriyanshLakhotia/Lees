async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

export const api = {
  listStories: () =>
    requestJson<{ stories: import('./contracts').StorySummary[] }>(
      '/api/stories',
    ),
  getStory: (id: string) =>
    requestJson<{ story: import('./contracts').Story }>(`/api/stories/${id}`),
  updateStory: (
    id: string,
    patch: { read?: boolean; favourite?: boolean; notes?: string },
  ) =>
    requestJson<{ story: import('./contracts').Story }>(`/api/stories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  listJobs: () =>
    requestJson<{ jobs: import('./contracts').GenerationJob[] }>('/api/jobs'),
  generate: (request: import('./contracts').GenerationRequest) =>
    requestJson<{ job: import('./contracts').GenerationJob }>(
      '/api/generations',
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
    ),
  chat: (storyId: string, question: string, selection: string) =>
    requestJson<{ answer: import('./contracts').ChatAnswer }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ storyId, question, selection }),
    }),
};

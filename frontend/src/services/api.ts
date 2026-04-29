import type {
  PaperLibrary,
  Paper,
  Idea,
  Task,
  TaskReference,
  Experiment,
  EvolutionLog,
  Conversation,
  ConversationMessage,
  WeekInfo,
  LLMConfig,
  Skill,
  LLMProvider,
  PaperNote,
} from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...(options?.body ? { headers: { 'Content-Type': 'application/json' } } : {}),
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export const api = {
  libraries: {
    list: () => request<PaperLibrary[]>('/libraries'),
    create: (data: { name: string; domain_description: string }) =>
      request<PaperLibrary>('/libraries', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<PaperLibrary>) =>
      request<PaperLibrary>(`/libraries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<{ ok: boolean }>(`/libraries/${id}`, { method: 'DELETE' }),
  },

  papers: {
    list: (libraryId: number, page = 1, size = 20) =>
      request<Paper[]>(`/papers?library_id=${libraryId}&page=${page}&size=${size}`),
    get: (id: number) => request<Paper>(`/papers/${id}`),
    import: (libraryId: number, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return request<{ id: number; title: string }>(`/papers/import?library_id=${libraryId}`, {
        method: 'POST',
        headers: {},
        body: formData,
      });
    },
    download: (id: number) => request<{ status: string }>(`/papers/${id}/download`, { method: 'POST' }),
    markRead: (id: number, libraryId: number) =>
      request<{ ok: boolean }>(`/papers/${id}/read?library_id=${libraryId}`, { method: 'POST' }),
    markInterest: (id: number, libraryId: number) =>
      request<{ ok: boolean }>(`/papers/${id}/interest?library_id=${libraryId}`, { method: 'POST' }),
    delete: (id: number) => request<{ ok: boolean }>(`/papers/${id}`, { method: 'DELETE' }),
  },

  timeline: {
    get: (libraryId: number) => request<WeekInfo[]>(`/timeline?library_id=${libraryId}`),
    getWeek: (week: string, libraryId: number) =>
      request<Paper[]>(`/timeline/week/${week}?library_id=${libraryId}`),
  },

  weeklyReports: {
    list: (libraryId: number) => request<[]>(`/weekly-reports?library_id=${libraryId}`),
    generate: (week: string, libraryId: number, force = false) =>
      request<{ week: string; report: string; created_at: string }>(`/weekly-reports/${week}?library_id=${libraryId}${force ? '&force=true' : ''}`, { method: 'POST' }),
  },

  search: {
    onDemand: (taskDescription: string, days = 3, maxPapers = 10) =>
      request<{ papers: unknown[] }>('/papers/search', { method: 'POST', body: JSON.stringify({ task_description: taskDescription, days, max_papers: maxPapers }) }),
    optimizeQuery: (query: string) =>
      request<{ optimized_query: string }>('/papers/optimize-query', { method: 'POST', body: JSON.stringify({ query }) }),
    semantic: (query: string, libraryId: number, topK = 5) =>
      request<{ papers: { id: number; title: string; authors: string[]; abstract: string; structured_summary: string }[] }>('/papers/semantic-search', { method: 'POST', body: JSON.stringify({ query, library_id: libraryId, top_k: topK }) }),
  },

  ideas: {
    list: () => request<Idea[]>('/ideas'),
    create: (data: { title: string; content?: string }) =>
      request<Idea>('/ideas', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: number) => request<Idea>(`/ideas/${id}`),
    update: (id: number, data: Partial<Idea>) =>
      request<Idea>(`/ideas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: (id: number, status: string) =>
      request<Idea>(`/ideas/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    addRefPaper: (id: number, paperId: number) =>
      request<{ ok: boolean }>(`/ideas/${id}/ref-paper`, { method: 'POST', body: JSON.stringify({ paper_id: paperId }) }),
    delete: (id: number) => request<{ ok: boolean }>(`/ideas/${id}`, { method: 'DELETE' }),
  },

  tasks: {
    list: () => request<Task[]>('/tasks'),
    create: (data: { name: string; source_idea_id: number }) =>
      request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: number) => request<Task>(`/tasks/${id}`),
    delete: (id: number) => request<{ ok: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
    references: (id: number) => request<TaskReference[]>(`/tasks/${id}/references`),
    addReference: (id: number, paperId: number) =>
      request<{ ok: boolean; message?: string }>(`/tasks/${id}/references`, { method: 'POST', body: JSON.stringify({ paper_id: paperId }) }),
    removeReference: (id: number, paperId: number) =>
      request<{ ok: boolean }>(`/tasks/${id}/references/${paperId}`, { method: 'DELETE' }),
    generateBibtex: (id: number, paperId: number) =>
      request<{ bibtex: string }>(`/tasks/${id}/references/${paperId}/bibtex`, { method: 'POST' }),
    recommendTags: (id: number, paperId: number) =>
      request<{ tags: string[] }>(`/tasks/${id}/references/${paperId}/tags`, { method: 'POST' }),
    getResearch: (id: number) => request<{ content: string }>(`/tasks/${id}/research`),
    saveResearch: (id: number, content: string) =>
      request<{ ok: boolean }>(`/tasks/${id}/research`, { method: 'PUT', body: JSON.stringify({ content }) }),
    getReview: (id: number) => request<{ content: string }>(`/tasks/${id}/review`),
    saveReview: (id: number, content: string) =>
      request<{ ok: boolean }>(`/tasks/${id}/review`, { method: 'PUT', body: JSON.stringify({ content }) }),
    getMethod: (id: number) => request<{ content: string }>(`/tasks/${id}/method`),
    saveMethod: (id: number, content: string) =>
      request<{ ok: boolean }>(`/tasks/${id}/method`, { method: 'PUT', body: JSON.stringify({ content }) }),
    getPolish: (id: number) => request<{ content: string }>(`/tasks/${id}/polish`),
    savePolish: (id: number, content: string) =>
      request<{ ok: boolean }>(`/tasks/${id}/polish`, { method: 'PUT', body: JSON.stringify({ content }) }),
    uploadPolishDocx: (id: number, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return request<{ content: string; filename: string }>(`/tasks/${id}/polish/upload-docx`, {
        method: 'POST',
        headers: {},
        body: formData,
      });
    },
    generateResearch: (id: number) =>
      request<{ ok: boolean; content?: string; message?: string }>(`/tasks/${id}/generate-research`, { method: 'POST' }),
    conversations: (id: number) => request<Conversation[]>(`/tasks/${id}/conversations`),
    experiments: (id: number) => request<Experiment[]>(`/tasks/${id}/experiments`),
    uploadExperiment: (id: number, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return request<{ id: number }>(`/tasks/${id}/experiments`, {
        method: 'POST',
        headers: {},
        body: formData,
      });
    },
    analyzeExperiment: (id: number, expId: number) =>
      request<{ report: string }>(`/tasks/${id}/experiments/${expId}/analyze`, { method: 'POST' }),
    getExperiment: (id: number, expId: number) =>
      request<{ id: number; log_content: string; analysis_report: string; filename: string }>(`/tasks/${id}/experiments/${expId}`),
    deleteExperiment: (id: number, expId: number) =>
      request<{ ok: boolean }>(`/tasks/${id}/experiments/${expId}`, { method: 'DELETE' }),
    promptDocs: (id: number) => request<{ filename: string; content: string }[]>(`/tasks/${id}/prompt-docs`),
    exportDoc: (id: number, docType: string) => {
      const a = document.createElement('a');
      a.href = `/api/tasks/${id}/export/${docType}`;
      a.download = `${docType}_${id}.md`;
      a.click();
    },
    exportPromptDoc: (id: number, filename: string) => {
      const a = document.createElement('a');
      a.href = `/api/tasks/${id}/export-prompt-doc/${encodeURIComponent(filename)}`;
      a.download = filename;
      a.click();
    },
  },

  conversations: {
    messages: (id: number) => request<ConversationMessage[]>(`/conversations/${id}/messages`),
    delete: (id: number) => request<{ ok: boolean }>(`/conversations/${id}`, { method: 'DELETE' }),
  },

  evolution: {
    list: () => request<EvolutionLog[]>('/evolution-logs'),
    delete: (id: number) => request<{ ok: boolean }>(`/evolution-logs/${id}`, { method: 'DELETE' }),
    confirm: (id: number) => request<{ ok: boolean }>(`/evolution-logs/${id}/confirm`, { method: 'POST' }),
    rollback: (id: number) => request<{ ok: boolean }>(`/evolution-logs/${id}/rollback`, { method: 'POST' }),
  },

  operationLogs: {
    list: (page = 1) => request<unknown[]>(`/operation-logs?page=${page}`),
  },

  providers: {
    list: () => request<LLMProvider[]>('/providers'),
    create: (data: { name: string; base_url: string; api_key: string; model: string; max_context_tokens?: number; extra_body?: Record<string, unknown> }) =>
      request<{ id: number; name: string }>('/providers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<LLMProvider>) =>
      request<{ ok: boolean }>(`/providers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<{ ok: boolean }>(`/providers/${id}`, { method: 'DELETE' }),
    activate: (id: number) => request<{ ok: boolean }>(`/providers/${id}/activate`, { method: 'POST' }),
    test: (id: number) => request<{ ok: boolean; error?: string }>(`/providers/${id}/test`, { method: 'POST' }),
  },

  config: {
    get: () => request<LLMConfig>('/config/llm'),
    update: (data: { llm: Partial<LLMConfig['llm']>; features?: Partial<LLMConfig['features']> }) =>
      request<{ ok: boolean }>('/config/llm', { method: 'PUT', body: JSON.stringify(data) }),
  },

  skills: {
    list: () => request<Skill[]>('/skills'),
    get: (name: string) => request<Skill>(`/skills/${name}`),
    update: (name: string, content: string) =>
      request<{ ok: boolean }>(`/skills/${name}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  },

  notes: {
    list: (page = 1, size = 20) => request<PaperNote[]>(`/notes?page=${page}&size=${size}`),
    get: (id: number) => request<PaperNote>(`/notes/${id}`),
    create: (paperId: number, content: string) =>
      request<{ ok: boolean; id: number }>(`/notes?paper_id=${paperId}`, { method: 'POST', body: JSON.stringify({ content }) }),
    delete: (id: number) => request<{ ok: boolean }>(`/notes/${id}`, { method: 'DELETE' }),
    optimize: (content: string, paperTitle: string) =>
      request<{ optimized_note: string }>('/notes/optimize', { method: 'POST', body: JSON.stringify({ content, paper_title: paperTitle }) }),
  },
};

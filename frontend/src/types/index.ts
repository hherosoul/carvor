export interface PaperLibrary {
  id: number;
  name: string;
  domain_description: string;
  created_at: string;
}

export interface Paper {
  id: number;
  title: string;
  authors: string[];
  institution: string;
  abstract: string;
  structured_summary: string;
  source: 'llm_search' | 'manual';
  published_date: string;
  source_url: string;
  pdf_path?: string;
  deep_reading_summary?: string;
  is_read?: number;
  is_interested?: number;
}

export interface Idea {
  id: number;
  title: string;
  content?: string;
  status: '锤炼中' | '已放弃' | '已暂停' | '已立项';
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  name: string;
  research_goal?: string;
  source_idea_id?: number;
  idea_content?: string;
  created_at: string;
}

export interface TaskReference {
  paper_id: number;
  title: string;
  authors: string[];
  bibtex?: string;
  tags?: string;
}

export interface Experiment {
  id: number;
  log_path: string;
  filename?: string;
  analysis_report?: string;
  created_at: string;
}

export interface EvolutionLog {
  id: number;
  content: string;
  source?: string;
  dimension: string;
  level: number;
  skill_name: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  scenario: string;
  created_at: string;
}

export interface ConversationMessage {
  id: number;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WeekInfo {
  week: string;
  count: number;
  start: string;
  end: string;
  full_start: string;
  full_end: string;
}

export interface LLMConfig {
  config_version: number;
  llm: {
    base_url: string;
    api_key: string;
    model: string;
    max_context_tokens: number;
    extra_body?: Record<string, unknown>;
  };
  features: {
    web_search_tool_name: string;
    daily_search_time: string;
    compress_threshold: number;
  };
}

export interface Skill {
  name: string;
  content: string;
}

export interface LLMProvider {
  id: number;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  max_context_tokens: number;
  extra_body?: Record<string, unknown>;
  is_active: number;
  created_at: string;
}

export interface PaperNote {
  id: number;
  paper_id: number;
  paper_title: string;
  content: string;
  created_at: string;
}

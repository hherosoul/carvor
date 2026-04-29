import { create } from 'zustand';
import type { ChatMessage } from '../types';

export type ChatScenario =
  | 'deep_reading'
  | 'idea_refine'
  | 'review'
  | 'method'
  | 'prompt_doc'
  | 'polish'
  | null;

interface ChatContext {
  scenario: ChatScenario;
  entityId: number | null;
  entityTitle: string;
  existingContent: string;
}

export interface AppStore {
  currentLibraryId: number | null;
  currentTaskId: number | null;
  currentConversationId: number | null;
  leftNavCollapsed: boolean;
  chatHistory: ChatMessage[];
  chatContext: ChatContext;
  chatSending: boolean;
  ideaChatResult: string;
  setCurrentLibrary: (id: number | null) => void;
  setCurrentTask: (id: number | null) => void;
  setCurrentConversation: (id: number | null) => void;
  toggleLeftNav: () => void;
  openChatPanel: () => void;
  appendChatMessage: (msg: ChatMessage) => void;
  updateLastAssistantMessage: (chunk: string) => void;
  clearChatHistory: () => void;
  setChatContext: (ctx: Partial<ChatContext>) => void;
  setChatSending: (sending: boolean) => void;
  setIdeaChatResult: (content: string) => void;
  consumeIdeaChatResult: () => string;
}

export const useAppStore = create<AppStore>((set) => ({
  currentLibraryId: null,
  currentTaskId: null,
  currentConversationId: null,
  leftNavCollapsed: false,
  chatHistory: [],
  chatContext: { scenario: null, entityId: null, entityTitle: '', existingContent: '' },
  chatSending: false,
  ideaChatResult: '',
  setCurrentLibrary: (id) => set({ currentLibraryId: id }),
  setCurrentTask: (id) => set({ currentTaskId: id }),
  setCurrentConversation: (id) => set({ currentConversationId: id }),
  toggleLeftNav: () => set((s) => ({ leftNavCollapsed: !s.leftNavCollapsed })),
  openChatPanel: () => {},
  appendChatMessage: (msg) => set((s) => ({ chatHistory: [...s.chatHistory, msg] })),
  updateLastAssistantMessage: (chunk) =>
    set((s) => {
      const history = [...s.chatHistory];
      const lastIdx = history.length - 1;
      if (lastIdx >= 0 && history[lastIdx].role === 'assistant') {
        history[lastIdx] = { ...history[lastIdx], content: history[lastIdx].content + chunk };
        return { chatHistory: history };
      }
      return { chatHistory: [...history, { role: 'assistant', content: chunk }] };
    }),
  clearChatHistory: () => set({ chatHistory: [] }),
  setChatContext: (ctx) =>
    set((s) => ({ chatContext: { ...s.chatContext, ...ctx } })),
  setChatSending: (sending) => set({ chatSending: sending }),
  setIdeaChatResult: (content) => set({ ideaChatResult: content }),
  consumeIdeaChatResult: () => {
    const state = { result: '' };
    set((s) => {
      state.result = s.ideaChatResult;
      return { ideaChatResult: '' };
    });
    return state.result;
  },
}));

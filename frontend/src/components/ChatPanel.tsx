import React, { useRef, useEffect, useState } from 'react';
import { Input, Button, Space, Typography, Spin, Select, Upload, message, Modal, Form } from 'antd';
import { SendOutlined, CloseOutlined, PaperClipOutlined, DeleteOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import { useAppStore, type ChatScenario } from '../stores/appStore';
import { useChatStream } from '../hooks/useChatStream';
import ReactMarkdown from 'react-markdown';

const { TextArea } = Input;
const { Text } = Typography;

const scenarioLabels: Record<NonNullable<ChatScenario>, string> = {
  deep_reading: '深度阅读',
  idea_refine: 'Idea 锤炼',
  review: '综述讨论',
  method: '方法讨论',
  prompt_doc: '提示词文档',
  polish: '论文润色',
};

interface PresetModel {
  name: string;
  base_url: string;
  model: string;
}

interface SavedModel {
  id: string;
  name: string;
  base_url: string;
  model: string;
  api_key: string;
}

const STORAGE_KEY = 'carvor_saved_idea_models';

function loadSavedModels(): SavedModel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSavedModels(models: SavedModel[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
}

export const ChatPanel: React.FC = () => {
  const { chatHistory, chatContext, chatSending, clearChatHistory, appendChatMessage, updateLastAssistantMessage, setChatContext, setChatSending, setCurrentConversation, setIdeaChatResult } = useAppStore();
  const { sendChat } = useChatStream();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [presetModels, setPresetModels] = useState<PresetModel[]>([]);
  const [savedModels, setSavedModels] = useState<SavedModel[]>(loadSavedModels());
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<SavedModel | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (chatContext.scenario) {
      fetch('/api/chat/preset-models').then(r => r.json()).then(setPresetModels).catch(() => {});
    }
  }, [chatContext.scenario]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const getSelectedModel = (): SavedModel | null => {
    if (!selectedModelId) return null;
    return savedModels.find(m => m.id === selectedModelId) || null;
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const { scenario, entityId, existingContent } = chatContext;

    if (selectedModelId) {
      handleCustomModelSend();
      return;
    }

    appendChatMessage({ role: 'user', content: input });
    appendChatMessage({ role: 'assistant', content: '' });

    if (scenario && entityId) {
      sendChat(scenario, {
        entity_id: entityId,
        user_input: input,
        conversation_id: useAppStore.getState().currentConversationId,
        existing_content: existingContent || '',
      });
    }

    setInput('');
  };

  const handleCustomModelSend = async () => {
    if (!input.trim()) return;

    const model = getSelectedModel();
    if (!model) return;

    appendChatMessage({ role: 'user', content: input });
    appendChatMessage({ role: 'assistant', content: '' });
    setChatSending(true);

    try {
      const formData = new FormData();
      formData.append('user_input', input);
      formData.append('custom_base_url', model.base_url);
      formData.append('custom_api_key', model.api_key);
      formData.append('custom_model', model.model);
      attachedFiles.forEach(f => formData.append('files', f));

      const res = await fetch('/api/chat/custom-stream', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || res.statusText);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              if (currentEvent === 'chunk' && data.content) {
                updateLastAssistantMessage(data.content);
              } else if (currentEvent === 'done') {
                const finalContent = useAppStore.getState().chatHistory;
                const lastAssistant = [...finalContent].reverse().find(m => m.role === 'assistant');
                if (lastAssistant?.content && chatContext.scenario === 'idea_refine') {
                  setIdeaChatResult(lastAssistant.content);
                }
              } else if (currentEvent === 'error') {
                updateLastAssistantMessage(`\n[Error: ${data.message || 'Unknown error'}]`);
              }
            } catch {
              // ignore parse errors
            }
            currentEvent = '';
          }
        }
      }

      const finalHistory = useAppStore.getState().chatHistory;
      const lastAssistant = [...finalHistory].reverse().find(m => m.role === 'assistant');
      if (lastAssistant?.content && chatContext.scenario === 'idea_refine' && !lastAssistant.content.includes('[Error:')) {
        setIdeaChatResult(lastAssistant.content);
      }
    } catch (err: unknown) {
      updateLastAssistantMessage(`\n[Error: ${err instanceof Error ? err.message : 'Unknown error'}]`);
    } finally {
      setChatSending(false);
    }

    setInput('');
    setAttachedFiles([]);
  };

  const handleClose = () => {
    clearChatHistory();
    setChatContext({ scenario: null, entityId: null, entityTitle: '', existingContent: '' });
    setSelectedModelId(null);
    setAttachedFiles([]);
  };

  const handleFileSelect = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['docx', 'pdf', 'txt', 'md'].includes(ext || '')) {
      message.warning('仅支持 docx, pdf, txt, md 格式');
      return false;
    }
    setAttachedFiles(prev => [...prev, file]);
    return false;
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddModel = () => {
    setEditingModel(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEditModel = (model: SavedModel) => {
    setEditingModel(model);
    form.setFieldsValue({
      name: model.name,
      base_url: model.base_url,
      model: model.model,
      api_key: '',
    });
    setModalOpen(true);
  };

  const handleDeleteModel = (modelId: string) => {
    const updated = savedModels.filter(m => m.id !== modelId);
    setSavedModels(updated);
    saveSavedModels(updated);
    if (selectedModelId === modelId) {
      setSelectedModelId(null);
    }
  };

  const handleSaveModel = async () => {
    const values = await form.validateFields();
    if (editingModel) {
      const updated = savedModels.map(m =>
        m.id === editingModel.id
          ? { ...m, name: values.name, base_url: values.base_url, model: values.model, ...(values.api_key ? { api_key: values.api_key } : {}) }
          : m
      );
      setSavedModels(updated);
      saveSavedModels(updated);
      message.success('模型已更新');
    } else {
      const newModel: SavedModel = {
        id: Date.now().toString(),
        name: values.name,
        base_url: values.base_url,
        model: values.model,
        api_key: values.api_key,
      };
      const updated = [...savedModels, newModel];
      setSavedModels(updated);
      saveSavedModels(updated);
      setSelectedModelId(newModel.id);
      message.success('模型已添加');
    }
    setModalOpen(false);
    form.resetFields();
    setEditingModel(null);
  };

  const handlePresetSelect = (presetIndex: number) => {
    const preset = presetModels[presetIndex];
    setEditingModel(null);
    form.resetFields();
    form.setFieldsValue({
      name: preset.name,
      base_url: preset.base_url,
      model: preset.model,
    });
    setModalOpen(true);
  };

  const title = chatContext.scenario
    ? scenarioLabels[chatContext.scenario as NonNullable<ChatScenario>]
    : 'AI 对话';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text strong>{title}</Text>
        <Space size="small">
          <Button size="small" type="text" onClick={clearChatHistory}>
            清空
          </Button>
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={handleClose} />
        </Space>
      </div>

      {chatContext.entityTitle && (
        <div
          style={{
            padding: '6px 16px',
            background: '#f6f8fa',
            borderBottom: '1px solid #f0f0f0',
            fontSize: 12,
            color: '#666',
          }}
        >
          {chatContext.entityTitle}
        </div>
      )}

      {chatContext.scenario && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
          <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>自定义模型</Text>
            <Button size="small" type="link" icon={<PlusOutlined />} onClick={handleAddModel}>
              添加
            </Button>
          </div>

          {savedModels.length > 0 && (
            <Select
              placeholder="选择已保存的模型..."
              allowClear
              style={{ width: '100%', marginBottom: 6 }}
              value={selectedModelId}
              onChange={(v) => setSelectedModelId(v ?? null)}
              options={savedModels.map(m => ({
                label: (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span>{m.name} ({m.model})</span>
                    <Space size={2} onClick={(e) => e.stopPropagation()}>
                      <EditOutlined style={{ fontSize: 12, color: '#999' }} onClick={() => handleEditModel(m)} />
                      <DeleteOutlined style={{ fontSize: 12, color: '#999' }} onClick={() => handleDeleteModel(m.id)} />
                    </Space>
                  </div>
                ),
                value: m.id,
              }))}
            />
          )}

          {presetModels.length > 0 && savedModels.length === 0 && (
            <div style={{ marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>快速添加：</Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {presetModels.map((p, i) => (
                  <Button key={i} size="small" onClick={() => handlePresetSelect(i)}>
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {!selectedModelId && (
            <Text type="secondary" style={{ fontSize: 11 }}>未选择自定义模型时，使用系统默认模型</Text>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {chatHistory.length === 0 && (
          <div style={{ color: '#bbb', textAlign: 'center', marginTop: 40 }}>
            在主内容区操作后，在此处与AI对话
          </div>
        )}
        {chatHistory.map((msg: { role: string; content: string }, idx: number) => (
          <div
            key={idx}
            style={{
              marginBottom: 12,
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: 8,
                background: msg.role === 'user' ? '#1677ff' : '#f5f5f5',
                color: msg.role === 'user' ? '#fff' : '#333',
              }}
            >
              {msg.role === 'assistant' ? (
                msg.content ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  <Spin size="small" />
                )
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {chatSending && chatHistory.length > 0 && chatHistory[chatHistory.length - 1]?.role === 'assistant' && !chatHistory[chatHistory.length - 1]?.content && (
          <div style={{ textAlign: 'center', color: '#999', fontSize: 12, marginTop: 4 }}>
            AI 正在思考...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {attachedFiles.length > 0 && (
        <div style={{ padding: '4px 12px', borderTop: '1px solid #f0f0f0' }}>
          {attachedFiles.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#666', marginBottom: 2 }}>
              <PaperClipOutlined />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <DeleteOutlined style={{ cursor: 'pointer', color: '#999' }} onClick={() => removeFile(i)} />
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: 12, borderTop: '1px solid #f0f0f0' }}>
        <Space.Compact style={{ width: '100%' }}>
          {chatContext.scenario && (
            <Upload beforeUpload={handleFileSelect} showUploadList={false} accept=".docx,.pdf,.txt,.md" multiple>
              <Button icon={<PaperClipOutlined />} />
            </Upload>
          )}
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              chatContext.scenario
                ? `输入关于${scenarioLabels[chatContext.scenario as NonNullable<ChatScenario>]}的问题...`
                : '输入消息...'
            }
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={handleSend} loading={chatSending} />
        </Space.Compact>
      </div>

      <Modal
        title={editingModel ? '编辑模型' : '添加模型'}
        open={modalOpen}
        onOk={handleSaveModel}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditingModel(null); }}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：DeepSeek" />
          </Form.Item>
          <Form.Item name="base_url" label="API Base URL" rules={[{ required: true }]}>
            <Input placeholder="https://api.deepseek.com/v1" />
          </Form.Item>
          <Form.Item name="api_key" label="API Key" rules={editingModel ? [] : [{ required: true, message: '请输入API Key' }]}>
            <Input.Password placeholder={editingModel ? '留空则不修改' : 'sk-...'} />
          </Form.Item>
          <Form.Item name="model" label="模型名称" rules={[{ required: true }]}>
            <Input placeholder="deepseek-chat" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

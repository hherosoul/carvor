import React, { useEffect, useState, useRef } from 'react';
import { Typography, Card, Tag, Button, Space, message, Input } from 'antd';
import { DeleteOutlined, RocketOutlined, SaveOutlined, EditOutlined, ExportOutlined, EyeOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { confirmDelete, confirmAction } from '../utils/confirm';
import type { Idea } from '../types';
import ReactMarkdown from 'react-markdown';

const { Title } = Typography;

export const IdeaDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setChatContext, openChatPanel, clearChatHistory, ideaChatResult, consumeIdeaChatResult } = useAppStore();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const prevResultRef = useRef('');

  useEffect(() => {
    if (!id) return;
    api.ideas.get(Number(id)).then((data) => {
      setIdea(data);
      setEditContent(data.content || '');
      setChatContext({
        scenario: 'idea_refine',
        entityId: data.id,
        entityTitle: data.title,
      });
      openChatPanel();
    });
    return () => {
      setChatContext({ scenario: null, entityId: null, entityTitle: '' });
    };
  }, [id]);

  useEffect(() => {
    if (ideaChatResult && ideaChatResult !== prevResultRef.current && idea) {
      prevResultRef.current = ideaChatResult;
      setEditContent(ideaChatResult);
      setEditing(true);
      consumeIdeaChatResult();
    }
  }, [ideaChatResult, idea, consumeIdeaChatResult]);

  const handleApprove = async () => {
    if (!id) return;
    await api.ideas.updateStatus(Number(id), '已立项');
    message.success('已立项，正在创建任务...');
    const task = await api.tasks.create({
      name: idea?.title || 'New Task',
      source_idea_id: Number(id),
    });
    navigate(`/tasks/${task.id}`);
  };

  const handleDelete = async () => {
    if (!id) return;
    await api.ideas.delete(Number(id));
    message.success('Idea 已删除');
    navigate('/ideas');
  };

  const handleAbandon = async () => {
    if (!id) return;
    await api.ideas.updateStatus(Number(id), '已放弃');
    message.info('Idea 已弃用');
    api.ideas.get(Number(id)).then(setIdea);
  };

  const handleStartDiscussion = () => {
    clearChatHistory();
    setChatContext({
      scenario: 'idea_refine',
      entityId: Number(id),
      entityTitle: idea?.title || '',
    });
    openChatPanel();
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.ideas.update(Number(id), { content: editContent });
      setIdea(prev => prev ? { ...prev, content: editContent } : prev);
      setEditing(false);
      message.success('内容已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const content = editing ? editContent : (idea?.content || '');
    if (!content) {
      message.warning('暂无内容可导出');
      return;
    }
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${idea?.title || 'idea'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!idea) return null;

  const isApproved = idea.status === '已立项';
  const isAbandoned = idea.status === '已放弃';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Title level={4} style={{ margin: 0 }}>{idea.title}</Title>
          <Tag color={isApproved ? 'green' : isAbandoned ? 'default' : 'blue'}>
            {isApproved ? '已立项' : isAbandoned ? '已放弃' : '锤炼中'}
          </Tag>
        </Space>
        <Space>
          {!isApproved && !isAbandoned && (
            <>
              <Button type="primary" icon={<RocketOutlined />} onClick={handleApprove}>
                立项
              </Button>
              <Button danger icon={<DeleteOutlined />} onClick={() => confirmAction('确定弃用此 Idea？', '弃用后仍可查看，但不再继续锤炼', handleAbandon, '确定弃用')}>
                弃用
              </Button>
            </>
          )}
          <Button danger onClick={() => confirmDelete('确定删除此 Idea？', handleDelete)}>
            删除
          </Button>
          <Button type="primary" onClick={handleStartDiscussion}>
            与AI讨论
          </Button>
        </Space>
      </div>

      <Card
        extra={
          <Space>
            {editing ? (
              <>
                <Button size="small" icon={<EyeOutlined />} onClick={() => setEditing(false)}>
                  预览
                </Button>
                <Button size="small" type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
                  保存
                </Button>
              </>
            ) : (
              <>
                <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(true)}>
                  编辑
                </Button>
                <Button size="small" icon={<ExportOutlined />} onClick={handleExport}>
                  导出
                </Button>
              </>
            )}
          </Space>
        }
      >
        <div style={{ minHeight: 400 }}>
          {editing ? (
            <Input.TextArea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              autoSize={{ minRows: 16, maxRows: 40 }}
              style={{ fontFamily: 'monospace' }}
            />
          ) : (
            <ReactMarkdown>
              {editContent || '*暂无内容，点击"与AI讨论"开始锤炼你的idea*'}
            </ReactMarkdown>
          )}
        </div>
      </Card>
    </div>
  );
};

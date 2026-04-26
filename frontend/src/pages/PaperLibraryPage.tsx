import React, { useEffect, useState } from 'react';
import { Table, Typography, Button, Space, Modal, Tag, Spin, Empty, message } from 'antd';
import { DeleteOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import { useAppStore } from '../stores/appStore';
import { api } from '../services/api';
import { confirmDelete } from '../utils/confirm';
import type { Paper } from '../types';

const { Title, Text } = Typography;

export const PaperLibraryPage: React.FC = () => {
  const { currentLibraryId } = useAppStore();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewPaper, setViewPaper] = useState<Paper | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Paper[]>([]);

  const loadPapers = () => {
    if (!currentLibraryId) return;
    setLoading(true);
    api.papers
      .list(currentLibraryId, 1, 100)
      .then(setPapers)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPapers();
  }, [currentLibraryId]);

  const handleDelete = async (paperId: number) => {
    await api.papers.delete(paperId);
    message.success('论文已删除');
    loadPapers();
  };

  const handleView = async (paperId: number) => {
    const paper = await api.papers.get(paperId);
    setViewPaper(paper);
  };

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim() || !currentLibraryId) return;
    setSearching(true);
    try {
      const result = await api.search.semantic(searchQuery, currentLibraryId);
      setSearchResults(result.papers as Paper[]);
    } catch (err: unknown) {
      message.error(`搜索失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setSearching(false);
    }
  };

  if (!currentLibraryId) {
    return <Empty description="正在初始化论文库..." />;
  }

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      width: '30%',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '作者',
      dataIndex: 'authors',
      key: 'authors',
      width: '18%',
      ellipsis: true,
      render: (authors: string[]) => Array.isArray(authors) ? authors.join(', ') : String(authors || ''),
    },
    {
      title: '关键词',
      dataIndex: 'keywords',
      key: 'keywords',
      width: '22%',
      render: (keywords: string[]) => {
        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) return <Text type="secondary">-</Text>;
        return (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {keywords.slice(0, 3).map((k, i) => (
              <Tag key={i} style={{ margin: 0, fontSize: 11 }}>{k}</Tag>
            ))}
            {keywords.length > 3 && <Tag style={{ margin: 0, fontSize: 11 }}>+{keywords.length - 3}</Tag>}
          </span>
        );
      },
    },
    {
      title: '导入时间',
      dataIndex: 'published_date',
      key: 'published_date',
      width: '12%',
      render: (date: string) => date ? date.substring(0, 10) : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, record: Paper) => (
        <Space size={4}>
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => handleView(record.id)} style={{ padding: 0 }}>
            查看
          </Button>
          <Button size="small" type="link" danger icon={<DeleteOutlined />} style={{ padding: 0 }} onClick={() => confirmDelete('确定删除此论文？', () => handleDelete(record.id))}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>论文库</Title>
        <Button icon={<SearchOutlined />} onClick={() => setSearchOpen(true)}>
          语义搜索
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={papers}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        size="middle"
        scroll={{ x: 800 }}
      />

      <Modal
        title={viewPaper?.title}
        open={!!viewPaper}
        onCancel={() => setViewPaper(null)}
        footer={null}
        width={700}
      >
        {viewPaper && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">作者：</Text>
              <Text>{Array.isArray(viewPaper.authors) ? viewPaper.authors.join(', ') : viewPaper.authors}</Text>
            </div>
            {viewPaper.institution && (
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">机构：</Text>
                <Text>{viewPaper.institution}</Text>
              </div>
            )}
            {(viewPaper as any).keywords && Array.isArray((viewPaper as any).keywords) && (viewPaper as any).keywords.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">关键词：</Text>
                <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
                  {(viewPaper as any).keywords.map((k: string, i: number) => (
                    <Tag key={i} color="blue">{k}</Tag>
                  ))}
                </span>
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <Tag color={viewPaper.source === 'llm_search' ? 'blue' : 'green'}>
                {viewPaper.source === 'llm_search' ? 'LLM搜索' : '手动导入'}
              </Tag>
              {viewPaper.published_date && <Tag>{viewPaper.published_date}</Tag>}
            </div>
            {viewPaper.abstract && (
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" strong>摘要</Text>
                <div style={{ marginTop: 4, color: '#444', lineHeight: 1.8 }}>{viewPaper.abstract}</div>
              </div>
            )}
            {viewPaper.source_url && (
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" strong>来源</Text>
                <div style={{ marginTop: 4 }}>
                  <a href={viewPaper.source_url} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>
                    {viewPaper.source_url}
                  </a>
                </div>
              </div>
            )}
            {viewPaper.deep_reading_summary && (
              <div>
                <Text type="secondary" strong>深度阅读总结</Text>
                <div style={{ marginTop: 4, color: '#444', lineHeight: 1.8 }}>{viewPaper.deep_reading_summary}</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="语义搜索论文库"
        open={searchOpen}
        onCancel={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); }}
        footer={null}
        width={600}
      >
        <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
          <input
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: '6px 0 0 6px',
              outline: 'none',
              fontSize: 14,
            }}
            placeholder="例如：我记得有一个GNN研究DTA的论文..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSemanticSearch(); }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSemanticSearch} loading={searching}>
            搜索
          </Button>
        </Space.Compact>
        {searchResults.length > 0 && (
          <div>
            <Text type="secondary">找到 {searchResults.length} 篇相关论文：</Text>
            {searchResults.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: '10px 12px',
                  border: '1px solid #f0f0f0',
                  borderRadius: 6,
                  marginTop: 8,
                  cursor: 'pointer',
                }}
                onClick={() => { handleView(p.id); setSearchOpen(false); }}
              >
                <Text strong>{p.title}</Text>
                <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
                  {Array.isArray(p.authors) ? p.authors.join(', ') : p.authors}
                </div>
              </div>
            ))}
          </div>
        )}
        {searchResults.length === 0 && searchQuery && !searching && (
          <Empty description="未找到相关论文" />
        )}
      </Modal>
    </div>
  );
};

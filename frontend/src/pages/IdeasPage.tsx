import React, { useEffect, useState } from 'react';
import { Card, Typography, Tag, Button, List, Modal, Form, Input, Empty, Space, message } from 'antd';
import { PlusOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { confirmDelete } from '../utils/confirm';
import type { Idea } from '../types';

const { Text, Title } = Typography;
const { TextArea } = Input;

export const IdeasPage: React.FC = () => {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadIdeas = async () => {
    const data = await api.ideas.list();
    setIdeas(data);
  };

  useEffect(() => {
    loadIdeas();
  }, []);

  const handleCreate = async () => {
    const values = await form.validateFields();
    await api.ideas.create(values);
    setCreateModalOpen(false);
    form.resetFields();
    loadIdeas();
  };

  const handleDelete = async (ideaId: number) => {
    await api.ideas.delete(ideaId);
    message.success('Idea 已删除');
    loadIdeas();
  };

  const statusColors: Record<string, string> = {
    '锤炼中': 'blue',
    '已放弃': 'default',
    '已立项': 'green',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Idea 锤炼</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          新建 Idea
        </Button>
      </div>

      {ideas.length === 0 && <Empty description="暂无 idea，点击右上角创建" />}

      <List
        grid={{ gutter: 16, xs: 1, sm: 2, md: 3 }}
        dataSource={ideas}
        renderItem={(idea) => {
          const isApproved = idea.status === '已立项';
          const isAbandoned = idea.status === '已放弃';

          return (
            <List.Item>
              <Card
                hoverable
                onClick={() => navigate(`/ideas/${idea.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text strong style={{ fontSize: 15 }}>{idea.title}</Text>
                  <Space size={4}>
                    <Tag color={statusColors[idea.status] || 'default'}>
                      {isApproved ? '已立项' : isAbandoned ? '已放弃' : '锤炼中'}
                    </Tag>
                    <CloseCircleOutlined
                      style={{ color: '#999', fontSize: 14, cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmDelete('确定删除此 Idea？', () => handleDelete(idea.id));
                      }}
                    />
                  </Space>
                </div>
                {idea.content && (
                  <div style={{ marginTop: 8, color: '#666', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {idea.content}
                  </div>
                )}
              </Card>
            </List.Item>
          );
        }}
      />

      <Modal
        title="新建 Idea"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => setCreateModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="输入 idea 标题" />
          </Form.Item>
          <Form.Item name="content" label="描述">
            <TextArea rows={4} placeholder="描述你的研究想法..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

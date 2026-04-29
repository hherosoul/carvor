import React, { useEffect, useState } from 'react';
import { Typography, Tag, Spin, Empty, Button, Upload, message, Input, Space, Modal, Form, InputNumber, Steps } from 'antd';
import { UploadOutlined, RocketOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppStore, type AppStore } from '../stores/appStore';
import { api } from '../services/api';
import type { WeekInfo } from '../types';

const { Text, Title } = Typography;
const { TextArea } = Input;

export const TimelinePage: React.FC = () => {
  const navigate = useNavigate();
  const currentLibraryId = useAppStore((s: AppStore) => s.currentLibraryId);
  const [weeks, setWeeks] = useState<WeekInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fetchModalOpen, setFetchModalOpen] = useState(false);
  const [fetchStep, setFetchStep] = useState(0);
  const [fetchProgressMsg, setFetchProgressMsg] = useState('');
  const [fetchForm] = Form.useForm();

  const loadTimeline = () => {
    if (!currentLibraryId) return;
    setLoading(true);
    api.timeline
      .get(currentLibraryId)
      .then(setWeeks)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTimeline();
  }, [currentLibraryId]);

  const handleImport = async (file: File) => {
    if (!currentLibraryId) return false;
    setImporting(true);
    const hide = message.loading('正在上传PDF文件...', 0);
    try {
      const result = await api.papers.import(currentLibraryId, file);
      hide();
      message.success(`论文已导入：${result.title}`);
      loadTimeline();
    } catch (err: unknown) {
      hide();
      message.error(`导入失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setImporting(false);
    }
    return false;
  };

  const handleOptimize = async () => {
    const query = fetchForm.getFieldValue('task_description');
    if (!query?.trim()) {
      message.warning('请先输入任务描述');
      return;
    }
    setOptimizing(true);
    try {
      const result = await api.search.optimizeQuery(query);
      fetchForm.setFieldValue('task_description', result.optimized_query);
      message.success('查询已优化');
    } catch (err: unknown) {
      message.error(`优化失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setOptimizing(false);
    }
  };

  const handleFetchPapers = async () => {
    const values = await fetchForm.validateFields();
    setFetching(true);
    setFetchStep(1);
    setFetchProgressMsg('正在搜索最新论文...');
    try {
      const result = await api.search.onDemand(values.task_description, values.days, values.max_papers);
      setFetchStep(3);
      setFetchProgressMsg('');
      const papersCount = result.papers?.length || 0;
      if (papersCount > 0) {
        message.success(`获取到 ${papersCount} 篇最新论文`);
      } else {
        message.info('未找到符合日期要求的最新论文，请尝试增加天数范围');
      }
      setTimeout(() => {
        setFetchModalOpen(false);
        fetchForm.resetFields();
        setFetchStep(0);
        loadTimeline();
      }, 500);
    } catch (err: unknown) {
      setFetchStep(-1);
      setFetchProgressMsg('');
      message.error(`获取失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setFetching(false);
    }
  };

  if (!currentLibraryId) {
    return <Empty description="正在初始化论文库..." />;
  }

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>研究时间线</Title>
        <Space>
          <Button type="primary" icon={<RocketOutlined />} onClick={() => setFetchModalOpen(true)}>
            获取最新论文
          </Button>
          <Upload
            beforeUpload={handleImport}
            showUploadList={false}
            accept=".pdf"
          >
            <Button icon={<UploadOutlined />} loading={importing}>导入PDF</Button>
          </Upload>
        </Space>
      </div>

      <div style={{ position: 'relative', paddingLeft: 24 }}>
        {weeks.length === 0 && <Empty description='暂无论文数据，点击"获取最新论文"开始' />}
        {weeks.map((w, idx) => (
          <div key={w.week} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 0 }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginRight: 16,
              minHeight: 80,
            }}>
              <div style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#1677ff',
                border: '2px solid #fff',
                boxShadow: '0 0 0 2px #1677ff',
                flexShrink: 0,
                marginTop: 12,
              }} />
              {idx < weeks.length - 1 && (
                <div style={{
                  width: 2,
                  flex: 1,
                  background: '#d9d9d9',
                  minHeight: 40,
                }} />
              )}
            </div>
            <div
              onClick={() => navigate(`/week/${w.week}`)}
              style={{
                padding: '12px 16px',
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                cursor: 'pointer',
                marginBottom: 12,
                minWidth: 200,
                background: '#fff',
                transition: 'box-shadow 0.2s, border-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(22,119,255,0.15)';
                e.currentTarget.style.borderColor = '#1677ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#e8e8e8';
              }}
            >
              <Text strong style={{ fontSize: 15 }}>{w.week}</Text>
              {w.start && w.end && (
                <Text type="secondary" style={{ fontSize: 13, marginLeft: 8 }}>
                  {w.start} ~ {w.end}
                </Text>
              )}
              <div style={{ marginTop: 4 }}>
                <Tag color="blue">{w.count} 篇论文</Tag>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        title={
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 28 }}>
            <span>获取最新论文</span>
            <Button
              size="small"
              type="primary"
              ghost
              icon={<ThunderboltOutlined />}
              onClick={handleOptimize}
              loading={optimizing}
            >
              AI优化描述
            </Button>
          </span>
        }
        open={fetchModalOpen}
        onOk={handleFetchPapers}
        onCancel={() => { setFetchModalOpen(false); fetchForm.resetFields(); setFetchStep(0); setFetchProgressMsg(''); }}
        okText="开始获取"
        confirmLoading={fetching}
        width={560}
      >
        {fetching && (
          <div style={{ marginBottom: 16 }}>
            <Steps
              current={fetchStep >= 0 ? fetchStep : 0}
              status={fetchStep === -1 ? 'error' : 'process'}
              size="small"
              items={[
                { title: '搜索论文' },
                { title: '筛选结果' },
                { title: '完成' },
              ]}
            />
            {fetchProgressMsg && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#1677ff', textAlign: 'center' }}>
                {fetchProgressMsg}
              </div>
            )}
          </div>
        )}
        <Form form={fetchForm} layout="vertical" initialValues={{ days: 3, max_papers: 10 }}>
          <Form.Item
            name="task_description"
            label="任务描述"
            rules={[{ required: true, message: '请输入任务描述' }]}
          >
            <TextArea
              rows={4}
              placeholder="描述你的研究任务和关注方向，例如：研究蛋白质结构预测中的多尺度建模方法，关注AlphaFold之后的最新进展..."
            />
          </Form.Item>
          <Space>
            <Form.Item name="days" label="获取最近天数">
              <InputNumber min={1} max={30} style={{ width: 100 }} />
            </Form.Item>
            <Form.Item name="max_papers" label="论文上限">
              <InputNumber min={1} max={10} style={{ width: 100 }} />
            </Form.Item>
          </Space>
        </Form>
        <Text type="secondary" style={{ fontSize: 12 }}>
          AI将根据你的任务描述，搜索并获取指定天数内发表的最新相关论文，自动组建研究时间线
        </Text>
      </Modal>
    </div>
  );
};

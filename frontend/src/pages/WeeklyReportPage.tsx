import React, { useEffect, useState } from 'react';
import { Typography, Card, List, Spin, Empty, Button, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { api } from '../services/api';
import { useAppStore } from '../stores/appStore';
import type { WeekInfo } from '../types';
import ReactMarkdown from 'react-markdown';

const { Title, Text } = Typography;

export const WeeklyReportPage: React.FC = () => {
  const { currentLibraryId } = useAppStore();
  const [weeks, setWeeks] = useState<WeekInfo[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [selectedWeekRange, setSelectedWeekRange] = useState<{ start: string; end: string } | null>(null);
  const [report, setReport] = useState<string>('');
  const [reportCreatedAt, setReportCreatedAt] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentLibraryId) return;
    api.timeline.get(currentLibraryId).then(setWeeks);
  }, [currentLibraryId]);

  const handleSelectWeek = async (w: WeekInfo) => {
    setSelectedWeek(w.week);
    setSelectedWeekRange({ start: w.start, end: w.end });
    setLoading(true);
    try {
      const result = await api.weeklyReports.generate(w.week, currentLibraryId!);
      setReport(result.report || '');
      setReportCreatedAt(result.created_at || '');
    } catch {
      setReport('');
      setReportCreatedAt('');
    } finally {
      setLoading(false);
    }
  };

  const handleForceUpdate = async () => {
    if (!selectedWeek || !currentLibraryId) return;
    setLoading(true);
    try {
      const result = await api.weeklyReports.generate(selectedWeek, currentLibraryId, true);
      setReport(result.report || '');
      setReportCreatedAt(result.created_at || '');
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Title level={4}>周报</Title>
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ width: 260 }}>
          <List
            dataSource={weeks}
            renderItem={(w) => (
              <List.Item
                style={{
                  cursor: 'pointer',
                  background: selectedWeek === w.week ? '#e6f4ff' : undefined,
                  padding: '8px 12px',
                  borderRadius: 6,
                }}
                onClick={() => handleSelectWeek(w)}
              >
                <div>
                  <Text strong>{w.week}</Text>
                  {w.start && w.end && (
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                      {w.start} ~ {w.end}
                    </Text>
                  )}
                </div>
                <Text type="secondary">({w.count}篇)</Text>
              </List.Item>
            )}
          />
        </div>
        <div style={{ flex: 1 }}>
          {selectedWeek ? (
            <Card
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>周报：{selectedWeek}{selectedWeekRange ? ` (${selectedWeekRange.start} ~ ${selectedWeekRange.end})` : ''}</span>
                  <Space>
                    {reportCreatedAt && (
                      <Text type="secondary" style={{ fontSize: 12 }}>更新于 {reportCreatedAt}</Text>
                    )}
                    <Button size="small" icon={<ReloadOutlined />} onClick={handleForceUpdate} loading={loading}>
                      更新
                    </Button>
                  </Space>
                </div>
              }
              loading={loading}
            >
              {report ? (
                <div style={{ lineHeight: 1.8 }}>
                  <ReactMarkdown>{report}</ReactMarkdown>
                </div>
              ) : !loading ? (
                <Empty description="本周无论文，无法生成周报" />
              ) : null}
            </Card>
          ) : (
            <Empty description="选择一周查看或生成周报" />
          )}
        </div>
      </div>
    </div>
  );
};

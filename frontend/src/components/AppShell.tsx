import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Typography, message } from 'antd';
import {
  ClockCircleOutlined,
  FileTextOutlined,
  BulbOutlined,
  ExperimentOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ThunderboltOutlined,
  CloseCircleOutlined,
  DownOutlined,
  BookOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useAppStore } from '../stores/appStore';
import { api } from '../services/api';
import { confirmDelete } from '../utils/confirm';
import type { PaperLibrary, Task } from '../types';
import { ChatPanel } from '../components/ChatPanel';

const { Sider, Content } = Layout;
const { Text } = Typography;

export const AppShell: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentLibraryId,
    currentTaskId,
    leftNavCollapsed,
    chatContext,
    toggleLeftNav,
    setCurrentLibrary,
    setCurrentTask,
    clearChatHistory,
    setChatContext,
  } = useAppStore();

  const [libraries, setLibraries] = useState<PaperLibrary[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksCollapsed, setTasksCollapsed] = useState(false);

  const showChatPanel = chatContext.scenario !== null;

  const loadTasks = () => {
    api.tasks.list().then(setTasks);
  };

  const handleDeleteTask = async (taskId: number) => {
    await api.tasks.delete(taskId);
    message.success('任务已删除');
    if (location.pathname === `/tasks/${taskId}`) {
      navigate('/');
    }
    loadTasks();
  };

  useEffect(() => {
    api.libraries.list().then((libs) => {
      setLibraries(libs);
      if (libs.length > 0 && !currentLibraryId) {
        setCurrentLibrary(libs[0].id);
      }
    });
    loadTasks();
  }, []);

  useEffect(() => {
    if (location.pathname.startsWith('/tasks/')) {
      loadTasks();
    }
  }, [location.pathname]);

  useEffect(() => {
    clearChatHistory();
    setChatContext({ scenario: null, entityId: null, entityTitle: '', existingContent: '' });
  }, [location.pathname]);

  const globalMenuItems = [
    { key: '/', icon: <ClockCircleOutlined />, label: '时间线' },
    { key: '/papers', icon: <BookOutlined />, label: '论文库' },
    { key: '/notes', icon: <EditOutlined />, label: '阅读笔记' },
    { key: '/weekly-report', icon: <FileTextOutlined />, label: '周报' },
    { key: '/ideas', icon: <BulbOutlined />, label: 'Idea' },
    { key: '/evolution', icon: <ThunderboltOutlined />, label: '进化日志' },
  ];

  const selectedKey = location.pathname;

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        width={leftNavCollapsed ? 60 : 240}
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
        trigger={null}
        collapsed={leftNavCollapsed}
      >
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          {!leftNavCollapsed && (
            <Text strong style={{ fontSize: 18, color: '#1677ff' }}>
              刻甲 Carvor
            </Text>
          )}
          <Button
            type="text"
            icon={leftNavCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleLeftNav}
          />
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={globalMenuItems}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none' }}
        />

        {tasks.length > 0 && !leftNavCollapsed && (
          <div style={{ borderTop: '1px solid #f0f0f0' }}>
            <div
              onClick={() => setTasksCollapsed(!tasksCollapsed)}
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fafafa',
                userSelect: 'none',
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>任务 ({tasks.length})</Text>
              <DownOutlined
                style={{ fontSize: 10, color: '#999', transition: 'transform 0.2s', transform: tasksCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
              />
            </div>
            {!tasksCollapsed && (
              <Menu
                mode="inline"
                selectedKeys={[selectedKey]}
                items={tasks.map((t) => ({
                  key: `/tasks/${t.id}`,
                  icon: <ExperimentOutlined />,
                  label: (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                      <CloseCircleOutlined
                        style={{ color: '#999', fontSize: 12 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete('确定删除此任务？', () => handleDeleteTask(t.id));
                        }}
                      />
                    </div>
                  ),
                }))}
                onClick={({ key }) => {
                  navigate(key);
                  if (key.startsWith('/tasks/')) {
                    const taskId = Number(key.split('/').pop());
                    setCurrentTask(taskId);
                  }
                }}
                style={{ border: 'none' }}
              />
            )}
          </div>
        )}

        <div style={{ marginTop: 'auto', padding: '12px 16px' }}>
          <Menu
            mode="inline"
            selectedKeys={[]}
            items={[
              { key: '/settings', icon: <SettingOutlined />, label: '设置' },
            ]}
            onClick={({ key }) => navigate(key)}
            style={{ border: 'none' }}
          />
        </div>
      </Sider>

      <Layout>
        <Content style={{ display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            <Outlet />
          </div>

          {showChatPanel && (
            <Sider
              width={380}
              style={{
                background: '#fff',
                borderLeft: '1px solid #f0f0f0',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
              trigger={null}
            >
              <ChatPanel />
            </Sider>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

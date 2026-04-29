<p align="center">
  <h1 align="center">Carvor 刻甲</h1>
  <p align="center">AI-Powered Research Assistant Platform</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" />
</p>

---

Carvor (刻甲) is an AI-powered research assistant platform designed to help researchers manage papers, develop ideas, track tasks, and streamline their research workflow with LLM integration.

## ✨ Features

- **Paper Library Management** — Organize, search, and deep-read research papers with AI-powered analysis
- **Idea Incubation** — Develop and refine research ideas through structured analysis (novelty, feasibility, risk assessment)
- **Task Tracking** — Manage research tasks and milestones with paper references
- **Weekly Reports** — Auto-generate weekly progress reports from your activity logs
- **Timeline View** — Visualize research progress over time
- **AI Chat Integration** — Stream-based conversational AI assistant with context compression
- **Document Processing** — PDF and DOCX support with deep reading capabilities
- **Evolution Tracking** — Observe and identify patterns in research evolution
- **Paper Polish** — AI-assisted paper writing and polishing with diff view
- **Skill System** — Extensible skill framework for customizing AI behavior per scenario

## 🛠 Tech Stack

### Backend

| Component | Technology |
|-----------|-----------|
| Framework | FastAPI |
| Database | SQLite (async with SQLAlchemy + aiosqlite) |
| LLM Integration | OpenAI-compatible API (via AsyncOpenAI) |
| Embedding | BGE-small-zh-v1.5 (local vector search) |
| Scheduling | APScheduler |
| Server | Uvicorn |

### Frontend

| Component | Technology |
|-----------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| UI Library | Ant Design |
| State Management | Zustand |
| Routing | React Router DOM v6 |
| Markdown Rendering | react-markdown + rehype-highlight |
| PDF Viewer | react-pdf |

## 📁 Project Structure

```
Carvor/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # REST API routes
│   │   │   ├── chat.py          # Streaming chat endpoint
│   │   │   ├── conversations.py # Conversation management
│   │   │   ├── evolution.py     # Evolution tracking
│   │   │   ├── ideas.py         # Idea CRUD & analysis
│   │   │   ├── libraries.py     # Paper library management
│   │   │   ├── notes.py         # Research notes
│   │   │   ├── operation_logs.py# Activity logging
│   │   │   ├── papers.py        # Paper CRUD & deep reading
│   │   │   ├── settings.py      # App settings
│   │   │   ├── tasks.py         # Task management
│   │   │   ├── timeline.py      # Timeline view
│   │   │   └── weekly_reports.py# Weekly report generation
│   │   ├── core/            # Core configurations
│   │   │   ├── config.py        # LLM & feature config
│   │   │   ├── constants.py     # System prompts & constraints
│   │   │   ├── database.py      # Async DB session
│   │   │   └── scheduler.py     # Scheduled tasks
│   │   ├── gateway/         # LLM gateway layer
│   │   │   ├── llm_gateway.py   # Unified LLM call interface
│   │   │   └── registry.py      # Scenario registry
│   │   ├── models/          # Database models (SQLAlchemy)
│   │   ├── pipelines/       # Research pipelines
│   │   │   ├── context_compress.py
│   │   │   ├── deep_reading.py
│   │   │   ├── evolution.py
│   │   │   ├── experiment.py
│   │   │   ├── idea.py
│   │   │   ├── method.py
│   │   │   ├── paper_import.py
│   │   │   ├── paper_search.py
│   │   │   ├── polish.py
│   │   │   ├── prompt_doc.py
│   │   │   ├── review.py
│   │   │   └── weekly_report.py
│   │   ├── scenarios/       # Scenario definitions
│   │   └── services/        # Business logic
│   │       ├── skill_service.py # Skill loading system
│   │       └── vector_search.py # Local vector search
│   ├── config/              # Configuration files
│   │   ├── llm_config.json.example
│   │   └── prompts.json
│   ├── skills/              # Skill definitions (Markdown)
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/      # Shared React components
    │   │   ├── AppShell.tsx     # App layout shell
    │   │   └── ChatPanel.tsx    # Streaming chat panel
    │   ├── hooks/           # Custom React hooks
    │   │   └── useChatStream.ts # SSE stream hook
    │   ├── pages/           # Page components
    │   ├── services/        # API service layer
    │   ├── stores/          # Zustand state stores
    │   ├── styles/          # Global CSS
    │   ├── types/           # TypeScript type definitions
    │   └── utils/           # Utility functions
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    └── vite.config.ts
```

## 🚀 Getting Started

### Prerequisites

- **Python 3.12+**
- **Node.js 18+**
- **npm**
- **LLM API Key** (OpenAI-compatible endpoint, e.g. Moonshot, OpenAI, DeepSeek)

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/hherosoul/Carvor.git
cd Carvor
```

#### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure LLM (required before first run)
cp config/llm_config.json.example config/llm_config.json
```

Edit `config/llm_config.json` and fill in your API key:

```json
{
  "config_version": 2,
  "llm": {
    "base_url": "https://api.moonshot.cn/v1",
    "api_key": "your-api-key-here",
    "model": "kimi-k2.6",
    "max_context_tokens": 100000,
    "extra_body": {
      "thinking": {
        "type": "disabled"
      }
    }
  },
  "features": {
    "web_search_tool_name": "$web_search",
    "daily_search_time": "08:00",
    "compress_threshold": 0.8
  }
}
```

> **Note:** The `base_url` and `model` fields can be changed to any OpenAI-compatible API endpoint (e.g. `https://api.openai.com/v1` with `gpt-4o`, or `https://api.deepseek.com/v1` with `deepseek-chat`).

#### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

### Running the Application

#### Development Mode

Start the backend:

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Start the frontend (in a separate terminal):

```bash
cd frontend
npm run dev
```

- Backend API: `http://localhost:8000`
- Frontend Dev Server: `http://localhost:5173` (proxies API requests to backend)

#### Production Mode

Build the frontend and serve through the backend:

```bash
# Build frontend
cd frontend
npm run build

# Run backend (serves built frontend)
cd ../backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The full application will be available at `http://localhost:8000`

## ⚙️ Configuration

### LLM Configuration

See `backend/config/llm_config.json.example` for the full configuration schema. Key fields:

| Field | Description |
|-------|-------------|
| `llm.base_url` | OpenAI-compatible API base URL |
| `llm.api_key` | Your API key |
| `llm.model` | Model identifier |
| `llm.max_context_tokens` | Maximum context window size |
| `features.web_search_tool_name` | Web search tool name (set to enable web search in scenarios) |
| `features.daily_search_time` | Scheduled daily paper search time |
| `features.compress_threshold` | Context compression trigger threshold |

### Embedding Model

Carvor uses [BGE-small-zh-v1.5](https://huggingface.co/BAAI/bge-small-zh-v1.5) for local vector search. On first run, the model will be automatically downloaded to `backend/models/`.

## 📖 API Documentation

Once the backend is running, visit:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/) and [React](https://react.dev/)
- LLM integration via [OpenAI Python SDK](https://github.com/openai/openai-python)
- UI powered by [Ant Design](https://ant.design/)
- Embedding model by [BAAI/bge-small-zh-v1.5](https://huggingface.co/BAAI/bge-small-zh-v1.5)

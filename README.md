# Carvor

Carvor (刻甲) is an AI-powered research assistant platform designed to help researchers manage papers, develop ideas, track tasks, and streamline their research workflow with LLM integration.

## Features

- **Paper Library Management**: Organize and search research papers
- **Idea Incubation**: Develop and refine research ideas
- **Task Tracking**: Manage research tasks and milestones
- **Weekly Reports**: Generate weekly progress reports
- **Timeline View**: Visualize research progress over time
- **Chat Integration**: AI-powered chat assistant
- **Document Processing**: PDF and DOCX support

## Tech Stack

### Backend
- **Framework**: FastAPI
- **Database**: SQLite (async with SQLAlchemy)
- **LLM Integration**: OpenAI-compatible API
- **Server**: Uvicorn

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Library**: Ant Design
- **State Management**: Zustand
- **Routing**: React Router DOM

## Project Structure

```
Carvor/
├── backend/
│   ├── app/
│   │   ├── api/          # API routes
│   │   ├── core/         # Core configurations
│   │   ├── gateway/      # LLM gateway
│   │   ├── models/       # Database models
│   │   ├── pipelines/    # Research pipelines
│   │   ├── scenarios/    # Scenario definitions
│   │   └── services/     # Business logic
│   ├── config/           # Configuration files
│   ├── data/             # Data storage
│   ├── models/           # ML models
│   ├── skills/           # Skills definitions
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/   # React components
    │   ├── pages/        # Page components
    │   ├── services/     # API services
    │   ├── stores/       # Zustand stores
    │   └── types/        # TypeScript types
    └── package.json
```

## Getting Started

### Prerequisites

- **Python 3.12+**
- **Node.js 18+**
- **npm or yarn**
- **LLM API Key** (OpenAI-compatible endpoint)

### Installation & Setup

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd Carvor
```

#### 2. Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure LLM
cp config/llm_config.json.example config/llm_config.json
# Edit config/llm_config.json with your API key
```

#### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

## Running the Application

### Development Mode

#### Backend (Development)

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at `http://localhost:8000`

#### Frontend (Development)

Open a new terminal:

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Production Mode

#### 1. Build Frontend

```bash
cd frontend
npm run build
```

#### 2. Run Backend (Serves Frontend)

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The full application will be available at `http://localhost:8000`

## Configuration

### LLM Configuration

Edit `backend/config/llm_config.json`:

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

## API Documentation

Once the backend is running, visit:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Acknowledgments

- Built with FastAPI and React
- LLM integration via OpenAI-compatible API
- UI powered by Ant Design

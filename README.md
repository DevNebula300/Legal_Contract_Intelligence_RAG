# Legal Contract Intelligence

Legal Contract Intelligence is a full-stack AI-powered application designed to analyze, compare, and report on legal contracts. The system allows users to upload contracts, identify legal risks, search for relevant precedents, and generate professional legal reports automatically using generative AI technologies.

## Features

- **Upload and Analyze**: Automatically parse and classify clauses from uploaded legal documents.
- **AI Chat**: Ask questions directly about the uploaded contract and receive citations and context-aware responses.
- **Risk Review**: The AI identifies, highlights, and categorizes high, medium, and low risk clauses within the contract.
- **Precedent Search**: Find relevant court cases and legal precedents based on specific contract clauses.
- **Compare Contracts**: Compare two different versions of a contract to highlight differences clause by clause.
- **Generate Report**: Generate and download a comprehensive risk review report covering all identified risks and suggestions.

## Technology Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL (via SQLAlchemy)
- **Vector Database**: Qdrant
- **AI & Orchestration**: LangChain, LangGraph
- **LLM Providers**: OpenAI, Anthropic
- **Document Processing**: PyMuPDF, python-docx

### Frontend
- **Framework**: Next.js 16 (React 19)
- **Styling**: Tailwind CSS v4
- **UI Components**: Shadcn UI, Base UI

## Prerequisites

Before setting up the project, ensure you have the following installed:
- Node.js (v20 or higher)
- Python (v3.9 or higher)
- PostgreSQL & Qdrant (can be run via Docker)

## Getting Started

### 1. Start Infrastructure (Optional)
If you have Docker installed, you can use the provided `docker-compose.yml` in the root directory to spin up necessary databases:
```bash
docker-compose up -d
```

### 2. Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
   ```
3. Install the required backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up your environment variables. Add your required API keys (such as OpenAI, Anthropic, and database connection strings) to a `.env` file in the `backend` folder.
5. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload
   ```
   The backend API will run at `http://localhost:8000`. You can check the health status at `http://localhost:8000/health`.

### 3. Frontend Setup
1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install the necessary Node packages:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:3000` to access the application.

## Project Structure

- `/backend`: Contains the FastAPI application, routing, database models, and AI business logic.
- `/frontend`: Contains the Next.js application, React components, and user interface.
- `/data`: Directory used for storing local datasets or temporary files.

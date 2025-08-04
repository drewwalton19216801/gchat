# GChat

A modern, real-time chat application powered by AI models through OpenRouter. GChat features a sleek React frontend with streaming responses and a lightweight Go backend.

## Features

- 🤖 **AI-Powered Chat**: Integrates with OpenRouter to access various AI models
- 🔄 **Real-time Streaming**: Live streaming responses for immediate feedback
- 🎨 **Modern UI**: Beautiful glassmorphism design with animated backgrounds
- 💾 **Persistent Storage**: Conversations saved locally in browser
- 📤 **Export/Import**: Export conversations as JSON files
- 🎯 **Model Selection**: Choose from different AI models via OpenRouter
- 🔧 **System Prompts**: Customize AI behavior with system prompts
- ♿ **Accessible**: Built with accessibility best practices

## Tech Stack

### Backend
- **Go 1.24.2** - Server runtime
- **Chi Router** - HTTP routing and middleware
- **OpenRouter API** - AI model integration

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling framework
- **React Markdown** - Markdown rendering with syntax highlighting

## Prerequisites

Before you begin, ensure you have the following installed:

- **Go 1.24.2 or later** - [Download Go](https://golang.org/dl/)
- **Node.js 18 or later** - [Download Node.js](https://nodejs.org/)
- **npm or yarn** - Package manager (comes with Node.js)
- **OpenRouter API Key** - [Get your key](https://openrouter.ai/)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/drewwalton19216801/gchat.git
cd gchat
```

### 2. Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Copy the environment file and configure it:
```bash
cp .env.example .env
```

3. Edit `.env` with your configuration:
```env
# Backend configuration
PORT=8080
ALLOWED_ORIGIN=http://localhost:5173
APP_URL=http://localhost:5173
APP_NAME=GChat
DEFAULT_MODEL=openrouter/auto

# OpenRouter - Get your key from https://openrouter.ai/
OPENROUTER_API_KEY=sk-or-your-actual-api-key-here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

4. Install Go dependencies:
```bash
go mod download
```

5. Run the backend server:
```bash
go run cmd/server/main.go
```

The backend will start on `http://localhost:8080`

### 3. Frontend Setup

1. Open a new terminal and navigate to the web directory:
```bash
cd web
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will start on `http://localhost:5173`

### 4. Access the Application

Open your browser and navigate to `http://localhost:5173`. You should see the GChat interface ready to use!

## Development

### Project Structure

```
gchat/
├── backend/                 # Go backend
│   ├── cmd/
│   │   └── server/         # Main application entry point
│   ├── internal/
│   │   └── app/           # Application logic and OpenRouter integration
│   ├── .env.example       # Environment configuration template
│   ├── go.mod             # Go module definition
│   └── go.sum             # Go module checksums
├── web/                    # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── lib/          # API client and utilities
│   │   └── styles/       # CSS styles
│   ├── package.json      # Node.js dependencies
│   ├── vite.config.ts    # Vite configuration
│   └── tailwind.config.js # Tailwind CSS configuration
└── README.md              # This file
```

### Backend Development

The backend is built with Go and uses:
- [`chi`](https://github.com/go-chi/chi) for HTTP routing
- [`cors`](https://github.com/go-chi/cors) for CORS handling
- OpenRouter API for AI model integration

Key files:
- [`backend/cmd/server/main.go`](backend/cmd/server/main.go) - Application entry point
- [`backend/internal/app/app.go`](backend/internal/app/app.go) - Main application logic
- [`backend/internal/app/openrouter.go`](backend/internal/app/openrouter.go) - OpenRouter integration

To run backend tests:
```bash
cd backend
go test ./...
```

### Frontend Development

The frontend is built with React and TypeScript, featuring:
- Real-time streaming chat interface
- Local storage for conversation persistence
- Responsive design with Tailwind CSS
- Accessibility features

Key files:
- [`web/src/App.tsx`](web/src/App.tsx) - Main application component
- [`web/src/lib/api.ts`](web/src/lib/api.ts) - API client for backend communication
- [`web/src/components/`](web/src/components/) - Reusable React components

Available scripts:
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### API Endpoints

The backend exposes the following endpoints:

- `POST /api/chat` - Stream chat completions
  - Accepts JSON with `model` and `messages` fields
  - Returns Server-Sent Events (SSE) stream
  - Events: `delta` (content chunks), `done` (completion)

## Building for Production

### Backend

```bash
cd backend
go build -o gchat-server cmd/server/main.go
```

### Frontend

```bash
cd web
npm run build
```

The built files will be in the `web/dist` directory.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `8080` |
| `ALLOWED_ORIGIN` | CORS allowed origin | `http://localhost:5173` |
| `APP_URL` | Application URL | `http://localhost:5173` |
| `APP_NAME` | Application name | `GChat` |
| `DEFAULT_MODEL` | Default AI model | `openrouter/auto` |
| `OPENROUTER_API_KEY` | OpenRouter API key | Required |
| `OPENROUTER_BASE_URL` | OpenRouter API base URL | `https://openrouter.ai/api/v1` |

### OpenRouter Models

GChat supports any model available through OpenRouter. Popular options include:
- `openrouter/auto` - Automatically selects the best model
- `anthropic/claude-3-sonnet` - Claude 3 Sonnet
- `openai/gpt-4` - GPT-4
- `meta-llama/llama-2-70b-chat` - Llama 2 70B

See the [OpenRouter documentation](https://openrouter.ai/docs) for a complete list of available models.

## Contributing

We welcome contributions! Here's how to get started:

### 1. Fork and Clone

```bash
git fork https://github.com/drewwalton19216801/gchat.git
git clone https://github.com/your-username/gchat.git
cd gchat
```

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

### 3. Make Changes

- Follow the existing code style and conventions
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass

### 4. Test Your Changes

Backend:
```bash
cd backend
go test ./...
go run cmd/server/main.go
```

Frontend:
```bash
cd web
npm run dev
```

### 5. Submit a Pull Request

- Push your changes to your fork
- Create a pull request with a clear description
- Include any relevant issue numbers

### Code Style

- **Go**: Follow standard Go conventions, use `gofmt`
- **TypeScript/React**: Use Prettier for formatting, follow React best practices
- **Commits**: Use conventional commit messages

### Reporting Issues

When reporting issues, please include:
- Operating system and version
- Go and Node.js versions
- Steps to reproduce the issue
- Expected vs actual behavior
- Any error messages or logs

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support

- 📖 **Documentation**: Check this README and inline code comments
- 🐛 **Issues**: [GitHub Issues](https://github.com/drewwalton19216801/gchat/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/drewwalton19216801/gchat/discussions)

## Acknowledgments

- [OpenRouter](https://openrouter.ai/) for AI model access
- [Chi](https://github.com/go-chi/chi) for the excellent Go router
- [Vite](https://vitejs.dev/) for the fast build tool
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
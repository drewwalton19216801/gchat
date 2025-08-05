package app

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
)

// captureWriter captures assistant deltas while proxying writes.
// Note: defined at package scope so we can implement methods on it.
type captureWriter struct {
	http.ResponseWriter
	assistant strings.Builder
	reasoning strings.Builder
	seenDelta bool
}

// Write implements http.ResponseWriter and intercepts SSE lines to capture assistant content.
func (cw *captureWriter) Write(p []byte) (int, error) {
	line := string(p)
	// Only inspect SSE lines; always forward to client
	if strings.HasPrefix(line, "data:") {
		payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		var obj struct {
			Content   string `json:"content"`
			Reasoning string `json:"reasoning"`
		}
		if json.Unmarshal([]byte(payload), &obj) == nil {
			if obj.Content != "" {
				cw.assistant.WriteString(obj.Content)
				cw.seenDelta = true
			}
			if obj.Reasoning != "" {
				cw.reasoning.WriteString(obj.Reasoning)
			}
		}
	}
	// Forward write to the underlying ResponseWriter
	return cw.ResponseWriter.Write(p)
}

// writerFunc is a function adapter used by rwShim.
type writerFunc func([]byte) (int, error)

// rwShim wraps an http.ResponseWriter and overrides Write.
type rwShim struct {
	http.ResponseWriter
	write writerFunc
}

// Write implements http.ResponseWriter's Write for rwShim.
func (s rwShim) Write(p []byte) (int, error) { return s.write(p) }

type Config struct {
	Port          string
	AllowedOrigin string
	AppURL        string
	AppName       string
	DefaultModel  string
	ViteHost      string
	VitePort      string
	BackendHost   string
}

func loadConfig() (*Config, error) {
	viteHost := getEnv("VITE_HOST", "localhost")
	backendHost := getEnv("BACKEND_HOST", "")

	// Default: bind to all interfaces in containers unless explicitly set
	if backendHost == "" {
		backendHost = "0.0.0.0"
	}

	cfg := &Config{
		Port:          getEnv("PORT", "8080"),
		AllowedOrigin: getEnv("ALLOWED_ORIGIN", "http://localhost:5173"),
		AppURL:        getEnv("APP_URL", "http://localhost:5173"),
		AppName:       getEnv("APP_NAME", "GChat"),
		DefaultModel:  getEnv("DEFAULT_MODEL", "openrouter/auto"),
		ViteHost:      viteHost,
		VitePort:      getEnv("VITE_PORT", "5173"),
		BackendHost:   backendHost,
	}
	return cfg, nil
}

// In-memory conversation store (basic). This can be replaced by a DB later.
type ConvMessage struct {
	Role      string `json:"role"`
	Content   string `json:"content"`
	Reasoning string `json:"reasoning,omitempty"`
	TS        int64  `json:"ts"`
}

type Conversation struct {
	ID        string        `json:"id"`
	Title     string        `json:"title,omitempty"`
	Model     string        `json:"model"`
	Messages  []ConvMessage `json:"messages"`
	CreatedAt int64         `json:"createdAt"`
	UpdatedAt int64         `json:"updatedAt"`
}

type Store struct {
	// map of conversationID -> Conversation
	data map[string]*Conversation
}

func NewStore() *Store {
	return &Store{data: make(map[string]*Conversation)}
}

func (s *Store) Get(id string) (*Conversation, bool) {
	c, ok := s.data[id]
	return c, ok
}

func (s *Store) Upsert(c *Conversation) {
	s.data[c.ID] = c
}

func (s *Store) List() []*Conversation {
	out := make([]*Conversation, 0, len(s.data))
	for _, c := range s.data {
		out = append(out, c)
	}
	return out
}

// Save all conversations to a local JSON file (basic local persistence).
func (s *Store) SaveToFile(path string) error {
	tmp := struct {
		Conversations []*Conversation `json:"conversations"`
	}{Conversations: s.List()}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	return enc.Encode(tmp)
}

// Load conversations from a local JSON file.
func (s *Store) LoadFromFile(path string) error {
	f, err := os.Open(path)
	if err != nil {
		// Nothing to load is not an error
		return nil
	}
	defer f.Close()
	var tmp struct {
		Conversations []*Conversation `json:"conversations"`
	}
	if err := json.NewDecoder(f).Decode(&tmp); err != nil {
		return err
	}
	for _, c := range tmp.Conversations {
		s.Upsert(c)
	}
	return nil
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func newRouter(cfg *Config) http.Handler {
	r := chi.NewRouter()
	store := NewStore()
	// Load persisted conversations on startup (best-effort)
	_ = store.LoadFromFile(".gchat-conversations.json")

	// CORS - configure allowed origins based on VITE_HOST setting
	var allowedOrigins []string
	if cfg.ViteHost == "0.0.0.0" {
		// When VITE_HOST is 0.0.0.0, allow requests from any origin
		// This is needed for external access to the frontend
		allowedOrigins = []string{"*"}
	} else {
		// Default behavior - only allow the configured origin
		allowedOrigins = []string{cfg.AllowedOrigin}
	}

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Health
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	// API Key validation endpoint
	r.Post("/api/validate-key", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			APIKey string `json:"api_key"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}

		if req.APIKey == "" {
			http.Error(w, "api_key is required", http.StatusBadRequest)
			return
		}

		// Create a temporary client with the provided API key
		tempClient := &OpenRouterClient{
			BaseURL:   getEnv("OPENROUTER_BASE_URL", defaultOpenRouterBase),
			APIKey:    req.APIKey,
			AppURL:    cfg.AppURL,
			AppName:   cfg.AppName,
			HTTP:      &http.Client{Timeout: 10 * time.Second},
			UserAgent: "gchat/1.0 (+https://github.com/drewwalton19216801/gchat)",
		}

		// Test the API key by making a request to OpenRouter's models endpoint
		testReq, err := http.NewRequestWithContext(r.Context(), http.MethodGet, tempClient.BaseURL+"/models", nil)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"valid":false,"error":"Failed to create request"}`))
			return
		}

		testReq.Header.Set("Authorization", "Bearer "+tempClient.APIKey)
		if tempClient.AppURL != "" {
			testReq.Header.Set("HTTP-Referer", tempClient.AppURL)
		}
		if tempClient.AppName != "" {
			testReq.Header.Set("X-Title", tempClient.AppName)
		}
		if tempClient.UserAgent != "" {
			testReq.Header.Set("User-Agent", tempClient.UserAgent)
		}

		resp, err := tempClient.HTTP.Do(testReq)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"valid":false,"error":"Network error"}`))
			return
		}
		defer resp.Body.Close()

		// Drain the response body
		_, _ = io.Copy(io.Discard, resp.Body)

		if resp.StatusCode == 401 {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"valid":false,"error":"Invalid API key"}`))
			return
		}

		if resp.StatusCode/100 != 2 {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"valid":false,"error":"API key validation failed"}`))
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"valid":true}`))
	})

	// Conversations API (in-memory)
	// List summaries
	r.Get("/api/conversations", func(w http.ResponseWriter, r *http.Request) {
		type summary struct {
			ID        string `json:"id"`
			Title     string `json:"title,omitempty"`
			Model     string `json:"model"`
			UpdatedAt int64  `json:"updatedAt"`
		}
		list := store.List()
		out := struct {
			Conversations []summary `json:"conversations"`
		}{}
		for _, c := range list {
			out.Conversations = append(out.Conversations, summary{
				ID:        c.ID,
				Title:     c.Title,
				Model:     c.Model,
				UpdatedAt: c.UpdatedAt,
			})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(out)
	})

	// Get full conversation
	r.Get("/api/conversations/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if id == "" {
			http.Error(w, "missing id", http.StatusBadRequest)
			return
		}
		if c, ok := store.Get(id); ok {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(c)
			return
		}
		http.Error(w, "not found", http.StatusNotFound)
	})

	// Models passthrough: proxy OpenRouter /models, fallback to a small static list on error
	r.Get("/api/models", func(w http.ResponseWriter, r *http.Request) {
		type ORModel struct {
			ID   string `json:"id"`
			Name string `json:"name,omitempty"`
		}
		type ORModelsResponse struct {
			Data []ORModel `json:"data"`
		}
		type ModelOut struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		}
		out := struct {
			Models []ModelOut `json:"models"`
		}{}

		client := NewOpenRouterClient(cfg)

		// Build upstream request
		req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, client.BaseURL+"/models", nil)
		if err == nil {
			req.Header.Set("Authorization", "Bearer "+client.APIKey)
			if client.AppURL != "" {
				req.Header.Set("HTTP-Referer", client.AppURL)
			}
			if client.AppName != "" {
				req.Header.Set("X-Title", client.AppName)
			}
			if client.UserAgent != "" {
				req.Header.Set("User-Agent", client.UserAgent)
			}

			resp, err2 := client.HTTP.Do(req)
			if err2 == nil && resp != nil {
				defer resp.Body.Close()
				if resp.StatusCode/100 == 2 {
					var parsed ORModelsResponse
					if err := json.NewDecoder(resp.Body).Decode(&parsed); err == nil && len(parsed.Data) > 0 {
						for _, m := range parsed.Data {
							name := m.Name
							if name == "" {
								name = m.ID
							}
							out.Models = append(out.Models, ModelOut{ID: m.ID, Name: name})
						}
					}
				} else {
					// drain and ignore body on non-2xx
					_, _ = io.Copy(io.Discard, resp.Body)
				}
			}
		}

		// Fallback if nothing fetched
		if len(out.Models) == 0 {
			out.Models = []ModelOut{
				{ID: cfg.DefaultModel, Name: "Auto (OpenRouter)"},
				{ID: "meta-llama/llama-3.1-8b-instruct", Name: "Llama 3.1 8B Instruct"},
				{ID: "meta-llama/llama-3.1-70b-instruct", Name: "Llama 3.1 70B Instruct"},
			}
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(out)
	})

	// Chat SSE endpoint
	r.Post("/api/chat", func(w http.ResponseWriter, r *http.Request) {
		// Parse request body
		var req struct {
			ChatRequest
			APIKey string `json:"api_key,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		if req.Model == "" {
			req.Model = cfg.DefaultModel
		}

		// Basic conversation handling (server-side memory + local JSON persistence)
		convID := r.URL.Query().Get("conversationId")
		now := time.Now().UnixMilli()
		if convID == "" {
			convID = fmt.Sprintf("%d", now)
		}

		// Build list of incoming messages (system + provided messages)
		var incoming []ConvMessage
		if req.SystemPrompt != "" {
			incoming = append(incoming, ConvMessage{Role: "system", Content: req.SystemPrompt, TS: now})
		}
		for _, m := range req.Messages {
			incoming = append(incoming, ConvMessage{Role: m.Role, Content: m.Content, TS: now})
		}

		// Upsert conversation with incoming context
		conv, ok := store.Get(convID)
		if !ok {
			conv = &Conversation{
				ID:        convID,
				Model:     req.Model,
				Messages:  []ConvMessage{},
				CreatedAt: now,
				UpdatedAt: now,
			}
		}
		conv.Model = req.Model
		conv.Messages = append(conv.Messages, incoming...)
		conv.UpdatedAt = now
		if conv.Title == "" {
			for _, m := range conv.Messages {
				if m.Role == "user" && m.Content != "" {
					title := m.Content
					if len(title) > 60 {
						title = title[:60]
					}
					conv.Title = title
					break
				}
			}
		}
		store.Upsert(conv)
		// Best-effort persist after request intake
		_ = store.SaveToFile(".gchat-conversations.json")

		// Proxy stream to OpenRouter and translate to SSE, capturing assistant deltas to append and persist.
		client := NewOpenRouterClient(cfg)

		// Override API key if provided in request
		if req.APIKey != "" {
			client.APIKey = req.APIKey
		}

		ctx := r.Context()

		// Wrap ResponseWriter to capture SSE deltas by composing a custom writer.
		// Define types at package scope below to avoid method declaration inside function errors.
		cw := &captureWriter{ResponseWriter: w}

		// local helper to process a chunk and accumulate assistant deltas
		processChunk := func(p []byte) {
			line := string(p)
			if strings.HasPrefix(line, "data:") {
				payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
				var obj struct {
					Content   string `json:"content"`
					Reasoning string `json:"reasoning"`
				}
				if json.Unmarshal([]byte(payload), &obj) == nil {
					if obj.Content != "" {
						cw.assistant.WriteString(obj.Content)
						cw.seenDelta = true
					}
					if obj.Reasoning != "" {
						cw.reasoning.WriteString(obj.Reasoning)
					}
				}
			}
		}

		// writer that processes and forwards to the original ResponseWriter
		var wf writerFunc = func(p []byte) (int, error) {
			// Only inspect SSE lines; always forward to client
			if strings.HasPrefix(string(p), "data:") || strings.HasPrefix(string(p), "event:") {
				processChunk(p)
			}
			return w.Write(p)
		}

		if err := client.StreamChat(ctx, req.ChatRequest, rwShim{ResponseWriter: cw.ResponseWriter, write: wf}); err != nil {
			// Don't call http.Error here as headers may already be written during streaming
			log.Printf("StreamChat error: %v", err)
			return
		}

		// After stream ends, if we saw content, append assistant message and persist
		if cw.seenDelta {
			now2 := time.Now().UnixMilli()
			conv.Messages = append(conv.Messages, ConvMessage{
				Role:      "assistant",
				Content:   cw.assistant.String(),
				Reasoning: cw.reasoning.String(),
				TS:        now2,
			})
			conv.UpdatedAt = now2
			store.Upsert(conv)
			_ = store.SaveToFile(".gchat-conversations.json")
		}
	})

	return r
}

func Run() error {
	cfg, err := loadConfig()
	if err != nil {
		return err
	}

	addr := fmt.Sprintf("%s:%s", cfg.BackendHost, cfg.Port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           newRouter(cfg),
		ReadHeaderTimeout: 10 * time.Second,
	}

	corsInfo := cfg.AllowedOrigin
	if cfg.ViteHost == "0.0.0.0" {
		corsInfo = "* (all origins - external access enabled)"
	}
	log.Printf("Server starting on %s (CORS=%s)", addr, corsInfo)

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}

	// Graceful shutdown (not triggered in current flow)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return srv.Shutdown(ctx)
}

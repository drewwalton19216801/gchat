package app

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	defaultOpenRouterBase = "https://openrouter.ai/api/v1"
)

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ReasoningConfig struct {
	Effort    string `json:"effort,omitempty"`     // "high", "medium", "low"
	MaxTokens *int   `json:"max_tokens,omitempty"` // Direct token allocation
	Exclude   *bool  `json:"exclude,omitempty"`    // Exclude reasoning from response
	Enabled   *bool  `json:"enabled,omitempty"`    // Enable with default params
}

type ChatRequest struct {
	// OpenAI-compatible body for OpenRouter
	Model       string           `json:"model"`
	Messages    []ChatMessage    `json:"messages"`
	Temperature *float32         `json:"temperature,omitempty"`
	MaxTokens   *int             `json:"max_tokens,omitempty"`
	Stream      bool             `json:"stream,omitempty"`
	Reasoning   *ReasoningConfig `json:"reasoning,omitempty"`

	// Non-standard/local conveniences (not sent upstream)
	Conversation  string   `json:"conversation_id,omitempty"`
	SystemPrompt  string   `json:"system_prompt,omitempty"`
	StopSequences []string `json:"stop,omitempty"`
	FrequencyPen  *float32 `json:"frequency_penalty,omitempty"`
	PresencePen   *float32 `json:"presence_penalty,omitempty"`
}

type OpenRouterDelta struct {
	ID      string `json:"id,omitempty"`
	Object  string `json:"object,omitempty"`
	Created int64  `json:"created,omitempty"`
	Model   string `json:"model,omitempty"`
	// OpenAI-compatible: choices is an array; each item contains delta with content
	Choices []struct {
		Delta struct {
			Content   string `json:"content"`
			Role      string `json:"role,omitempty"`
			Reasoning string `json:"reasoning,omitempty"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
		Index        int     `json:"index,omitempty"`
	} `json:"choices,omitempty"`
}

type OpenRouterClient struct {
	BaseURL   string
	APIKey    string
	AppURL    string
	AppName   string
	HTTP      *http.Client
	UserAgent string
}

func NewOpenRouterClient(cfg *Config) *OpenRouterClient {
	base := os.Getenv("OPENROUTER_BASE_URL")
	if base == "" {
		base = defaultOpenRouterBase
	}
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	return &OpenRouterClient{
		BaseURL: base,
		APIKey:  apiKey,
		AppURL:  cfg.AppURL,
		AppName: cfg.AppName,
		HTTP: &http.Client{
			Timeout: 0, // streaming; no hard timeout
		},
		UserAgent: "gchat/1.0 (+https://github.com/drewwalton19216801/gchat)",
	}
}

// StreamChat proxies a streaming chat completion from OpenRouter and writes SSE to w.
// The context should be canceled to stop streaming.
func (c *OpenRouterClient) StreamChat(ctx context.Context, req ChatRequest, w http.ResponseWriter) error {
	if c.APIKey == "" {
		http.Error(w, "server not configured: missing OPENROUTER_API_KEY", http.StatusInternalServerError)
		return errors.New("missing OPENROUTER_API_KEY")
	}

	// Ensure stream enabled
	req.Stream = true

	// Build upstream request body with only OpenAI-compatible fields
	upstream := struct {
		Model       string           `json:"model"`
		Messages    []ChatMessage    `json:"messages"`
		Temperature *float32         `json:"temperature,omitempty"`
		MaxTokens   *int             `json:"max_tokens,omitempty"`
		Stream      bool             `json:"stream,omitempty"`
		Reasoning   *ReasoningConfig `json:"reasoning,omitempty"`
	}{
		Model:       req.Model,
		Messages:    req.Messages,
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		Stream:      true,
		Reasoning:   req.Reasoning,
	}

	// If a system prompt was provided, prepend it as a system message
	if req.SystemPrompt != "" {
		upstream.Messages = append([]ChatMessage{{Role: "system", Content: req.SystemPrompt}}, upstream.Messages...)
	}

	bodyBytes, err := json.Marshal(upstream)
	if err != nil {
		return err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/chat/completions", strings.NewReader(string(bodyBytes)))
	if err != nil {
		return err
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.APIKey)
	// Recommended headers
	if c.AppURL != "" {
		httpReq.Header.Set("HTTP-Referer", c.AppURL)
	}
	if c.AppName != "" {
		httpReq.Header.Set("X-Title", c.AppName)
	}
	if c.UserAgent != "" {
		httpReq.Header.Set("User-Agent", c.UserAgent)
	}

	// Execute
	resp, err := c.HTTP.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode/100 != 2 {
		io.Copy(io.Discard, resp.Body)
		http.Error(w, "upstream error", http.StatusBadGateway)
		return errors.New("openrouter upstream error: " + resp.Status)
	}

	// Prepare SSE response
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	flusher, _ := w.(http.Flusher)

	// Stream lines from OpenRouter (OpenAI-compatible: "data: {...}" lines)
	reader := bufio.NewReader(resp.Body)
	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()

	writeEvent := func(event string, data string) error {
		if _, err := w.Write([]byte("event: " + event + "\n")); err != nil {
			return err
		}
		if _, err := w.Write([]byte("data: " + data + "\n\n")); err != nil {
			return err
		}
		if flusher != nil {
			flusher.Flush()
		}
		return nil
	}

	// Initial ping to open the stream on proxies
	_ = writeEvent("open", `{"ok":true}`)

	for {
		select {
		case <-ctx.Done():
			_ = writeEvent("done", `{"reason":"canceled"}`)
			return nil
		case <-heartbeat.C:
			_ = writeEvent("ping", "{}")
		default:
			line, err := reader.ReadString('\n')
			if err != nil {
				if errors.Is(err, io.EOF) {
					_ = writeEvent("done", `{"reason":"eof"}`)
					return nil
				}
				return err
			}
			// Expect lines like "data: {...}" or "data: [DONE]"
			if len(line) < 6 {
				continue
			}
			if line[:5] != "data:" {
				continue
			}
			payload := line[5:]
			// Trim spaces and CR
			payload = strings.TrimSpace(payload)
			// [DONE]
			if payload == "[DONE]" {
				_ = writeEvent("done", `{"reason":"done"}`)
				return nil
			}
			// Parse delta to extract content and reasoning
			var delta OpenRouterDelta
			if err := json.Unmarshal([]byte(payload), &delta); err == nil && len(delta.Choices) > 0 {
				for _, ch := range delta.Choices {
					if ch.Delta.Content != "" {
						_ = writeEvent("delta", jsonEscaped(map[string]string{"content": ch.Delta.Content}))
					}
					if ch.Delta.Reasoning != "" {
						_ = writeEvent("reasoning", jsonEscaped(map[string]string{"reasoning": ch.Delta.Reasoning}))
					}
				}
			} else {
				// forward raw in case of different schema
				_ = writeEvent("raw", payload)
			}
		}
	}
}

func jsonEscaped(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

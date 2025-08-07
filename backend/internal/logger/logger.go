package logger

import (
	"log"
	"os"
	"strings"
)

// Logger provides conditional logging based on environment variables
type Logger struct {
	debugEnabled bool
}

// New creates a new logger instance
func New() *Logger {
	return &Logger{
		debugEnabled: strings.ToLower(os.Getenv("LOGGING")) == "debug",
	}
}

// Global logger instance
var defaultLogger = New()

// Debug logs a debug message if LOGGING=debug is set
func (l *Logger) Debug(format string, args ...interface{}) {
	if l.debugEnabled {
		log.Printf("[DEBUG] "+format, args...)
	}
}

// Error always logs error messages regardless of environment variable
func (l *Logger) Error(format string, args ...interface{}) {
	log.Printf("[ERROR] "+format, args...)
}

// Info logs informational messages if LOGGING=debug is set
func (l *Logger) Info(format string, args ...interface{}) {
	if l.debugEnabled {
		log.Printf("[INFO] "+format, args...)
	}
}

// Warn always logs warning messages regardless of environment variable
func (l *Logger) Warn(format string, args ...interface{}) {
	log.Printf("[WARN] "+format, args...)
}

// Package-level convenience functions using the default logger

// Debug logs a debug message if LOGGING=debug is set
func Debug(format string, args ...interface{}) {
	defaultLogger.Debug(format, args...)
}

// Error always logs error messages regardless of environment variable
func Error(format string, args ...interface{}) {
	defaultLogger.Error(format, args...)
}

// Info logs informational messages if LOGGING=debug is set
func Info(format string, args ...interface{}) {
	defaultLogger.Info(format, args...)
}

// Warn always logs warning messages regardless of environment variable
func Warn(format string, args ...interface{}) {
	defaultLogger.Warn(format, args...)
}

// IsDebugEnabled returns true if debug logging is enabled
func IsDebugEnabled() bool {
	return defaultLogger.debugEnabled
}

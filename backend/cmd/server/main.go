package main

import (
	"log"

	"github.com/drewwalton19216801/gchat/backend/internal/app"
)

func main() {
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
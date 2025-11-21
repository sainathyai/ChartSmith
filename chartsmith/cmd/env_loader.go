package cmd

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

var envFiles = []string{
	".env",
	".env.local",
}

func loadEnvFiles() {
	for _, filename := range envFiles {
		if filename == "" {
			continue
		}

		if _, err := os.Stat(filename); err != nil {
			if !os.IsNotExist(err) {
				fmt.Fprintf(os.Stderr, "warning: unable to read %s: %v\n", filename, err)
			}
			continue
		}

		if err := godotenv.Load(filename); err != nil {
			fmt.Fprintf(os.Stderr, "warning: failed to load %s: %v\n", filename, err)
		}
	}
}

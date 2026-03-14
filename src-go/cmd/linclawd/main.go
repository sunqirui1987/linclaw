package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/commands"
	"github.com/sunqirui1987/linclaw/src-go/internal/httpapi"
)

func main() {
	host := flag.String("host", envOr("LINCLAW_HOST", "0.0.0.0"), "HTTP bind host")
	port := flag.String("port", envOr("LINCLAW_PORT", "1420"), "HTTP bind port")
	webRoot := flag.String("web-root", envOr("LINCLAW_WEB_ROOT", "dist"), "frontend web root")
	flag.Parse()

	cwd, err := os.Getwd()
	if err != nil {
		log.Fatalf("getwd: %v", err)
	}

	ctx, err := appctx.New(cwd)
	if err != nil {
		log.Fatalf("init app context: %v", err)
	}

	registry := commands.NewRegistry()
	commands.RegisterAll(registry)

	addr := *host + ":" + *port
	server := httpapi.NewServer(ctx, registry, filepath.Clean(*webRoot))

	log.Printf("LinClaw Go backend listening on http://%s", addr)
	log.Printf("web root: %s", filepath.Join(cwd, filepath.Clean(*webRoot)))
	log.Printf("log dir: %s", ctx.Store.LogsDir())
	if ctx.Logger != nil {
		ctx.Logger.Gatewayf("main", "backend_started addr=%s web_root=%s log_dir=%s", addr, filepath.Join(cwd, filepath.Clean(*webRoot)), ctx.Store.LogsDir())
	}
	if err := http.ListenAndServe(addr, server); err != nil {
		if ctx.Logger != nil {
			ctx.Logger.GatewayErrorf("main", "server_exit error=%v", err)
		}
		log.Fatal(err)
	}
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

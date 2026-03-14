package commands

import (
	"context"
	"sort"
	"sync"

	appctx "github.com/sunqirui1987/linclaw/src-go/internal/app"
	"github.com/sunqirui1987/linclaw/src-go/internal/models"
)

type Handler func(context.Context, *appctx.Context, map[string]any) (any, *models.APIError)

type RegisteredCommand struct {
	Spec    models.CommandSpec
	Handler Handler
}

type Registry struct {
	mu         sync.RWMutex
	commands   map[string]RegisteredCommand
	authExempt map[string]struct{}
}

func NewRegistry() *Registry {
	return &Registry{
		commands:   map[string]RegisteredCommand{},
		authExempt: map[string]struct{}{},
	}
}

func (r *Registry) Register(spec models.CommandSpec, handler Handler) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.commands[spec.Name] = RegisteredCommand{
		Spec:    spec,
		Handler: handler,
	}
}

func (r *Registry) Lookup(name string) (RegisteredCommand, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	cmd, ok := r.commands[name]
	return cmd, ok
}

func (r *Registry) Specs() []models.CommandSpec {
	r.mu.RLock()
	defer r.mu.RUnlock()
	specs := make([]models.CommandSpec, 0, len(r.commands))
	for _, command := range r.commands {
		specs = append(specs, command.Spec)
	}
	sort.Slice(specs, func(i, j int) bool {
		if specs[i].Module == specs[j].Module {
			return specs[i].Name < specs[j].Name
		}
		return specs[i].Module < specs[j].Module
	})
	return specs
}

func (r *Registry) MarkAuthExempt(names ...string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, name := range names {
		r.authExempt[name] = struct{}{}
	}
}

func (r *Registry) IsAuthExempt(name string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.authExempt[name]
	return ok
}

func RegisterAll(r *Registry) {
	registerAuth(r)
	registerConfig(r)
	registerService(r)
	registerLogs(r)
	registerMemory(r)
	registerAgent(r)
	registerAssistant(r)
	registerMessaging(r)
	registerSkills(r)
	registerExtensions(r)
	registerDevice(r)
	registerPairing(r)
	registerUpdate(r)
	registerCloud(r)
}

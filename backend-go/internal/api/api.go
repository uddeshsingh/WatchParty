package api

import (
	"log"
	"net/http"
	"time"

	"wpbe/internal/corsutil"
	"wpbe/internal/domain"
	"wpbe/internal/handlers"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// Server holds all injected dependencies for the HTTP layer
type Server struct {
	Router      *chi.Mux
	RoomManager domain.RoomManager
}

// NewServer acts as our DI container for the API
func NewServer(rm domain.RoomManager) *Server {
	s := &Server{
		Router:      chi.NewRouter(),
		RoomManager: rm,
	}
	s.setupMiddleware()
	s.setupRoutes()
	return s
}

func (s *Server) setupMiddleware() {
	s.Router.Use(middleware.RequestID)
	s.Router.Use(middleware.RealIP)
	s.Router.Use(middleware.Logger)
	s.Router.Use(middleware.Recoverer)

	allowAny, origins := corsutil.AllowedOrigins()
	if allowAny {
		s.Router.Use(cors.Handler(cors.Options{
			AllowedOrigins:   []string{"*"},
			AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
			ExposedHeaders:   []string{"Link"},
			AllowCredentials: false,
			MaxAge:           300,
		}))
	} else {
		s.Router.Use(cors.Handler(cors.Options{
			AllowedOrigins:   origins,
			AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
			ExposedHeaders:   []string{"Link"},
			AllowCredentials: true,
			MaxAge:           300,
		}))
	}
}

func (s *Server) setupRoutes() {
	s.Router.Get("/ws", handlers.WebSocketHandler(s.RoomManager))

	s.Router.Group(func(r chi.Router) {
		r.Use(middleware.Timeout(60 * time.Second))

		r.Get("/health", s.handleHealthCheck())
		r.Get("/rooms", handlers.GetRoomsHandler(s.RoomManager))

		r.Route("/api/v1", func(api chi.Router) {
			api.Get("/rooms", handlers.GetRoomsHandler(s.RoomManager))
		})
	})
}

func (s *Server) handleHealthCheck() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy"}`))
	}
}

// Serve starts the HTTP server with standard timeouts
func (s *Server) Serve(port string) error {
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      s.Router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	log.Printf("🚀 Starting enterprise API on port %s", port)
	return srv.ListenAndServe()
}

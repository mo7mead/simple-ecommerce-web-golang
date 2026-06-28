package api

import (
	"net/http"
	"runtime"
)

func (a *API) adminSystem(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"goVersion":  runtime.Version(),
		"sessionTTL": "24h",
		"db":         "MySQL",
	})
}

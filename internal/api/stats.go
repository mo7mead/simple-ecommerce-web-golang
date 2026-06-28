package api

import (
	"net/http"
	"time"

	"smple-web-app/internal/middleware"
)

func (a *API) adminStats(w http.ResponseWriter, r *http.Request) {
	age := middleware.SessionAge(r.Context())
	stats, err := a.Store.Stats(r.Context(), age)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	recentSessions := make([]map[string]any, 0, len(stats.RecentSessions))
	for _, s := range stats.RecentSessions {
		recentSessions = append(recentSessions, map[string]any{
			"username":   s.Username,
			"avatarPath": s.AvatarPath,
			"createdAt":  s.CreatedAt,
			"expiresAt":  s.ExpiresAt,
		})
	}
	recentUsers := make([]userDTO, 0, len(stats.RecentUsers))
	for _, u := range stats.RecentUsers {
		recentUsers = append(recentUsers, toUserDTO(u))
	}
	recentProducts := make([]map[string]any, 0, len(stats.RecentProducts))
	for _, p := range stats.RecentProducts {
		recentProducts = append(recentProducts, map[string]any{
			"id":        p.ID,
			"name":      p.Name,
			"price":     p.Price,
			"stock":     p.Stock,
			"sellerId":  p.SellerID,
			"createdAt": p.CreatedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"totalUsers":      stats.TotalUsers,
		"totalAdmins":     stats.TotalAdmins,
		"totalSellers":    stats.TotalSellers,
		"activeSessions":  stats.ActiveSessions,
		"totalCategories": stats.TotalCategories,
		"totalSlides":     stats.TotalSlides,
		"totalProducts":   stats.TotalProducts,
		"inventoryValue":  stats.InventoryValue,
		"newUsers7d":      stats.NewUsers7d,
		"newProducts7d":   stats.NewProducts7d,
		"yourSessionSec":  int(age.Round(time.Second).Seconds()),
		"recentSessions":  recentSessions,
		"recentUsers":     recentUsers,
		"recentProducts":  recentProducts,
	})
}

func (a *API) sellerStats(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFrom(r.Context())
	stats, err := a.Store.SellerStats(r.Context(), u.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

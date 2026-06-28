package api

import (
	"net/http"

	"smple-web-app/internal/store"
)

type catNode struct {
	ID       int64      `json:"id"`
	ParentID *int64     `json:"parentId,omitempty"`
	Name     string     `json:"name"`
	Slug     string     `json:"slug"`
	Icon     string     `json:"icon"`
	Children []*catNode `json:"children,omitempty"`
}

func toCatNode(c *store.Category) *catNode {
	n := &catNode{ID: c.ID, Name: c.Name, Slug: c.Slug, Icon: c.Icon}
	if c.ParentID.Valid {
		pid := c.ParentID.Int64
		n.ParentID = &pid
	}
	for _, child := range c.Children {
		n.Children = append(n.Children, toCatNode(child))
	}
	return n
}

func (a *API) categories(w http.ResponseWriter, r *http.Request) {
	tree, err := a.Store.CategoryTree(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	out := make([]*catNode, 0, len(tree))
	for _, c := range tree {
		out = append(out, toCatNode(c))
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) adminCategories(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		cats, err := a.Store.ListCategories(r.Context())
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		out := make([]map[string]any, 0, len(cats))
		for _, c := range cats {
			var pid any
			if c.ParentID.Valid {
				pid = c.ParentID.Int64
			}
			out = append(out, map[string]any{
				"id": c.ID, "parentId": pid, "name": c.Name, "slug": c.Slug, "icon": c.Icon, "position": c.Position,
			})
		}
		writeJSON(w, http.StatusOK, out)
		return
	}
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	var body struct {
		Name     string `json:"name"`
		Icon     string `json:"icon"`
		ParentID *int64 `json:"parentId"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if err := a.Store.CreateCategory(r.Context(), body.ParentID, body.Name, body.Icon); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminCategoryDelete(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	var body struct {
		ID int64 `json:"id"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if err := a.Store.DeleteCategory(r.Context(), body.ID); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

package admin

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/pkg/usagestats"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type dashboardRealtimeUsageRepo struct {
	service.UsageLogRepository
	stats *usagestats.DashboardStats
}

func (r *dashboardRealtimeUsageRepo) GetDashboardStats(ctx context.Context) (*usagestats.DashboardStats, error) {
	if r.stats != nil {
		return r.stats, nil
	}
	return &usagestats.DashboardStats{}, nil
}

func TestDashboardRealtimeMetricsUsesDashboardStats(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &dashboardRealtimeUsageRepo{
		stats: &usagestats.DashboardStats{
			Rpm:               17,
			AverageDurationMs: 123.5,
		},
	}
	dashboardSvc := service.NewDashboardService(repo, nil, nil, nil)
	handler := NewDashboardHandler(dashboardSvc, nil)
	router := gin.New()
	router.GET("/admin/dashboard/realtime", handler.GetRealtimeMetrics)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/admin/dashboard/realtime", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var body struct {
		Data struct {
			ActiveRequests      int64   `json:"active_requests"`
			RequestsPerMinute   int64   `json:"requests_per_minute"`
			AverageResponseTime float64 `json:"average_response_time"`
			ErrorRate           float64 `json:"error_rate"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Equal(t, int64(0), body.Data.ActiveRequests)
	require.Equal(t, int64(17), body.Data.RequestsPerMinute)
	require.Equal(t, 123.5, body.Data.AverageResponseTime)
	require.Equal(t, 0.0, body.Data.ErrorRate)
}

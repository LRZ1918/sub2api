package service

import (
	"context"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/usagestats"
	"github.com/stretchr/testify/require"
)

type adminUserUsageRepoStub struct {
	UsageLogRepository
	captured usagestats.UsageLogFilters
	stats    *usagestats.UsageStats
	err      error
}

func (s *adminUserUsageRepoStub) GetStatsWithFilters(ctx context.Context, filters usagestats.UsageLogFilters) (*usagestats.UsageStats, error) {
	s.captured = filters
	if s.err != nil {
		return nil, s.err
	}
	return s.stats, nil
}

func TestAdminServiceGetUserUsageStatsUsesUsageRepository(t *testing.T) {
	accountCost := 1.25
	repo := &adminUserUsageRepoStub{
		stats: &usagestats.UsageStats{
			TotalRequests:     7,
			TotalInputTokens:  40,
			TotalOutputTokens: 59,
			TotalCacheTokens:  3,
			TotalTokens:       102,
			TotalCost:         1.5,
			TotalActualCost:   1.35,
			TotalAccountCost:  &accountCost,
			AverageDurationMs: 12.5,
		},
	}
	svc := &adminServiceImpl{usageRepo: repo}

	got, err := svc.GetUserUsageStats(context.Background(), 42, "week")

	require.NoError(t, err)
	payload, ok := got.(map[string]any)
	require.True(t, ok)
	require.Equal(t, "week", payload["period"])
	require.Equal(t, int64(7), payload["total_requests"])
	require.Equal(t, int64(40), payload["total_input_tokens"])
	require.Equal(t, int64(59), payload["total_output_tokens"])
	require.Equal(t, int64(3), payload["total_cache_tokens"])
	require.Equal(t, int64(102), payload["total_tokens"])
	require.Equal(t, 1.5, payload["total_cost"])
	require.Equal(t, 1.35, payload["total_actual_cost"])
	require.Equal(t, &accountCost, payload["total_account_cost"])
	require.Equal(t, 12.5, payload["avg_duration_ms"])
	require.Equal(t, 12.5, payload["average_duration_ms"])

	require.Equal(t, int64(42), repo.captured.UserID)
	require.NotNil(t, repo.captured.StartTime)
	require.NotNil(t, repo.captured.EndTime)
	require.True(t, repo.captured.EndTime.After(*repo.captured.StartTime))
	require.LessOrEqual(t, time.Since(*repo.captured.EndTime), 5*time.Second)
}

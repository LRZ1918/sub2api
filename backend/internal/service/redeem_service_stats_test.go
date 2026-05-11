package service

import (
	"context"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/stretchr/testify/require"
)

type redeemStatsRepoStub struct {
	codes []RedeemCode
}

func (s *redeemStatsRepoStub) Create(ctx context.Context, code *RedeemCode) error {
	panic("unexpected Create call")
}

func (s *redeemStatsRepoStub) CreateBatch(ctx context.Context, codes []RedeemCode) error {
	panic("unexpected CreateBatch call")
}

func (s *redeemStatsRepoStub) GetByID(ctx context.Context, id int64) (*RedeemCode, error) {
	panic("unexpected GetByID call")
}

func (s *redeemStatsRepoStub) GetByCode(ctx context.Context, code string) (*RedeemCode, error) {
	panic("unexpected GetByCode call")
}

func (s *redeemStatsRepoStub) Update(ctx context.Context, code *RedeemCode) error {
	panic("unexpected Update call")
}

func (s *redeemStatsRepoStub) Delete(ctx context.Context, id int64) error {
	panic("unexpected Delete call")
}

func (s *redeemStatsRepoStub) Use(ctx context.Context, id, userID int64) error {
	panic("unexpected Use call")
}

func (s *redeemStatsRepoStub) List(ctx context.Context, params pagination.PaginationParams) ([]RedeemCode, *pagination.PaginationResult, error) {
	start := params.Offset()
	end := start + params.Limit()
	if start > len(s.codes) {
		start = len(s.codes)
	}
	if end > len(s.codes) {
		end = len(s.codes)
	}
	return s.codes[start:end], &pagination.PaginationResult{Total: int64(len(s.codes))}, nil
}

func (s *redeemStatsRepoStub) ListWithFilters(ctx context.Context, params pagination.PaginationParams, codeType, status, search string) ([]RedeemCode, *pagination.PaginationResult, error) {
	panic("unexpected ListWithFilters call")
}

func (s *redeemStatsRepoStub) ListByUser(ctx context.Context, userID int64, limit int) ([]RedeemCode, error) {
	panic("unexpected ListByUser call")
}

func (s *redeemStatsRepoStub) ListByUserPaginated(ctx context.Context, userID int64, params pagination.PaginationParams, codeType string) ([]RedeemCode, *pagination.PaginationResult, error) {
	panic("unexpected ListByUserPaginated call")
}

func (s *redeemStatsRepoStub) SumPositiveBalanceByUser(ctx context.Context, userID int64) (float64, error) {
	panic("unexpected SumPositiveBalanceByUser call")
}

func TestRedeemServiceGetStatsAggregatesCodes(t *testing.T) {
	usedBy := int64(7)
	svc := &RedeemService{
		redeemRepo: &redeemStatsRepoStub{
			codes: []RedeemCode{
				{ID: 1, Type: RedeemTypeBalance, Value: 10, Status: StatusUnused},
				{ID: 2, Type: RedeemTypeBalance, Value: 20, Status: StatusUsed, UsedBy: &usedBy},
				{ID: 3, Type: RedeemTypeConcurrency, Value: 5, Status: StatusUsed, UsedBy: &usedBy},
				{ID: 4, Type: RedeemTypeSubscription, Value: 30, Status: StatusExpired},
				{ID: 5, Type: RedeemTypeInvitation, Value: 0, Status: StatusUnused},
			},
		},
	}

	stats, err := svc.GetStats(context.Background())

	require.NoError(t, err)
	require.Equal(t, int64(5), stats["total_codes"])
	require.Equal(t, int64(2), stats["unused_codes"])
	require.Equal(t, int64(2), stats["used_codes"])
	require.Equal(t, int64(1), stats["expired_codes"])
	require.Equal(t, 65.0, stats["total_value"])
	require.Equal(t, 20.0, stats["total_balance_distributed"])
	require.Equal(t, map[string]int64{
		RedeemTypeBalance:      2,
		RedeemTypeConcurrency:  1,
		RedeemTypeSubscription: 1,
		RedeemTypeInvitation:   1,
	}, stats["by_type"])
}

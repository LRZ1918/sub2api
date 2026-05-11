package service

import (
	"context"
	"errors"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/stretchr/testify/require"
)

type proxyRepoStubForTestProxy struct {
	proxy *Proxy
	err   error
}

func (s *proxyRepoStubForTestProxy) GetByID(ctx context.Context, id int64) (*Proxy, error) {
	if s.err != nil {
		return nil, s.err
	}
	if s.proxy != nil {
		return s.proxy, nil
	}
	return &Proxy{ID: id, Protocol: "http", Host: "127.0.0.1", Port: 8080}, nil
}

func (s *proxyRepoStubForTestProxy) Create(ctx context.Context, proxy *Proxy) error {
	panic("unexpected Create call")
}

func (s *proxyRepoStubForTestProxy) ListByIDs(ctx context.Context, ids []int64) ([]Proxy, error) {
	panic("unexpected ListByIDs call")
}

func (s *proxyRepoStubForTestProxy) Update(ctx context.Context, proxy *Proxy) error {
	panic("unexpected Update call")
}

func (s *proxyRepoStubForTestProxy) Delete(ctx context.Context, id int64) error {
	panic("unexpected Delete call")
}

func (s *proxyRepoStubForTestProxy) List(ctx context.Context, params pagination.PaginationParams) ([]Proxy, *pagination.PaginationResult, error) {
	panic("unexpected List call")
}

func (s *proxyRepoStubForTestProxy) ListWithFilters(ctx context.Context, params pagination.PaginationParams, protocol, status, search string) ([]Proxy, *pagination.PaginationResult, error) {
	panic("unexpected ListWithFilters call")
}

func (s *proxyRepoStubForTestProxy) ListWithFiltersAndAccountCount(ctx context.Context, params pagination.PaginationParams, protocol, status, search string) ([]ProxyWithAccountCount, *pagination.PaginationResult, error) {
	panic("unexpected ListWithFiltersAndAccountCount call")
}

func (s *proxyRepoStubForTestProxy) ListActive(ctx context.Context) ([]Proxy, error) {
	panic("unexpected ListActive call")
}

func (s *proxyRepoStubForTestProxy) ListActiveWithAccountCount(ctx context.Context) ([]ProxyWithAccountCount, error) {
	panic("unexpected ListActiveWithAccountCount call")
}

func (s *proxyRepoStubForTestProxy) ExistsByHostPortAuth(ctx context.Context, host string, port int, username, password string) (bool, error) {
	panic("unexpected ExistsByHostPortAuth call")
}

func (s *proxyRepoStubForTestProxy) CountAccountsByProxyID(ctx context.Context, proxyID int64) (int64, error) {
	panic("unexpected CountAccountsByProxyID call")
}

func (s *proxyRepoStubForTestProxy) ListAccountSummariesByProxyID(ctx context.Context, proxyID int64) ([]ProxyAccountSummary, error) {
	panic("unexpected ListAccountSummariesByProxyID call")
}

type proxyProberStubForTestProxy struct {
	info    *ProxyExitInfo
	latency int64
	err     error
	gotURL  string
}

func (s *proxyProberStubForTestProxy) ProbeProxy(ctx context.Context, proxyURL string) (*ProxyExitInfo, int64, error) {
	s.gotURL = proxyURL
	if s.err != nil {
		return nil, s.latency, s.err
	}
	if s.info != nil {
		return s.info, s.latency, nil
	}
	return &ProxyExitInfo{IP: "203.0.113.10", Country: "Testland", CountryCode: "TL", Region: "North", City: "Example"}, s.latency, nil
}

func TestAdminServiceTestProxyReturnsFailureWhenProberMissing(t *testing.T) {
	svc := &adminServiceImpl{
		proxyRepo: &proxyRepoStubForTestProxy{
			proxy: &Proxy{ID: 7, Protocol: "http", Host: "127.0.0.1", Port: 8080},
		},
	}

	result, err := svc.TestProxy(context.Background(), 7)

	require.NoError(t, err)
	require.NotNil(t, result)
	require.False(t, result.Success)
	require.Equal(t, "代理探测服务未配置", result.Message)
}

func TestAdminServiceTestProxyReturnsProbeResult(t *testing.T) {
	prober := &proxyProberStubForTestProxy{latency: 42}
	svc := &adminServiceImpl{
		proxyRepo: &proxyRepoStubForTestProxy{
			proxy: &Proxy{ID: 8, Protocol: "http", Host: "proxy.example", Port: 8080, Username: "u", Password: "p"},
		},
		proxyProber: prober,
	}

	result, err := svc.TestProxy(context.Background(), 8)

	require.NoError(t, err)
	require.True(t, result.Success)
	require.Equal(t, int64(42), result.LatencyMs)
	require.Equal(t, "203.0.113.10", result.IPAddress)
	require.Contains(t, prober.gotURL, "proxy.example:8080")
}

func TestAdminServiceTestProxyReturnsProbeFailure(t *testing.T) {
	prober := &proxyProberStubForTestProxy{err: errors.New("connect failed")}
	svc := &adminServiceImpl{
		proxyRepo: &proxyRepoStubForTestProxy{
			proxy: &Proxy{ID: 9, Protocol: "http", Host: "127.0.0.1", Port: 8080},
		},
		proxyProber: prober,
	}

	result, err := svc.TestProxy(context.Background(), 9)

	require.NoError(t, err)
	require.False(t, result.Success)
	require.Equal(t, "connect failed", result.Message)
}

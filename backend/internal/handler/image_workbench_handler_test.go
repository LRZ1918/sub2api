package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type imageWorkbenchAPIKeyFake struct {
	keys      []service.APIKey
	byID      map[int64]*service.APIKey
	touchedID int64
}

func (f *imageWorkbenchAPIKeyFake) List(ctx context.Context, userID int64, params pagination.PaginationParams, filters service.APIKeyListFilters) ([]service.APIKey, *pagination.PaginationResult, error) {
	result := make([]service.APIKey, 0, len(f.keys))
	for _, key := range f.keys {
		if key.UserID == userID {
			result = append(result, key)
		}
	}
	return result, &pagination.PaginationResult{Total: int64(len(result)), Page: 1, PageSize: len(result), Pages: 1}, nil
}

func (f *imageWorkbenchAPIKeyFake) GetByID(ctx context.Context, id int64) (*service.APIKey, error) {
	if f.byID == nil {
		for i := range f.keys {
			key := f.keys[i]
			if key.ID == id {
				return &key, nil
			}
		}
		return nil, service.ErrAPIKeyNotFound
	}
	key, ok := f.byID[id]
	if !ok {
		return nil, service.ErrAPIKeyNotFound
	}
	return key, nil
}

func (f *imageWorkbenchAPIKeyFake) CheckAPIKeyQuotaAndExpiry(apiKey *service.APIKey) error {
	if apiKey.IsExpired() {
		return service.ErrAPIKeyExpired
	}
	if apiKey.IsQuotaExhausted() {
		return service.ErrAPIKeyQuotaExhausted
	}
	return nil
}

func (f *imageWorkbenchAPIKeyFake) TouchLastUsed(ctx context.Context, keyID int64) error {
	f.touchedID = keyID
	return nil
}

type imageWorkbenchSettingsFake struct {
	enabled bool
}

func (f imageWorkbenchSettingsFake) GetImageWorkbenchRuntime(ctx context.Context) service.ImageWorkbenchRuntime {
	return service.ImageWorkbenchRuntime{Enabled: f.enabled}
}

type imageWorkbenchChannelFake struct {
	channels map[int64]*service.Channel
}

func (f imageWorkbenchChannelFake) GetChannelForGroup(ctx context.Context, groupID int64) (*service.Channel, error) {
	if f.channels == nil {
		return nil, nil
	}
	return f.channels[groupID], nil
}

func TestImageWorkbenchFeatureFlagDisabledReturns403(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := &ImageWorkbenchHandler{settingService: imageWorkbenchSettingsFake{enabled: false}}

	for _, tc := range []struct {
		name   string
		method string
		path   string
		body   io.Reader
		call   func(*gin.Context)
	}{
		{name: "options", method: http.MethodGet, path: "/api/v1/image-workbench/options", call: handler.Options},
		{name: "generations", method: http.MethodPost, path: "/api/v1/image-workbench/generations", body: strings.NewReader(`{"api_key_id":1}`), call: handler.Generate},
		{name: "edits", method: http.MethodPost, path: "/api/v1/image-workbench/edits", body: strings.NewReader(""), call: handler.Edit},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(tc.method, tc.path, tc.body)
			c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: 42, Concurrency: 2})
			c.Set(string(middleware.ContextKeyUserRole), service.RoleUser)

			tc.call(c)

			require.Equal(t, http.StatusForbidden, w.Code)
			require.Contains(t, w.Body.String(), "图片工作台未开启")
		})
	}
}

func TestImageWorkbenchOptionsReturnsOnlyUsableImageKeysAndModelsWithoutPlaintextKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	groupID := int64(7)
	disabledGroupID := int64(8)
	expiresAt := time.Now().Add(-time.Hour)
	imagePrice := 0.02
	perRequestPrice := 0.03
	allowedGroup := &service.Group{ID: groupID, Name: "特价生图专用分组", Platform: service.PlatformOpenAI, Status: service.StatusActive, AllowImageGeneration: true, Hydrated: true}
	disabledImageGroup := &service.Group{ID: disabledGroupID, Name: "文本分组", Platform: service.PlatformOpenAI, Status: service.StatusActive, AllowImageGeneration: false, Hydrated: true}
	activeUser := &service.User{ID: 42, Status: service.StatusActive, Role: service.RoleUser, Balance: 10, Concurrency: 2}
	handler := &ImageWorkbenchHandler{
		settingService: imageWorkbenchSettingsFake{enabled: true},
		apiKeyService: &imageWorkbenchAPIKeyFake{keys: []service.APIKey{
			{ID: 1, UserID: 42, Key: "sk-visible-secret-0001", Name: "可用图片 Key", Status: service.StatusAPIKeyActive, GroupID: &groupID, Group: allowedGroup, User: activeUser},
			{ID: 2, UserID: 42, Key: "sk-disabled", Name: "禁用 Key", Status: service.StatusAPIKeyDisabled, GroupID: &groupID, Group: allowedGroup, User: activeUser},
			{ID: 3, UserID: 42, Key: "sk-expired", Name: "过期 Key", Status: service.StatusAPIKeyActive, GroupID: &groupID, Group: allowedGroup, User: activeUser, ExpiresAt: &expiresAt},
			{ID: 4, UserID: 42, Key: "sk-no-image", Name: "未开图像", Status: service.StatusAPIKeyActive, GroupID: &disabledGroupID, Group: disabledImageGroup, User: activeUser},
			{ID: 5, UserID: 99, Key: "sk-other-user", Name: "别人 Key", Status: service.StatusAPIKeyActive, GroupID: &groupID, Group: allowedGroup, User: &service.User{ID: 99, Status: service.StatusActive}},
		}},
		channelService: imageWorkbenchChannelFake{channels: map[int64]*service.Channel{
			groupID: {
				ID: groupID,
				ModelPricing: []service.ChannelModelPricing{
					{Platform: service.PlatformOpenAI, Models: []string{"gpt-image-2"}, BillingMode: service.BillingModeImage, ImageOutputPrice: &imagePrice, PerRequestPrice: &perRequestPrice},
					{Platform: service.PlatformOpenAI, Models: []string{"gpt-5.4"}, BillingMode: service.BillingModeToken},
					{Platform: service.PlatformAnthropic, Models: []string{"gpt-image-wrong-platform"}, BillingMode: service.BillingModeImage},
				},
			},
		}},
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/image-workbench/options", nil)
	c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: 42, Concurrency: 2})
	c.Set(string(middleware.ContextKeyUserRole), service.RoleUser)

	handler.Options(c)

	require.Equal(t, http.StatusOK, w.Code)
	require.NotContains(t, w.Body.String(), "sk-visible-secret-0001")
	var envelope struct {
		Data struct {
			APIKeys []struct {
				ID        int64  `json:"id"`
				Name      string `json:"name"`
				MaskedKey string `json:"masked_key"`
			} `json:"api_keys"`
			Models []struct {
				Name string `json:"name"`
			} `json:"models"`
			Defaults struct {
				Model string `json:"model"`
			} `json:"defaults"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &envelope))
	require.Len(t, envelope.Data.APIKeys, 1)
	require.Equal(t, int64(1), envelope.Data.APIKeys[0].ID)
	require.Equal(t, "sk-...0001", envelope.Data.APIKeys[0].MaskedKey)
	require.Len(t, envelope.Data.Models, 1)
	require.Equal(t, "gpt-image-2", envelope.Data.Models[0].Name)
	require.Equal(t, "gpt-image-2", envelope.Data.Defaults.Model)
}

func TestImageWorkbenchOptionsKeepsCurrentUserKeysWhenListRowsDoNotHydrateUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	groupID := int64(7)
	apiKeys := &imageWorkbenchAPIKeyFake{keys: []service.APIKey{
		{
			ID:      1,
			UserID:  42,
			Key:     "sk-visible-secret-0001",
			Name:    "真实列表未预载 User",
			Status:  service.StatusAPIKeyActive,
			GroupID: &groupID,
			Group:   &service.Group{ID: groupID, Name: "图片分组", Platform: service.PlatformOpenAI, Status: service.StatusActive, AllowImageGeneration: true, Hydrated: true},
		},
	}}
	handler := &ImageWorkbenchHandler{
		settingService: imageWorkbenchSettingsFake{enabled: true},
		apiKeyService:  apiKeys,
		channelService: imageWorkbenchChannelFake{channels: map[int64]*service.Channel{
			groupID: {
				ID: groupID,
				ModelPricing: []service.ChannelModelPricing{
					{Platform: service.PlatformOpenAI, Models: []string{"gpt-image-2"}, BillingMode: service.BillingModeImage},
				},
			},
		}},
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/image-workbench/options", nil)
	c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: 42, Concurrency: 2})
	c.Set(string(middleware.ContextKeyUserRole), service.RoleUser)

	handler.Options(c)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"id":1`)
	require.NotContains(t, w.Body.String(), "sk-visible-secret-0001")
}

func TestImageWorkbenchGenerateRejectsOversizedBodyBeforeReadAll(t *testing.T) {
	gin.SetMode(gin.TestMode)
	groupID := int64(7)
	handler := &ImageWorkbenchHandler{
		settingService: imageWorkbenchSettingsFake{enabled: true},
		apiKeyService: &imageWorkbenchAPIKeyFake{byID: map[int64]*service.APIKey{
			1: {
				ID:      1,
				UserID:  42,
				Key:     "sk-real-secret",
				Status:  service.StatusAPIKeyActive,
				GroupID: &groupID,
				User:    &service.User{ID: 42, Status: service.StatusActive, Role: service.RoleUser, Balance: 5, Concurrency: 3},
				Group:   &service.Group{ID: groupID, Platform: service.PlatformOpenAI, Status: service.StatusActive, AllowImageGeneration: true, Hydrated: true},
			},
		}},
		forwardImages: func(c *gin.Context) {
			t.Fatal("请求体超限时不应转发到图片网关")
		},
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/image-workbench/generations", strings.NewReader(`{"api_key_id":1}`))
	c.Request.Body = http.MaxBytesReader(w, c.Request.Body, 4)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: 42, Concurrency: 3})
	c.Set(string(middleware.ContextKeyUserRole), service.RoleUser)

	handler.Generate(c)

	require.Equal(t, http.StatusRequestEntityTooLarge, w.Code)
	require.Contains(t, w.Body.String(), "Request body too large")
}

func TestImageWorkbenchGenerateStripsKeyReferenceAndRejectsPlaintextKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	groupID := int64(7)
	apiKeys := &imageWorkbenchAPIKeyFake{byID: map[int64]*service.APIKey{
		1: {
			ID:      1,
			UserID:  42,
			Key:     "sk-real-secret",
			Name:    "图片 Key",
			Status:  service.StatusAPIKeyActive,
			GroupID: &groupID,
			User:    &service.User{ID: 42, Status: service.StatusActive, Role: service.RoleUser, Balance: 5, Concurrency: 3},
			Group:   &service.Group{ID: groupID, Name: "图片分组", Platform: service.PlatformOpenAI, Status: service.StatusActive, AllowImageGeneration: true, Hydrated: true},
		},
	}}
	forwarded := false
	handler := &ImageWorkbenchHandler{
		settingService: imageWorkbenchSettingsFake{enabled: true},
		apiKeyService:  apiKeys,
		channelService: imageWorkbenchChannelFake{channels: map[int64]*service.Channel{
			groupID: {
				ID: groupID,
				ModelPricing: []service.ChannelModelPricing{
					{Platform: service.PlatformOpenAI, Models: []string{"gpt-image-2"}, BillingMode: service.BillingModeImage},
				},
			},
		}},
		forwardImages: func(c *gin.Context) {
			forwarded = true
			require.Equal(t, "/v1/images/generations", c.Request.URL.Path)
			body, err := io.ReadAll(c.Request.Body)
			require.NoError(t, err)
			require.NotContains(t, string(body), "api_key_id")
			require.NotContains(t, string(body), "sk-real-secret")
			require.Contains(t, string(body), `"prompt"`)
			key, ok := middleware.GetAPIKeyFromContext(c)
			require.True(t, ok)
			require.Equal(t, int64(1), key.ID)
			subject, ok := middleware.GetAuthSubjectFromContext(c)
			require.True(t, ok)
			require.Equal(t, int64(42), subject.UserID)
			c.JSON(http.StatusOK, gin.H{"data": []gin.H{{"url": "https://example.test/image.png"}}})
		},
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/image-workbench/generations", strings.NewReader(`{"api_key_id":1,"model":"gpt-image-2","prompt":"一只猫","n":1}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: 42, Concurrency: 3})
	c.Set(string(middleware.ContextKeyUserRole), service.RoleUser)

	handler.Generate(c)

	require.True(t, forwarded)
	require.Equal(t, http.StatusOK, w.Code)
	require.Equal(t, int64(1), apiKeys.touchedID)

	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/image-workbench/generations", strings.NewReader(`{"api_key_id":1,"api_key":"sk-should-not-send","model":"gpt-image-2","prompt":"test"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: 42, Concurrency: 3})
	c.Set(string(middleware.ContextKeyUserRole), service.RoleUser)

	handler.Generate(c)

	require.Equal(t, http.StatusBadRequest, w.Code)
	require.Contains(t, w.Body.String(), "不接受明文 API Key")
}

func TestImageWorkbenchGenerateRejectsUnsupportedImageModelBeforeGateway(t *testing.T) {
	gin.SetMode(gin.TestMode)
	groupID := int64(7)
	apiKeys := &imageWorkbenchAPIKeyFake{byID: map[int64]*service.APIKey{
		1: {
			ID:      1,
			UserID:  42,
			Key:     "sk-real-secret",
			Status:  service.StatusAPIKeyActive,
			GroupID: &groupID,
			User:    &service.User{ID: 42, Status: service.StatusActive, Role: service.RoleUser, Balance: 5, Concurrency: 3},
			Group:   &service.Group{ID: groupID, Platform: service.PlatformOpenAI, Status: service.StatusActive, AllowImageGeneration: true, Hydrated: true},
		},
	}}
	handler := &ImageWorkbenchHandler{
		settingService: imageWorkbenchSettingsFake{enabled: true},
		apiKeyService:  apiKeys,
		channelService: imageWorkbenchChannelFake{channels: map[int64]*service.Channel{
			groupID: {
				ID: groupID,
				ModelPricing: []service.ChannelModelPricing{
					{Platform: service.PlatformOpenAI, Models: []string{"gpt-image-2"}, BillingMode: service.BillingModeImage},
				},
			},
		}},
		forwardImages: func(c *gin.Context) {
			t.Fatal("模型不支持时不应转发到图片网关")
		},
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/image-workbench/generations", strings.NewReader(`{"api_key_id":1,"model":"gpt-5.4","prompt":"test"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: 42, Concurrency: 3})
	c.Set(string(middleware.ContextKeyUserRole), service.RoleUser)

	handler.Generate(c)

	require.Equal(t, http.StatusForbidden, w.Code)
	require.Contains(t, w.Body.String(), "模型")
	require.Zero(t, apiKeys.touchedID)
}

func TestImageWorkbenchGenerateRejectsForeignOrImageDisabledKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	groupID := int64(7)
	noImageGroupID := int64(8)
	apiKeys := &imageWorkbenchAPIKeyFake{byID: map[int64]*service.APIKey{
		1: {
			ID:      1,
			UserID:  99,
			Key:     "sk-foreign",
			Status:  service.StatusAPIKeyActive,
			GroupID: &groupID,
			User:    &service.User{ID: 99, Status: service.StatusActive, Balance: 5},
			Group:   &service.Group{ID: groupID, Platform: service.PlatformOpenAI, Status: service.StatusActive, AllowImageGeneration: true, Hydrated: true},
		},
		2: {
			ID:      2,
			UserID:  42,
			Key:     "sk-no-image",
			Status:  service.StatusAPIKeyActive,
			GroupID: &noImageGroupID,
			User:    &service.User{ID: 42, Status: service.StatusActive, Balance: 5},
			Group:   &service.Group{ID: noImageGroupID, Platform: service.PlatformOpenAI, Status: service.StatusActive, AllowImageGeneration: false, Hydrated: true},
		},
	}}
	handler := &ImageWorkbenchHandler{
		settingService: imageWorkbenchSettingsFake{enabled: true},
		apiKeyService:  apiKeys,
		forwardImages: func(c *gin.Context) {
			t.Fatal("权限失败时不应转发到图片网关")
		},
	}

	for _, tc := range []struct {
		name      string
		keyID     int
		wantCode  int
		wantError string
	}{
		{name: "foreign key", keyID: 1, wantCode: http.StatusForbidden, wantError: "不属于当前用户"},
		{name: "image disabled group", keyID: 2, wantCode: http.StatusForbidden, wantError: "未开启图片生成权限"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/image-workbench/generations", strings.NewReader(`{"api_key_id":`+strconv.Itoa(tc.keyID)+`,"model":"gpt-image-2","prompt":"test"}`))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: 42, Concurrency: 2})
			c.Set(string(middleware.ContextKeyUserRole), service.RoleUser)

			handler.Generate(c)

			require.Equal(t, tc.wantCode, w.Code)
			require.Contains(t, w.Body.String(), tc.wantError)
		})
	}
}

func TestImageWorkbenchEditMultipartForwardsFilesAndStripsKeyReference(t *testing.T) {
	gin.SetMode(gin.TestMode)
	groupID := int64(7)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("api_key_id", "1"))
	require.NoError(t, writer.WriteField("model", "gpt-image-2"))
	require.NoError(t, writer.WriteField("prompt", "给图片加上柔和光影"))
	image, err := writer.CreateFormFile("image", "source.png")
	require.NoError(t, err)
	_, _ = image.Write([]byte("image-bytes"))
	mask, err := writer.CreateFormFile("mask", "mask.png")
	require.NoError(t, err)
	_, _ = mask.Write([]byte("mask-bytes"))
	require.NoError(t, writer.Close())

	handler := &ImageWorkbenchHandler{
		settingService: imageWorkbenchSettingsFake{enabled: true},
		apiKeyService: &imageWorkbenchAPIKeyFake{byID: map[int64]*service.APIKey{
			1: {
				ID:      1,
				UserID:  42,
				Key:     "sk-edit-secret",
				Status:  service.StatusAPIKeyActive,
				GroupID: &groupID,
				User:    &service.User{ID: 42, Status: service.StatusActive, Role: service.RoleUser, Balance: 5, Concurrency: 2},
				Group:   &service.Group{ID: groupID, Platform: service.PlatformOpenAI, Status: service.StatusActive, AllowImageGeneration: true, Hydrated: true},
			},
		}},
		channelService: imageWorkbenchChannelFake{channels: map[int64]*service.Channel{
			groupID: {
				ID: groupID,
				ModelPricing: []service.ChannelModelPricing{
					{Platform: service.PlatformOpenAI, Models: []string{"gpt-image-2"}, BillingMode: service.BillingModeImage},
				},
			},
		}},
		forwardImages: func(c *gin.Context) {
			require.Equal(t, "/v1/images/edits", c.Request.URL.Path)
			require.NoError(t, c.Request.ParseMultipartForm(8<<20))
			require.Empty(t, c.Request.MultipartForm.Value["api_key_id"])
			require.Equal(t, []string{"gpt-image-2"}, c.Request.MultipartForm.Value["model"])
			require.Len(t, c.Request.MultipartForm.File["image"], 1)
			require.Len(t, c.Request.MultipartForm.File["mask"], 1)
			c.JSON(http.StatusOK, gin.H{"data": []gin.H{{"b64_json": "aW1hZ2U="}}})
		},
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/image-workbench/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: 42, Concurrency: 2})
	c.Set(string(middleware.ContextKeyUserRole), service.RoleUser)

	handler.Edit(c)

	require.Equal(t, http.StatusOK, w.Code)
}

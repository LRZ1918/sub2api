package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/pkg/ctxkey"
	"github.com/Wei-Shaw/sub2api/internal/pkg/ip"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
)

const (
	imageWorkbenchMaxKeys       = 1000
	imageWorkbenchMultipartSize = 64 << 20
)

type imageWorkbenchAPIKeyService interface {
	List(context.Context, int64, pagination.PaginationParams, service.APIKeyListFilters) ([]service.APIKey, *pagination.PaginationResult, error)
	GetByID(context.Context, int64) (*service.APIKey, error)
	CheckAPIKeyQuotaAndExpiry(*service.APIKey) error
	TouchLastUsed(context.Context, int64) error
}

type imageWorkbenchSettingService interface {
	GetImageWorkbenchRuntime(context.Context) service.ImageWorkbenchRuntime
}

type imageWorkbenchSubscriptionService interface {
	GetActiveSubscription(context.Context, int64, int64) (*service.UserSubscription, error)
	ValidateAndCheckLimits(*service.UserSubscription, *service.Group) (bool, error)
	DoWindowMaintenance(*service.UserSubscription)
}

type imageWorkbenchChannelService interface {
	GetChannelForGroup(context.Context, int64) (*service.Channel, error)
}

// ImageWorkbenchHandler exposes native user-side image generation/editing APIs.
type ImageWorkbenchHandler struct {
	apiKeyService       imageWorkbenchAPIKeyService
	subscriptionService imageWorkbenchSubscriptionService
	settingService      imageWorkbenchSettingService
	channelService      imageWorkbenchChannelService
	openAIGateway       *OpenAIGatewayHandler
	forwardImages       func(*gin.Context)
}

func NewImageWorkbenchHandler(
	apiKeyService *service.APIKeyService,
	subscriptionService *service.SubscriptionService,
	settingService *service.SettingService,
	channelService *service.ChannelService,
	openAIGateway *OpenAIGatewayHandler,
) *ImageWorkbenchHandler {
	return &ImageWorkbenchHandler{
		apiKeyService:       apiKeyService,
		subscriptionService: subscriptionService,
		settingService:      settingService,
		channelService:      channelService,
		openAIGateway:       openAIGateway,
	}
}

type imageWorkbenchOptionsResponse struct {
	APIKeys  []imageWorkbenchKeyOption   `json:"api_keys"`
	Models   []imageWorkbenchModelOption `json:"models"`
	Defaults imageWorkbenchDefaults      `json:"defaults"`
}

type imageWorkbenchKeyOption struct {
	ID               int64   `json:"id"`
	Name             string  `json:"name"`
	MaskedKey        string  `json:"masked_key"`
	GroupID          *int64  `json:"group_id,omitempty"`
	GroupName        string  `json:"group_name,omitempty"`
	GroupPlatform    string  `json:"group_platform,omitempty"`
	SubscriptionType string  `json:"subscription_type,omitempty"`
	Balance          float64 `json:"balance,omitempty"`
	QuotaRemaining   float64 `json:"quota_remaining"`
}

type imageWorkbenchModelOption struct {
	Name             string                      `json:"name"`
	Label            string                      `json:"label,omitempty"`
	Platform         string                      `json:"platform"`
	GroupIDs         []int64                     `json:"group_ids,omitempty"`
	Pricing          *imageWorkbenchModelPricing `json:"pricing,omitempty"`
	RawPricing       *imageWorkbenchModelPricing `json:"raw_pricing,omitempty"`
	AvailableKeyIDs  []int64                     `json:"available_key_ids,omitempty"`
	SupportedFormats []string                    `json:"supported_formats,omitempty"`
	Metadata         map[string]string           `json:"metadata,omitempty"`
}

type imageWorkbenchModelPricing struct {
	BillingMode      string                          `json:"billing_mode"`
	ImageOutputPrice *float64                        `json:"image_output_price,omitempty"`
	PerRequestPrice  *float64                        `json:"per_request_price,omitempty"`
	Intervals        []imageWorkbenchPricingInterval `json:"intervals,omitempty"`
}

type imageWorkbenchPricingInterval struct {
	TierLabel       string   `json:"tier_label,omitempty"`
	MinTokens       int      `json:"min_tokens"`
	MaxTokens       *int     `json:"max_tokens,omitempty"`
	PerRequestPrice *float64 `json:"per_request_price,omitempty"`
}

type imageWorkbenchDefaults struct {
	Model       string   `json:"model"`
	Size        string   `json:"size"`
	Quality     string   `json:"quality"`
	Format      string   `json:"format"`
	Count       int      `json:"count"`
	Background  string   `json:"background"`
	Style       string   `json:"style"`
	Sizes       []string `json:"sizes"`
	Qualities   []string `json:"qualities"`
	Formats     []string `json:"formats"`
	Backgrounds []string `json:"backgrounds"`
	Styles      []string `json:"styles"`
}

func (h *ImageWorkbenchHandler) Options(c *gin.Context) {
	if !h.featureEnabled(c) {
		middleware.AbortWithError(c, http.StatusForbidden, "IMAGE_WORKBENCH_DISABLED", "图片工作台未开启")
		return
	}
	subject, ok := middleware.GetAuthSubjectFromContext(c)
	if !ok {
		middleware.AbortWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录")
		return
	}
	if h.apiKeyService == nil {
		middleware.AbortWithError(c, http.StatusInternalServerError, "IMAGE_WORKBENCH_UNAVAILABLE", "图片工作台暂不可用")
		return
	}

	keys, _, err := h.apiKeyService.List(c.Request.Context(), subject.UserID, pagination.PaginationParams{
		Page:      1,
		PageSize:  imageWorkbenchMaxKeys,
		SortOrder: pagination.SortOrderDesc,
	}, service.APIKeyListFilters{})
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}

	keyOptions := make([]imageWorkbenchKeyOption, 0, len(keys))
	modelsByName := make(map[string]*imageWorkbenchModelOption)
	for i := range keys {
		key := &keys[i]
		if !h.apiKeyVisibleForImages(key, subject.UserID) {
			continue
		}
		keyOptions = append(keyOptions, imageWorkbenchKeyOption{
			ID:               key.ID,
			Name:             displayAPIKeyName(key),
			MaskedKey:        maskAPIKey(key.Key),
			GroupID:          key.GroupID,
			GroupName:        key.Group.Name,
			GroupPlatform:    key.Group.Platform,
			SubscriptionType: key.Group.SubscriptionType,
			Balance:          balanceFromKey(key),
			QuotaRemaining:   key.GetQuotaRemaining(),
		})
		h.collectImageModels(c.Request.Context(), key, modelsByName)
	}

	models := make([]imageWorkbenchModelOption, 0, len(modelsByName))
	for _, model := range modelsByName {
		models = append(models, *model)
	}
	sortImageWorkbenchModels(models)
	defaults := defaultImageWorkbenchOptions()
	defaults.Model = defaultImageModel(models)

	response.Success(c, imageWorkbenchOptionsResponse{
		APIKeys:  keyOptions,
		Models:   models,
		Defaults: defaults,
	})
}

func (h *ImageWorkbenchHandler) Generate(c *gin.Context) {
	if !h.featureEnabled(c) {
		middleware.AbortWithError(c, http.StatusForbidden, "IMAGE_WORKBENCH_DISABLED", "图片工作台未开启")
		return
	}
	payload, err := readJSONPayload(c)
	if err != nil {
		if maxErr, ok := extractMaxBytesError(err); ok {
			middleware.AbortWithError(c, http.StatusRequestEntityTooLarge, "REQUEST_BODY_TOO_LARGE", buildBodyTooLargeMessage(maxErr.Limit))
			return
		}
		middleware.AbortWithError(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	apiKeyID, err := apiKeyIDFromPayload(payload)
	if err != nil {
		middleware.AbortWithError(c, http.StatusBadRequest, "INVALID_API_KEY_ID", err.Error())
		return
	}
	if hasForbiddenCredentialFields(payload) {
		middleware.AbortWithError(c, http.StatusBadRequest, "PLAINTEXT_API_KEY_NOT_ALLOWED", "图片工作台不接受明文 API Key 或上游地址")
		return
	}
	model := modelFromPayload(payload)
	deleteImageWorkbenchFields(payload)
	body, err := json.Marshal(payload)
	if err != nil {
		middleware.AbortWithError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求参数无法序列化")
		return
	}

	apiKey, ok := h.prepareGatewayContext(c, apiKeyID)
	if !ok {
		return
	}
	if !h.validateRequestedImageModel(c, apiKey, model) {
		return
	}
	h.touchAPIKey(c, apiKey)
	c.Request.URL.Path = "/v1/images/generations"
	c.Request.RequestURI = ""
	c.Request.Body = io.NopCloser(bytes.NewReader(body))
	c.Request.ContentLength = int64(len(body))
	c.Request.Header.Set("Content-Type", "application/json")
	h.callImagesGateway(c)
}

func (h *ImageWorkbenchHandler) Edit(c *gin.Context) {
	if !h.featureEnabled(c) {
		middleware.AbortWithError(c, http.StatusForbidden, "IMAGE_WORKBENCH_DISABLED", "图片工作台未开启")
		return
	}
	body, contentType, apiKeyID, model, err := rebuildMultipartWithoutKeyReference(c)
	if err != nil {
		if maxErr, ok := extractMaxBytesError(err); ok {
			middleware.AbortWithError(c, http.StatusRequestEntityTooLarge, "REQUEST_BODY_TOO_LARGE", buildBodyTooLargeMessage(maxErr.Limit))
			return
		}
		middleware.AbortWithError(c, http.StatusBadRequest, "INVALID_MULTIPART_REQUEST", err.Error())
		return
	}
	apiKey, ok := h.prepareGatewayContext(c, apiKeyID)
	if !ok {
		return
	}
	if !h.validateRequestedImageModel(c, apiKey, model) {
		return
	}
	h.touchAPIKey(c, apiKey)
	c.Request.URL.Path = "/v1/images/edits"
	c.Request.RequestURI = ""
	c.Request.Body = io.NopCloser(bytes.NewReader(body))
	c.Request.ContentLength = int64(len(body))
	c.Request.Header.Set("Content-Type", contentType)
	c.Request.MultipartForm = nil
	c.Request.Form = nil
	c.Request.PostForm = nil
	h.callImagesGateway(c)
}

func (h *ImageWorkbenchHandler) featureEnabled(c *gin.Context) bool {
	if h == nil || h.settingService == nil {
		return false
	}
	return h.settingService.GetImageWorkbenchRuntime(c.Request.Context()).Enabled
}

func (h *ImageWorkbenchHandler) apiKeyVisibleForImages(key *service.APIKey, currentUserID int64) bool {
	if key == nil || key.Group == nil || key.UserID != currentUserID {
		return false
	}
	if key.Status != service.StatusAPIKeyActive || key.IsExpired() || key.IsQuotaExhausted() {
		return false
	}
	if key.User != nil && !key.User.IsActive() {
		return false
	}
	if !key.Group.IsActive() {
		return false
	}
	if key.Group.Platform != service.PlatformOpenAI || !service.GroupAllowsImageGeneration(key.Group) {
		return false
	}
	if !key.Group.IsSubscriptionType() && key.User != nil && key.User.Balance <= 0 {
		return false
	}
	return true
}

func (h *ImageWorkbenchHandler) collectImageModels(ctx context.Context, key *service.APIKey, models map[string]*imageWorkbenchModelOption) {
	if h.channelService == nil || key == nil || key.GroupID == nil {
		return
	}
	ch, err := h.channelService.GetChannelForGroup(ctx, *key.GroupID)
	if err != nil || ch == nil {
		return
	}
	for _, supported := range ch.SupportedModels() {
		if supported.Platform != service.PlatformOpenAI || !isImageModel(supported.Name) {
			continue
		}
		entry, ok := models[strings.ToLower(supported.Name)]
		if !ok {
			entry = &imageWorkbenchModelOption{
				Name:             supported.Name,
				Label:            supported.Name,
				Platform:         supported.Platform,
				Pricing:          imageWorkbenchPricingFromService(supported.Pricing),
				RawPricing:       imageWorkbenchPricingFromService(supported.Pricing),
				SupportedFormats: []string{"png", "jpeg", "webp"},
			}
			models[strings.ToLower(supported.Name)] = entry
		}
		entry.GroupIDs = appendUniqueInt64(entry.GroupIDs, *key.GroupID)
		entry.AvailableKeyIDs = appendUniqueInt64(entry.AvailableKeyIDs, key.ID)
	}
}

func (h *ImageWorkbenchHandler) prepareGatewayContext(c *gin.Context, apiKeyID int64) (*service.APIKey, bool) {
	subject, ok := middleware.GetAuthSubjectFromContext(c)
	if !ok {
		middleware.AbortWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录")
		return nil, false
	}
	if h.apiKeyService == nil {
		middleware.AbortWithError(c, http.StatusInternalServerError, "IMAGE_WORKBENCH_UNAVAILABLE", "图片工作台暂不可用")
		return nil, false
	}
	apiKey, err := h.apiKeyService.GetByID(c.Request.Context(), apiKeyID)
	if err != nil {
		status := http.StatusInternalServerError
		code := "INTERNAL_ERROR"
		msg := "获取 API Key 失败"
		if errors.Is(err, service.ErrAPIKeyNotFound) {
			status, code, msg = http.StatusNotFound, "API_KEY_NOT_FOUND", "API Key 不存在"
		}
		middleware.AbortWithError(c, status, code, msg)
		return nil, false
	}
	if apiKey == nil {
		middleware.AbortWithError(c, http.StatusNotFound, "API_KEY_NOT_FOUND", "API Key 不存在")
		return nil, false
	}
	if apiKey.UserID != subject.UserID {
		middleware.AbortWithError(c, http.StatusForbidden, "API_KEY_FORBIDDEN", "API Key 不属于当前用户")
		return nil, false
	}
	if !h.validateSelectedAPIKey(c, apiKey) {
		return nil, false
	}
	if !h.attachSubscriptionIfNeeded(c, apiKey) {
		return nil, false
	}

	c.Set(string(middleware.ContextKeyAPIKey), apiKey)
	c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{
		UserID:      apiKey.User.ID,
		Concurrency: apiKey.User.Concurrency,
	})
	c.Set(string(middleware.ContextKeyUserRole), apiKey.User.Role)
	if service.IsGroupContextValid(apiKey.Group) {
		ctx := context.WithValue(c.Request.Context(), ctxkey.Group, apiKey.Group)
		c.Request = c.Request.WithContext(ctx)
	}
	return apiKey, true
}

func (h *ImageWorkbenchHandler) validateSelectedAPIKey(c *gin.Context, apiKey *service.APIKey) bool {
	if !apiKey.IsActive() {
		switch apiKey.Status {
		case service.StatusAPIKeyExpired:
			middleware.AbortWithError(c, http.StatusForbidden, "API_KEY_EXPIRED", "API Key 已过期")
		case service.StatusAPIKeyQuotaExhausted:
			middleware.AbortWithError(c, http.StatusTooManyRequests, "API_KEY_QUOTA_EXHAUSTED", "API Key 额度已用完")
		default:
			middleware.AbortWithError(c, http.StatusUnauthorized, "API_KEY_DISABLED", "API Key 已停用")
		}
		return false
	}
	if err := h.apiKeyService.CheckAPIKeyQuotaAndExpiry(apiKey); err != nil {
		status := http.StatusForbidden
		code := "API_KEY_INVALID"
		if errors.Is(err, service.ErrAPIKeyQuotaExhausted) {
			status, code = http.StatusTooManyRequests, "API_KEY_QUOTA_EXHAUSTED"
		} else if errors.Is(err, service.ErrAPIKeyExpired) {
			code = "API_KEY_EXPIRED"
		}
		middleware.AbortWithError(c, status, code, err.Error())
		return false
	}
	if len(apiKey.IPWhitelist) > 0 || len(apiKey.IPBlacklist) > 0 {
		clientIP := ip.GetTrustedClientIP(c)
		allowed, _ := ip.CheckIPRestrictionWithCompiledRules(clientIP, apiKey.CompiledIPWhitelist, apiKey.CompiledIPBlacklist)
		if !allowed {
			middleware.AbortWithError(c, http.StatusForbidden, "ACCESS_DENIED", "Access denied")
			return false
		}
	}
	if apiKey.User == nil || !apiKey.User.IsActive() {
		middleware.AbortWithError(c, http.StatusUnauthorized, "USER_INACTIVE", "用户状态不可用")
		return false
	}
	if apiKey.Group == nil || !apiKey.Group.IsActive() {
		middleware.AbortWithError(c, http.StatusForbidden, "GROUP_UNAVAILABLE", "API Key 所属分组不可用")
		return false
	}
	if apiKey.Group.Platform != service.PlatformOpenAI {
		middleware.AbortWithError(c, http.StatusForbidden, "GROUP_PLATFORM_NOT_SUPPORTED", "图片工作台当前仅支持 OpenAI 图片分组")
		return false
	}
	if !service.GroupAllowsImageGeneration(apiKey.Group) {
		middleware.AbortWithError(c, http.StatusForbidden, "IMAGE_GENERATION_NOT_ALLOWED", "API Key 所属分组未开启图片生成权限")
		return false
	}
	return true
}

func (h *ImageWorkbenchHandler) attachSubscriptionIfNeeded(c *gin.Context, apiKey *service.APIKey) bool {
	if apiKey == nil || apiKey.User == nil || apiKey.Group == nil {
		return true
	}
	if apiKey.Group.IsSubscriptionType() && h.subscriptionService != nil {
		sub, err := h.subscriptionService.GetActiveSubscription(c.Request.Context(), apiKey.User.ID, apiKey.Group.ID)
		if err != nil {
			middleware.AbortWithError(c, http.StatusForbidden, "SUBSCRIPTION_NOT_FOUND", "当前分组没有有效订阅")
			return false
		}
		needsMaintenance, err := h.subscriptionService.ValidateAndCheckLimits(sub, apiKey.Group)
		if err != nil {
			status := http.StatusForbidden
			code := "SUBSCRIPTION_INVALID"
			if errors.Is(err, service.ErrDailyLimitExceeded) || errors.Is(err, service.ErrWeeklyLimitExceeded) || errors.Is(err, service.ErrMonthlyLimitExceeded) {
				status, code = http.StatusTooManyRequests, "USAGE_LIMIT_EXCEEDED"
			}
			middleware.AbortWithError(c, status, code, err.Error())
			return false
		}
		if needsMaintenance {
			subCopy := *sub
			h.subscriptionService.DoWindowMaintenance(&subCopy)
		}
		c.Set(string(middleware.ContextKeySubscription), sub)
		return true
	}
	if apiKey.User.Balance <= 0 {
		middleware.AbortWithError(c, http.StatusForbidden, "INSUFFICIENT_BALANCE", "账户余额不足")
		return false
	}
	return true
}

func (h *ImageWorkbenchHandler) validateRequestedImageModel(c *gin.Context, apiKey *service.APIKey, model string) bool {
	model = strings.TrimSpace(model)
	if model == "" {
		middleware.AbortWithError(c, http.StatusBadRequest, "IMAGE_MODEL_REQUIRED", "请选择图片模型")
		return false
	}
	if !isImageModel(model) {
		middleware.AbortWithError(c, http.StatusForbidden, "IMAGE_MODEL_NOT_SUPPORTED", "当前模型不支持图片生成")
		return false
	}
	if h.channelService == nil || apiKey == nil || apiKey.GroupID == nil {
		middleware.AbortWithError(c, http.StatusForbidden, "IMAGE_MODEL_NOT_AVAILABLE", "当前分组没有可用图片模型")
		return false
	}
	ch, err := h.channelService.GetChannelForGroup(c.Request.Context(), *apiKey.GroupID)
	if err != nil || ch == nil {
		middleware.AbortWithError(c, http.StatusForbidden, "IMAGE_MODEL_NOT_AVAILABLE", "当前分组没有可用图片模型")
		return false
	}
	for _, supported := range ch.SupportedModels() {
		if supported.Platform == service.PlatformOpenAI && isImageModel(supported.Name) && strings.EqualFold(supported.Name, model) {
			return true
		}
	}
	middleware.AbortWithError(c, http.StatusForbidden, "IMAGE_MODEL_NOT_AVAILABLE", fmt.Sprintf("当前 API Key 所属分组不支持图片模型 %s", model))
	return false
}

func (h *ImageWorkbenchHandler) touchAPIKey(c *gin.Context, apiKey *service.APIKey) {
	if h == nil || h.apiKeyService == nil || apiKey == nil {
		return
	}
	_ = h.apiKeyService.TouchLastUsed(c.Request.Context(), apiKey.ID)
}

func (h *ImageWorkbenchHandler) callImagesGateway(c *gin.Context) {
	if h.forwardImages != nil {
		h.forwardImages(c)
		return
	}
	if h.openAIGateway == nil {
		middleware.AbortWithError(c, http.StatusInternalServerError, "IMAGE_GATEWAY_UNAVAILABLE", "图片网关暂不可用")
		return
	}
	h.openAIGateway.Images(c)
}

func modelFromPayload(payload map[string]any) string {
	if value, ok := payload["model"].(string); ok {
		return strings.TrimSpace(value)
	}
	return ""
}

func readJSONPayload(c *gin.Context) (map[string]any, error) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, imageWorkbenchMultipartSize)
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return nil, err
	}
	if len(strings.TrimSpace(string(body))) == 0 {
		return nil, fmt.Errorf("请求体不能为空")
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("JSON 请求格式错误")
	}
	return payload, nil
}

func apiKeyIDFromPayload(payload map[string]any) (int64, error) {
	for _, field := range []string{"api_key_id", "key_id"} {
		if value, ok := payload[field]; ok {
			return parseAPIKeyID(value)
		}
	}
	return 0, fmt.Errorf("缺少 api_key_id")
}

func parseAPIKeyID(value any) (int64, error) {
	switch v := value.(type) {
	case float64:
		if v <= 0 || v != float64(int64(v)) {
			return 0, fmt.Errorf("api_key_id 无效")
		}
		return int64(v), nil
	case string:
		id, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
		if err != nil || id <= 0 {
			return 0, fmt.Errorf("api_key_id 无效")
		}
		return id, nil
	default:
		return 0, fmt.Errorf("api_key_id 无效")
	}
}

func hasForbiddenCredentialFields(payload map[string]any) bool {
	for _, field := range []string{"key", "api_key", "apiKey", "base_url", "baseUrl"} {
		if _, ok := payload[field]; ok {
			return true
		}
	}
	return false
}

func deleteImageWorkbenchFields(payload map[string]any) {
	for _, field := range []string{"api_key_id", "key_id"} {
		delete(payload, field)
	}
}

func rebuildMultipartWithoutKeyReference(c *gin.Context) ([]byte, string, int64, string, error) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, imageWorkbenchMultipartSize)
	if err := c.Request.ParseMultipartForm(imageWorkbenchMultipartSize); err != nil {
		return nil, "", 0, "", err
	}
	form := c.Request.MultipartForm
	if form == nil {
		return nil, "", 0, "", fmt.Errorf("multipart/form-data 不能为空")
	}
	if hasForbiddenMultipartCredentialFields(form.Value) {
		return nil, "", 0, "", fmt.Errorf("图片工作台不接受明文 API Key 或上游地址")
	}
	apiKeyID, err := apiKeyIDFromMultipartValues(form.Value)
	if err != nil {
		return nil, "", 0, "", err
	}
	model := firstMultipartValue(form.Value, "model")

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for name, values := range form.Value {
		if name == "api_key_id" || name == "key_id" {
			continue
		}
		for _, value := range values {
			if err := writer.WriteField(name, value); err != nil {
				_ = writer.Close()
				return nil, "", 0, "", fmt.Errorf("写入表单字段失败")
			}
		}
	}
	for name, files := range form.File {
		targetName := normalizeImageFileField(name)
		for _, fh := range files {
			if err := copyMultipartFile(writer, targetName, fh); err != nil {
				_ = writer.Close()
				return nil, "", 0, "", err
			}
		}
	}
	if err := writer.Close(); err != nil {
		return nil, "", 0, "", fmt.Errorf("生成 multipart 请求失败")
	}
	return body.Bytes(), writer.FormDataContentType(), apiKeyID, model, nil
}

func apiKeyIDFromMultipartValues(values map[string][]string) (int64, error) {
	for _, field := range []string{"api_key_id", "key_id"} {
		if raw := firstMultipartValue(values, field); raw != "" {
			return parseAPIKeyID(raw)
		}
	}
	return 0, fmt.Errorf("缺少 api_key_id")
}

func hasForbiddenMultipartCredentialFields(values map[string][]string) bool {
	for _, field := range []string{"key", "api_key", "apiKey", "base_url", "baseUrl"} {
		if firstMultipartValue(values, field) != "" {
			return true
		}
	}
	return false
}

func firstMultipartValue(values map[string][]string, field string) string {
	if len(values[field]) == 0 {
		return ""
	}
	return strings.TrimSpace(values[field][0])
}

func normalizeImageFileField(name string) string {
	if strings.HasPrefix(name, "image_") {
		return "image"
	}
	return name
}

func copyMultipartFile(writer *multipart.Writer, fieldName string, fh *multipart.FileHeader) error {
	src, err := fh.Open()
	if err != nil {
		return fmt.Errorf("读取上传文件失败")
	}
	defer src.Close()
	dst, err := writer.CreateFormFile(fieldName, fh.Filename)
	if err != nil {
		return fmt.Errorf("写入上传文件失败")
	}
	if _, err := io.Copy(dst, src); err != nil {
		return fmt.Errorf("复制上传文件失败")
	}
	return nil
}

func displayAPIKeyName(key *service.APIKey) string {
	name := strings.TrimSpace(key.Name)
	if name != "" {
		return name
	}
	return "API Key " + strconv.FormatInt(key.ID, 10)
}

func balanceFromKey(key *service.APIKey) float64 {
	if key == nil || key.User == nil {
		return 0
	}
	return key.User.Balance
}

func maskAPIKey(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if len(raw) <= 8 {
		return "***"
	}
	return raw[:3] + "..." + raw[len(raw)-4:]
}

func isImageModel(model string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(model)), "gpt-image-")
}

func imageWorkbenchPricingFromService(p *service.ChannelModelPricing) *imageWorkbenchModelPricing {
	if p == nil {
		return nil
	}
	billingMode := string(p.BillingMode)
	if billingMode == "" {
		billingMode = string(service.BillingModeToken)
	}
	intervals := make([]imageWorkbenchPricingInterval, 0, len(p.Intervals))
	for _, iv := range p.Intervals {
		intervals = append(intervals, imageWorkbenchPricingInterval{
			TierLabel:       iv.TierLabel,
			MinTokens:       iv.MinTokens,
			MaxTokens:       iv.MaxTokens,
			PerRequestPrice: iv.PerRequestPrice,
		})
	}
	return &imageWorkbenchModelPricing{
		BillingMode:      billingMode,
		ImageOutputPrice: p.ImageOutputPrice,
		PerRequestPrice:  p.PerRequestPrice,
		Intervals:        intervals,
	}
}

func appendUniqueInt64(values []int64, value int64) []int64 {
	for _, existing := range values {
		if existing == value {
			return values
		}
	}
	return append(values, value)
}

func sortImageWorkbenchModels(models []imageWorkbenchModelOption) {
	for i := 0; i < len(models); i++ {
		for j := i + 1; j < len(models); j++ {
			if strings.ToLower(models[j].Name) < strings.ToLower(models[i].Name) {
				models[i], models[j] = models[j], models[i]
			}
		}
	}
}

func defaultImageModel(models []imageWorkbenchModelOption) string {
	for _, model := range models {
		if strings.EqualFold(model.Name, "gpt-image-2") {
			return model.Name
		}
	}
	if len(models) == 0 {
		return ""
	}
	return models[0].Name
}

func defaultImageWorkbenchOptions() imageWorkbenchDefaults {
	return imageWorkbenchDefaults{
		Size:        "1024x1024",
		Quality:     "auto",
		Format:      "png",
		Count:       1,
		Background:  "auto",
		Style:       "vivid",
		Sizes:       []string{"1024x1024", "1024x1536", "1536x1024", "auto"},
		Qualities:   []string{"auto", "low", "medium", "high"},
		Formats:     []string{"png", "jpeg", "webp"},
		Backgrounds: []string{"auto", "transparent", "opaque"},
		Styles:      []string{"vivid", "natural", "auto"},
	}
}

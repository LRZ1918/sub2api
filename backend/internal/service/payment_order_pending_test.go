package service

import (
	"context"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/payment"
	"github.com/stretchr/testify/require"
)

func TestPaymentServiceCountPendingOrders(t *testing.T) {
	ctx := context.Background()
	client := newPaymentConfigServiceTestClient(t)

	user, err := client.User.Create().
		SetEmail("pending@example.com").
		SetPasswordHash("hash").
		SetUsername("pending-user").
		Save(ctx)
	require.NoError(t, err)

	otherUser, err := client.User.Create().
		SetEmail("other-pending@example.com").
		SetPasswordHash("hash").
		SetUsername("other-pending-user").
		Save(ctx)
	require.NoError(t, err)

	createOrder := func(userID int64, suffix string, status string) {
		_, err := client.PaymentOrder.Create().
			SetUserID(userID).
			SetUserEmail("pending@example.com").
			SetUserName("pending-user").
			SetAmount(10).
			SetPayAmount(10).
			SetFeeRate(0).
			SetRechargeCode("PAY-" + suffix).
			SetOutTradeNo("sub2_pending_" + suffix).
			SetPaymentType(payment.TypeAlipay).
			SetPaymentTradeNo("").
			SetOrderType(payment.OrderTypeBalance).
			SetStatus(status).
			SetExpiresAt(time.Now().Add(time.Hour)).
			SetClientIP("127.0.0.1").
			SetSrcHost("localhost").
			Save(ctx)
		require.NoError(t, err)
	}

	createOrder(user.ID, "one", OrderStatusPending)
	createOrder(user.ID, "two", OrderStatusPending)
	createOrder(user.ID, "completed", OrderStatusCompleted)
	createOrder(otherUser.ID, "other", OrderStatusPending)

	svc := &PaymentService{entClient: client}
	count, err := svc.CountPendingOrders(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, 2, count)
}

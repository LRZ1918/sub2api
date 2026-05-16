package migrations

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestReferencePurchasePlansSeedMigration(t *testing.T) {
	content, err := FS.ReadFile("136_seed_reference_purchase_plans.sql")
	require.NoError(t, err)

	sql := string(content)
	for _, expected := range []string{
		"15元120刀月卡",
		"15.00",
		"120.00000000",
		"150元1300刀月卡",
		"150.00",
		"1300.00000000",
		"15元120刀日卡",
		"'day'",
		"90元900刀周卡",
		"900.00000000",
		"300元3000刀月卡",
		"300.00",
		"3000.00000000",
		"gpt-5.5",
		"subscription_plans",
		"groups",
		"ON CONFLICT (name) WHERE deleted_at IS NULL DO UPDATE",
		"allow_messages_dispatch = EXCLUDED.allow_messages_dispatch",
		"default_mapped_model = EXCLUDED.default_mapped_model",
	} {
		require.Contains(t, sql, expected)
	}

	require.Contains(t, sql, "WHERE existing.name = seed_plans.name")
	require.Contains(t, sql, "WHERE subscription_plans.name = seed_plans.name")
}

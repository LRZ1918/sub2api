-- Seed reference purchase plans used by the hosted purchase page.
-- This keeps fresh clones aligned with the locally customized Windows deployment.

WITH seed_groups (
    name,
    description,
    rate_multiplier,
    daily_limit_usd,
    weekly_limit_usd,
    monthly_limit_usd,
    sort_order
) AS (
    VALUES
        ('15元120刀月卡', '按参考站购买页接口整理的套餐分组预设，可按实际上游成本继续调整。', 0.1250::DECIMAL(10,4), 0.00000000::DECIMAL(20,8), 0.00000000::DECIMAL(20,8), 120.00000000::DECIMAL(20,8), 10),
        ('150元1300刀月卡', '按参考站购买页接口整理的套餐分组预设，可按实际上游成本继续调整。', 0.1150::DECIMAL(10,4), 300.00000000::DECIMAL(20,8), 0.00000000::DECIMAL(20,8), 1300.00000000::DECIMAL(20,8), 20),
        ('15元120刀日卡', '按参考站购买页接口整理的套餐分组预设，可按实际上游成本继续调整。', 0.1250::DECIMAL(10,4), 120.00000000::DECIMAL(20,8), 0.00000000::DECIMAL(20,8), 0.00000000::DECIMAL(20,8), 30),
        ('90元900刀周卡', '按参考站购买页接口整理的套餐分组预设，可按实际上游成本继续调整。', 0.1000::DECIMAL(10,4), 300.00000000::DECIMAL(20,8), 900.00000000::DECIMAL(20,8), 0.00000000::DECIMAL(20,8), 40),
        ('300元3000刀月卡', '按参考站购买页接口整理的套餐分组预设，可按实际上游成本继续调整。', 0.1000::DECIMAL(10,4), 300.00000000::DECIMAL(20,8), 0.00000000::DECIMAL(20,8), 3000.00000000::DECIMAL(20,8), 50)
),
upserted_groups AS (
    INSERT INTO groups (
        name,
        description,
        rate_multiplier,
        is_exclusive,
        status,
        platform,
        subscription_type,
        daily_limit_usd,
        weekly_limit_usd,
        monthly_limit_usd,
        supported_model_scopes,
        allow_messages_dispatch,
        default_mapped_model,
        sort_order,
        updated_at
    )
    SELECT
        seed_groups.name,
        seed_groups.description,
        seed_groups.rate_multiplier,
        FALSE,
        'active',
        'openai',
        'subscription',
        seed_groups.daily_limit_usd,
        seed_groups.weekly_limit_usd,
        seed_groups.monthly_limit_usd,
        jsonb_build_array('gpt-5.5'),
        TRUE,
        'gpt-5.5',
        seed_groups.sort_order,
        NOW()
    FROM seed_groups
    ON CONFLICT (name) WHERE deleted_at IS NULL DO UPDATE SET
        description = EXCLUDED.description,
        rate_multiplier = EXCLUDED.rate_multiplier,
        is_exclusive = EXCLUDED.is_exclusive,
        status = EXCLUDED.status,
        platform = EXCLUDED.platform,
        subscription_type = EXCLUDED.subscription_type,
        daily_limit_usd = EXCLUDED.daily_limit_usd,
        weekly_limit_usd = EXCLUDED.weekly_limit_usd,
        monthly_limit_usd = EXCLUDED.monthly_limit_usd,
        supported_model_scopes = EXCLUDED.supported_model_scopes,
        allow_messages_dispatch = EXCLUDED.allow_messages_dispatch,
        default_mapped_model = EXCLUDED.default_mapped_model,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    RETURNING id, name
),
seed_plans (
    group_name,
    name,
    description,
    price,
    original_price,
    validity_days,
    validity_unit,
    product_name,
    features,
    for_sale,
    sort_order
) AS (
    VALUES
        ('15元120刀月卡', '15元120刀月卡', '极度的灵活性', 15.00::DECIMAL(20,2), NULL::DECIMAL(20,2), 1, 'month', '', '', TRUE, 10),
        ('150元1300刀月卡', '150元1300刀月卡', '', 150.00::DECIMAL(20,2), NULL::DECIMAL(20,2), 1, 'month', '', '', TRUE, 20),
        ('15元120刀日卡', '15元120刀日卡', '', 15.00::DECIMAL(20,2), NULL::DECIMAL(20,2), 1, 'day', '', '', TRUE, 30),
        ('90元900刀周卡', '90元900刀周卡', '', 90.00::DECIMAL(20,2), NULL::DECIMAL(20,2), 1, 'week', '', '', TRUE, 40),
        ('300元3000刀月卡', '300元3000刀月卡', '', 300.00::DECIMAL(20,2), NULL::DECIMAL(20,2), 1, 'month', '', '', TRUE, 50)
),
updated_plans AS (
    UPDATE subscription_plans
    SET
        description = seed_plans.description,
        price = seed_plans.price,
        original_price = seed_plans.original_price,
        validity_days = seed_plans.validity_days,
        validity_unit = seed_plans.validity_unit,
        product_name = seed_plans.product_name,
        features = seed_plans.features,
        for_sale = seed_plans.for_sale,
        sort_order = seed_plans.sort_order,
        updated_at = NOW()
    FROM seed_plans
    JOIN upserted_groups ON upserted_groups.name = seed_plans.group_name
    WHERE subscription_plans.name = seed_plans.name
      AND subscription_plans.group_id = upserted_groups.id
    RETURNING subscription_plans.id
)
INSERT INTO subscription_plans (
    group_id,
    name,
    description,
    price,
    original_price,
    validity_days,
    validity_unit,
    product_name,
    features,
    for_sale,
    sort_order,
    updated_at
)
SELECT
    upserted_groups.id,
    seed_plans.name,
    seed_plans.description,
    seed_plans.price,
    seed_plans.original_price,
    seed_plans.validity_days,
    seed_plans.validity_unit,
    seed_plans.product_name,
    seed_plans.features,
    seed_plans.for_sale,
    seed_plans.sort_order,
    NOW()
FROM seed_plans
JOIN upserted_groups ON upserted_groups.name = seed_plans.group_name
WHERE NOT EXISTS (
    SELECT 1
    FROM subscription_plans AS existing
    WHERE existing.name = seed_plans.name
      AND existing.group_id = upserted_groups.id
);

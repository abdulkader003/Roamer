ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

ALTER TABLE expenses
    ADD CONSTRAINT expenses_category_check
        CHECK (category IN ('FLIGHTS', 'HOTELS', 'FOOD', 'TRANSPORT', 'ACTIVITIES', 'OTHERS'));

ALTER TABLE IF EXISTS category_budget_limits
    DROP CONSTRAINT IF EXISTS category_budget_limits_category_check;

ALTER TABLE IF EXISTS category_budget_limits
    ADD CONSTRAINT category_budget_limits_category_check
        CHECK (category IN ('FLIGHTS', 'HOTELS', 'FOOD', 'TRANSPORT', 'ACTIVITIES', 'OTHERS'));

UPDATE category_budget_limits
SET category = 'OTHERS'
WHERE category = 'TRANSPORT'
  AND NOT EXISTS (
      SELECT 1
      FROM category_budget_limits existing
      WHERE existing.owner_id = category_budget_limits.owner_id
        AND existing.category = 'OTHERS'
  );

DELETE FROM category_budget_limits target
USING category_budget_limits legacy
WHERE target.category = 'TRANSPORT'
  AND legacy.category = 'OTHERS'
  AND legacy.owner_id = target.owner_id;

ALTER TABLE IF EXISTS activities
    ALTER COLUMN info TYPE TEXT;

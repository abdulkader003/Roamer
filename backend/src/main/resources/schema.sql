ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

ALTER TABLE expenses
    ADD CONSTRAINT expenses_category_check
        CHECK (category IN ('FLIGHTS', 'HOTELS', 'FOOD', 'TRANSPORT', 'ACTIVITIES', 'OTHERS'));

-- In your Supabase dashboard, go to the SQL Editor and run this entire script.

-- Step 1: Add new risk limit columns to the 'profiles' table
-- We'll give them sensible defaults to avoid issues with existing users.
ALTER TABLE public.profiles
ADD COLUMN daily_loss_limit_percentage numeric NOT NULL DEFAULT 10;

ALTER TABLE public.profiles
ADD COLUMN per_trade_loss_limit_percentage numeric NOT NULL DEFAULT 5;

-- Step 2: Add the opening balance column to the 'portfolios' table
ALTER TABLE public.portfolios
ADD COLUMN opening_balance_today numeric NOT NULL DEFAULT 0;

-- Step 3: Create a function that will update the opening balance for all users
CREATE OR REPLACE FUNCTION public.update_all_opening_balances()
RETURNS void AS $$
BEGIN
  UPDATE public.portfolios
  SET opening_balance_today = cash_balance;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Schedule the function to run every day at midnight IST (18:30 UTC)
-- You may need to enable the pg_cron extension in your Supabase project if it's not already enabled.
-- Go to Database -> Extensions in your Supabase dashboard and search for 'cron'.
SELECT cron.schedule(
  'update-daily-opening-balances', -- name of the job
  '30 18 * * *', -- cron schedule for 18:30 UTC (which is 12:00 AM IST)
  'SELECT public.update_all_opening_balances()'
);

-- Note: To verify the cron job is scheduled, you can run:
-- SELECT * FROM cron.job;

-- To unschedule the job if needed, you can run:
-- SELECT cron.unschedule('update-daily-opening-balances');

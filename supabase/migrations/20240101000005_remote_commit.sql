
--
-- Name: check_and_execute_orders(); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.check_and_execute_orders() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    order_rec RECORD;
    ltp_response json;
    ltp_price REAL;
BEGIN
    -- Loop through all pending limit orders
    FOR order_rec IN
        SELECT id, symbol, exchange, price, order_type
        FROM public.orders
        WHERE status = 'PENDING' AND transaction_type = 'LIMIT'
    LOOP
        BEGIN
            -- Make an HTTP request to an external API to get the latest price
            -- This requires the http extension to be enabled: `create extension if not exists http with schema extensions;`
            SELECT content INTO ltp_response
            FROM http((
                'GET',
                -- IMPORTANT: The URL must be configured with your price-fetching logic.
                -- This example uses a placeholder URL. You'll need to replace this with a real service.
                -- For now, we point it to a Supabase Edge Function that we will create.
                -- Note: secrets like API keys should be handled securely, e.g. via Supabase secrets.
                'https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/get-ltp?symbol=' || order_rec.symbol || '&exchange=' || order_rec.exchange,
                ARRAY[http_header('Authorization', 'Bearer <YOUR_SUPABASE_ANON_KEY>')],
                NULL,
                NULL
            ));

            ltp_price := (ltp_response->>'price')::REAL;

            -- If we got a valid price, check if the order should execute
            IF ltp_price > 0 THEN
                IF (order_rec.order_type = 'BUY' AND ltp_price <= order_rec.price) OR
                   (order_rec.order_type = 'SELL' AND ltp_price >= order_rec.price) THEN
                    -- Price condition met, call the execute_trade function
                    PERFORM public.execute_trade(
                        p_order_id => order_rec.id,
                        p_user_id => (SELECT user_id FROM public.orders WHERE id = order_rec.id),
                        p_symbol => order_rec.symbol,
                        p_exchange => order_rec.exchange,
                        p_instrument_type => (SELECT instrument_type FROM public.orders WHERE id = order_rec.id),
                        p_order_type => order_rec.order_type,
                        p_quantity => (SELECT quantity FROM public.orders WHERE id = order_rec.id),
                        p_price => ltp_price -- Execute at the current market price
                    );
                END IF;
            END IF;

        EXCEPTION
            WHEN others THEN
                -- Log any errors, e.g., to a separate logging table
                RAISE NOTICE 'Error processing order ID %: %', order_rec.id, SQLERRM;
        END;
    END LOOP;
END;
$$;
--
-- Name: FUNCTION check_and_execute_orders(); Type: COMMENT; Schema: public; Owner: postgres
--
COMMENT ON FUNCTION public.check_and_execute_orders() IS 'Periodically checks pending limit orders, fetches their live market price, and triggers execution if the price condition is met.';
ALTER FUNCTION public.check_and_execute_orders() OWNER TO postgres;

--
-- Schedule the function to run every minute
-- This requires the pg_cron extension: `create extension if not exists pg_cron with schema extensions;`
--
SELECT cron.schedule('1-minute-order-check', '* * * * *', 'SELECT public.check_and_execute_orders()');

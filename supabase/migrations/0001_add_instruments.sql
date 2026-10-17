
-- Function to create the table and its indexes idempotently
create or replace function create_instruments_table_and_indexes()
returns void as $$
begin
    -- Create the table only if it doesn't exist
    if not exists (select from pg_tables where schemaname = 'public' and tablename = 'instruments') then
        create table public.instruments (
            instrument_token integer primary key,
            exchange_token integer,
            tradingsymbol text,
            name text,
            last_price double precision,
            expiry date,
            strike double precision,
            tick_size double precision,
            lot_size integer,
            instrument_type text,
            segment text,
            exchange text
        );

        -- Grant permissions to the authenticated user role
        grant select, insert, update, delete on public.instruments to authenticated;
        grant select on public.instruments to anon;

        -- Create indexes for faster searching
        -- Index for the search query on trading symbol (for LIKE 'QUERY%')
        create index if not exists idx_instruments_tradingsymbol_pattern on public.instruments (tradingsymbol text_pattern_ops);
        
        -- A general-purpose GIN index for faster text searching on both name and symbol
        -- This helps with queries like ILIKE '%QUERY%'
        create extension if not exists pg_trgm;
        create index if not exists idx_instruments_search_trgm on public.instruments using gin (name gin_trgm_ops, tradingsymbol gin_trgm_ops);

        -- Index on expiry date to quickly filter out expired contracts
        create index if not exists idx_instruments_expiry on public.instruments (expiry);
    end if;
end;
$$ language plpgsql;

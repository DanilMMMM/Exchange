-- =============================================================================
-- CryptoExchange — Production Paper Trading Platform
-- Database Initialization Script
-- PostgreSQL 15+
-- Run once in pgAdmin or DBeaver after: CREATE DATABASE crypto_exchange_db;
-- =============================================================================

-- ============================================================
-- 0. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fast ILIKE search on pair symbols

-- ============================================================
-- 1. ASSETS (справочник монет)
-- ============================================================
CREATE TABLE IF NOT EXISTS assets (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol          VARCHAR(20) NOT NULL UNIQUE,          -- BTC, ETH, USDT …
    name            VARCHAR(100) NOT NULL,                -- Bitcoin, Ethereum …
    is_base_currency BOOLEAN    NOT NULL DEFAULT FALSE,  -- TRUE только для USDT
    precision_price  INT        NOT NULL DEFAULT 2,       -- знаков после запятой для цены
    precision_qty    INT        NOT NULL DEFAULT 6,       -- знаков после запятой для кол-ва
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_symbol ON assets(symbol);

-- ============================================================
-- 2. TRADING PAIRS (торговые пары)
-- ============================================================
CREATE TABLE IF NOT EXISTS trading_pairs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol          VARCHAR(30) NOT NULL UNIQUE,          -- BTCUSDT, ETHUSDT …
    base_asset_id   UUID        NOT NULL REFERENCES assets(id),
    quote_asset_id  UUID        NOT NULL REFERENCES assets(id),
    min_qty         NUMERIC(28,10) NOT NULL DEFAULT 0.00001,
    max_qty         NUMERIC(28,10) NOT NULL DEFAULT 999999999,
    step_size       NUMERIC(28,10) NOT NULL DEFAULT 0.00001,
    min_notional    NUMERIC(28,10) NOT NULL DEFAULT 1,    -- минимальная сумма сделки USDT
    maker_fee       NUMERIC(10,6) NOT NULL DEFAULT 0.001, -- 0.1 %
    taker_fee       NUMERIC(10,6) NOT NULL DEFAULT 0.001, -- 0.1 %
    futures_maker_fee NUMERIC(10,6) NOT NULL DEFAULT 0.0005, -- 0.05 %
    futures_taker_fee NUMERIC(10,6) NOT NULL DEFAULT 0.0005, -- 0.05 %
    max_leverage    INT          NOT NULL DEFAULT 50,
    is_spot_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    is_futures_active BOOLEAN    NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trading_pairs_symbol ON trading_pairs(symbol);

-- ============================================================
-- 3. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(254) NOT NULL UNIQUE,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    password_hash   VARCHAR(100) NOT NULL,
    is_email_verified BOOLEAN   NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    two_fa_enabled  BOOLEAN     NOT NULL DEFAULT FALSE,
    two_fa_secret   VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================================
-- 4. REFRESH TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(512) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    is_revoked  BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    replaced_by VARCHAR(512)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user   ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token  ON refresh_tokens(token);

-- ============================================================
-- 5. WALLETS (счета пользователей: Spot / Futures)
-- ============================================================
CREATE TABLE IF NOT EXISTS wallets (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_type     VARCHAR(10) NOT NULL CHECK (wallet_type IN ('Spot', 'Futures')),
    asset_id        UUID        NOT NULL REFERENCES assets(id),
    available_balance NUMERIC(28,10) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
    locked_balance    NUMERIC(28,10) NOT NULL DEFAULT 0 CHECK (locked_balance >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, wallet_type, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user     ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_type ON wallets(user_id, wallet_type);

-- ============================================================
-- 6. CRYPTO ADDRESSES (депозитные адреса монет)
-- ============================================================
CREATE TABLE IF NOT EXISTS crypto_addresses (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id    UUID        NOT NULL REFERENCES assets(id),
    network     VARCHAR(30) NOT NULL,   -- BTC, ERC20, TRC20, SOL, TON …
    address     VARCHAR(130) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, asset_id, network)
);

CREATE INDEX IF NOT EXISTS idx_crypto_addresses_user    ON crypto_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_addresses_address ON crypto_addresses(address);

-- ============================================================
-- 7. ORDERS (спотовые и фьючерсные ордера)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trading_pair_id UUID        NOT NULL REFERENCES trading_pairs(id),
    order_type      VARCHAR(10) NOT NULL CHECK (order_type IN ('Market', 'Limit')),
    market_type     VARCHAR(10) NOT NULL CHECK (market_type IN ('Spot', 'Futures')),
    side            VARCHAR(5)  NOT NULL CHECK (side IN ('Buy', 'Sell')),
    direction       VARCHAR(5)  CHECK (direction IN ('Long', 'Short')),  -- только Futures
    status          VARCHAR(12) NOT NULL DEFAULT 'Open'
        CHECK (status IN ('Open', 'Filled', 'PartiallyFilled', 'Cancelled', 'Rejected')),
    price           NUMERIC(28,10),                 -- NULL для Market
    quantity        NUMERIC(28,10) NOT NULL CHECK (quantity > 0),
    filled_quantity NUMERIC(28,10) NOT NULL DEFAULT 0,
    avg_fill_price  NUMERIC(28,10),
    -- Futures specific
    leverage        INT         CHECK (leverage BETWEEN 1 AND 100),
    take_profit     NUMERIC(28,10),
    stop_loss       NUMERIC(28,10),
    -- Финансы
    commission      NUMERIC(28,10) NOT NULL DEFAULT 0,
    locked_amount   NUMERIC(28,10) NOT NULL DEFAULT 0,  -- заморожено при выставлении
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    filled_at       TIMESTAMPTZ,
    client_order_id VARCHAR(64) UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_orders_user       ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_pair       ON orders(trading_pair_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_market_type ON orders(market_type, status);

-- ============================================================
-- 8. TRADES (исполненные сделки)
-- ============================================================
CREATE TABLE IF NOT EXISTS trades (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID        NOT NULL REFERENCES orders(id),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trading_pair_id UUID        NOT NULL REFERENCES trading_pairs(id),
    market_type     VARCHAR(10) NOT NULL CHECK (market_type IN ('Spot', 'Futures')),
    side            VARCHAR(5)  NOT NULL CHECK (side IN ('Buy', 'Sell')),
    direction       VARCHAR(5)  CHECK (direction IN ('Long', 'Short')),
    price           NUMERIC(28,10) NOT NULL,
    quantity        NUMERIC(28,10) NOT NULL CHECK (quantity > 0),
    total           NUMERIC(28,10) NOT NULL,       -- price * quantity
    commission      NUMERIC(28,10) NOT NULL DEFAULT 0,
    commission_asset VARCHAR(20) NOT NULL DEFAULT 'USDT',
    realized_pnl    NUMERIC(28,10),               -- только для закрывающих Futures сделок
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_user   ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_order  ON trades(order_id);
CREATE INDEX IF NOT EXISTS idx_trades_pair   ON trades(trading_pair_id);
CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC);

-- ============================================================
-- 9. FUTURES POSITIONS (открытые фьючерсные позиции)
-- ============================================================
CREATE TABLE IF NOT EXISTS futures_positions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trading_pair_id     UUID        NOT NULL REFERENCES trading_pairs(id),
    direction           VARCHAR(5)  NOT NULL CHECK (direction IN ('Long', 'Short')),
    status              VARCHAR(12) NOT NULL DEFAULT 'Open'
        CHECK (status IN ('Open', 'Closed', 'Liquidated')),
    leverage            INT         NOT NULL CHECK (leverage BETWEEN 1 AND 100),
    entry_price         NUMERIC(28,10) NOT NULL,
    quantity            NUMERIC(28,10) NOT NULL CHECK (quantity > 0),
    initial_margin      NUMERIC(28,10) NOT NULL,
    maintenance_margin  NUMERIC(28,10) NOT NULL,
    liquidation_price   NUMERIC(28,10) NOT NULL,
    take_profit         NUMERIC(28,10),
    stop_loss           NUMERIC(28,10),
    commission          NUMERIC(28,10) NOT NULL DEFAULT 0,
    realized_pnl        NUMERIC(28,10) NOT NULL DEFAULT 0,
    close_price         NUMERIC(28,10),
    close_reason        VARCHAR(20)
        CHECK (close_reason IN ('Manual', 'TakeProfit', 'StopLoss', 'Liquidation', 'PartialClose')),
    version             INT         NOT NULL DEFAULT 0,   -- оптимистическая блокировка
    opened_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at           TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_futures_pos_user       ON futures_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_futures_pos_pair       ON futures_positions(trading_pair_id);
CREATE INDEX IF NOT EXISTS idx_futures_pos_status     ON futures_positions(status);
CREATE INDEX IF NOT EXISTS idx_futures_pos_user_status ON futures_positions(user_id, status);

-- ============================================================
-- 10. TRANSFERS (внутренние переводы между пользователями и между счетами)
-- ============================================================
CREATE TABLE IF NOT EXISTS transfers (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_hash         VARCHAR(80) NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    transfer_type   VARCHAR(15) NOT NULL
        CHECK (transfer_type IN ('Internal', 'BetweenAccounts')),
    sender_user_id  UUID        REFERENCES users(id),
    receiver_user_id UUID       REFERENCES users(id),
    asset_id        UUID        NOT NULL REFERENCES assets(id),
    amount          NUMERIC(28,10) NOT NULL CHECK (amount > 0),
    -- BetweenAccounts: Spot <-> Futures
    from_wallet_type VARCHAR(10) CHECK (from_wallet_type IN ('Spot', 'Futures')),
    to_wallet_type   VARCHAR(10) CHECK (to_wallet_type IN ('Spot', 'Futures')),
    -- Internal transfer between users
    from_address    VARCHAR(130),
    to_address      VARCHAR(130),
    status          VARCHAR(10) NOT NULL DEFAULT 'Completed'
        CHECK (status IN ('Pending', 'Completed', 'Failed')),
    note            VARCHAR(256),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_sender   ON transfers(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_receiver ON transfers(receiver_user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_tx_hash  ON transfers(tx_hash);

-- ============================================================
-- 11. FAVORITE PAIRS (избранные пары пользователя)
-- ============================================================
CREATE TABLE IF NOT EXISTS favorite_pairs (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trading_pair_id UUID NOT NULL REFERENCES trading_pairs(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, trading_pair_id)
);

-- ============================================================
-- 12. SEEDING — ASSETS (26 монет + USDT)
-- ============================================================
INSERT INTO assets (symbol, name, is_base_currency, precision_price, precision_qty) VALUES
    ('USDT',   'Tether USD',          TRUE,  4,  2),
    ('BTC',    'Bitcoin',             FALSE, 2,  6),
    ('ETH',    'Ethereum',            FALSE, 2,  5),
    ('SOL',    'Solana',              FALSE, 3,  4),
    ('BNB',    'BNB',                 FALSE, 2,  4),
    ('XRP',    'XRP',                 FALSE, 5,  2),
    ('TON',    'Toncoin',             FALSE, 4,  3),
    ('DOGE',   'Dogecoin',            FALSE, 6,  0),
    ('ADA',    'Cardano',             FALSE, 5,  0),
    ('AVAX',   'Avalanche',           FALSE, 3,  3),
    ('LINK',   'Chainlink',           FALSE, 4,  2),
    ('DOT',    'Polkadot',            FALSE, 4,  2),
    ('LTC',    'Litecoin',            FALSE, 2,  5),
    ('TRX',    'TRON',                FALSE, 6,  0),
    ('NEAR',   'NEAR Protocol',       FALSE, 4,  2),
    ('SUI',    'Sui',                 FALSE, 4,  2),
    ('ARB',    'Arbitrum',            FALSE, 4,  2),
    ('OP',     'Optimism',            FALSE, 4,  2),
    ('PEPE',   'Pepe',                FALSE, 10, 0),
    ('UNI',    'Uniswap',             FALSE, 4,  2),
    ('ATOM',   'Cosmos',              FALSE, 4,  2),
    ('APT',    'Aptos',               FALSE, 4,  2),
    ('SHIB',   'Shiba Inu',           FALSE, 10, 0),
    ('WIF',    'dogwifhat',           FALSE, 5,  2),
    ('RENDER', 'Render',              FALSE, 4,  2),
    ('NOT',    'Notcoin',             FALSE, 6,  0)
ON CONFLICT (symbol) DO NOTHING;

-- ============================================================
-- 13. SEEDING — TRADING PAIRS (25 пар к USDT)
-- ============================================================
INSERT INTO trading_pairs (symbol, base_asset_id, quote_asset_id, min_qty, step_size, min_notional)
SELECT
    a.symbol || 'USDT',
    a.id,
    u.id,
    CASE a.symbol
        WHEN 'BTC'    THEN 0.000001
        WHEN 'ETH'    THEN 0.00001
        WHEN 'SOL'    THEN 0.001
        WHEN 'BNB'    THEN 0.001
        WHEN 'XRP'    THEN 0.1
        WHEN 'TON'    THEN 0.01
        WHEN 'DOGE'   THEN 1
        WHEN 'ADA'    THEN 1
        WHEN 'AVAX'   THEN 0.001
        WHEN 'LINK'   THEN 0.01
        WHEN 'DOT'    THEN 0.01
        WHEN 'LTC'    THEN 0.0001
        WHEN 'TRX'    THEN 1
        WHEN 'NEAR'   THEN 0.01
        WHEN 'SUI'    THEN 0.1
        WHEN 'ARB'    THEN 0.1
        WHEN 'OP'     THEN 0.1
        WHEN 'PEPE'   THEN 10000
        WHEN 'UNI'    THEN 0.01
        WHEN 'ATOM'   THEN 0.01
        WHEN 'APT'    THEN 0.01
        WHEN 'SHIB'   THEN 10000
        WHEN 'WIF'    THEN 0.1
        WHEN 'RENDER' THEN 0.1
        WHEN 'NOT'    THEN 10
        ELSE 0.01
    END,
    CASE a.symbol
        WHEN 'BTC'    THEN 0.000001
        WHEN 'ETH'    THEN 0.00001
        ELSE 0.001
    END,
    1  -- min_notional 1 USDT
FROM assets a, assets u
WHERE a.symbol != 'USDT'
  AND u.symbol  = 'USDT'
  AND a.is_active = TRUE
ON CONFLICT (symbol) DO NOTHING;

-- Trading pairs table doesn't have precision columns directly, 
-- they come from assets join. The insert above uses the correct base/quote refs.
-- (Remove precision_price/precision_qty columns from INSERT if not in trading_pairs DDL)

-- ============================================================
-- DONE — run this script once, then start the backend.
-- =============================================================================

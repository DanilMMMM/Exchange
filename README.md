# ApexTrade — Production-Grade Paper Trading Crypto Exchange

High-performance cryptocurrency trading platform simulation with real-time Bybit v5 market quotes, built with **.NET 8 (Clean Architecture)** and **React 18 + TypeScript + Vite + Tailwind CSS**.

---

## 🏛️ Architecture Overview

### Backend (.NET 8 Clean Architecture)
- **`Exchange.Domain`**: Core domain entities, enums (`OrderType`, `MarketType`, `Direction`, `OrderStatus`, `PositionStatus`), precise `decimal` financial formulas.
- **`Exchange.Application`**: Business logic interfaces, DTOs, Result monads, Order matching & Risk calculation contracts.
- **`Exchange.Infrastructure`**:
  - `AppDbContext` (PostgreSQL via EF Core with Fluent API, snake_case mapping).
  - `BybitWebSocketService`: Real-time public websocket stream (`wss://stream.bybit.com/v5/public/spot`), 20s heartbeat ping, auto-reconnect backoff.
  - `PriceCache`: High-throughput, thread-safe `ConcurrentDictionary` in-memory ticker cache.
  - `MatchingEngineService`: Background limit order matching engine.
  - `LiquidationEngineService`: Continuous risk engine evaluating isolated margin positions, liquidations, and TP/SL execution.
- **`Exchange.API`**: REST controllers (`/api/auth`, `/api/orders`, `/api/futures`, `/api/wallet`, `/api/market`, `/api/analytics`), SignalR Hub (`/hubs/exchange`), JWT Bearer security, Swagger UI.
- **`Exchange.Tests`**: 28 xUnit unit tests verifying financial math, liquidation formulas, PnL, ROE%, and balance invariants.

### Frontend (React 18 + TypeScript + Vite)
- **TradingView Lightweight Charts** (`lightweight-charts`): Real-time candlestick charts, volume histogram, multi-timeframe switching (1m, 5m, 15m, 1h, 4h, 1d), open order and liquidation price lines directly on the chart.
- **Real-Time Order Book & Market Trades**: Real-time visual depth bars and live transaction tape.
- **Order Placement Form**: Spot and Futures modes, Market / Limit, Leverage slider (1x–50x), balance percentage shortcuts, TP / SL triggers, margin & liquidation pre-calculation.
- **Multi-Tab Terminal**: Live Positions with real-time PnL & ROE%, Open Orders with one-click cancellation, Order History, Trade History.
- **Markets Overview**: 25+ Bybit cryptocurrency pairs with search, favorites, top gainers/losers filters.
- **Wallet & Multi-Chain Addresses**: Spot & Futures balance separation, zero-fee internal accounts transfer, simulated multi-chain deposit addresses (BTC, EVM, TRC20, SOL, TON) with QR codes, off-chain user transfers.
- **Portfolio Analytics**: Performance KPIs, Win Rate %, asset distribution diagram, equity growth curve, and CSV trade journal export.

---

## 🚀 Quick Start Guide

### 1. Database Setup (PostgreSQL)
1. Open **pgAdmin** or **DBeaver**.
2. Run:
   ```sql
   CREATE DATABASE crypto_exchange_db;
   ```
3. Open and execute the script:
   `database/init_db.sql`
   *(Creates all tables, indexes, constraints and seeds 25+ pairs to USDT)*.

### 2. Run Backend (.NET 8)
Using **Visual Studio**:
1. Open `backend/CryptoExchange.sln`.
2. Set `Exchange.API` as Startup Project.
3. Press `F5` or `Ctrl+F5`.
4. Swagger UI will open at `http://localhost:5000/swagger`.

Using **Terminal**:
```bash
cd backend/Exchange.API
dotnet run
```

### 3. Run Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Open terminal in browser at `http://localhost:5173`.

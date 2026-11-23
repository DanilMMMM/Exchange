import { useState, useEffect } from 'react';
import { Navbar } from './components/common/Navbar';
import { Toast } from './components/common/Toast';
import { TerminalPage } from './pages/TerminalPage';
import { MarketsPage } from './pages/MarketsPage';
import { WalletPage } from './pages/WalletPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { useAuthStore } from './store/useAuthStore';
import { useMarketStore } from './store/useMarketStore';
import { useTradeStore } from './store/useTradeStore';
import { signalRService } from './api/signalr';

export function App() {
  const [currentPage, setCurrentPage] = useState<string>('spot');

  const { initAuth } = useAuthStore();
  const {
    fetchPairs,
    fetchTickers,
    selectedSymbol,
    setSelectedSymbol,
    updateTickerPrice,
    addMarketTrade,
  } = useMarketStore();
  const {
    fetchWallets,
    fetchOpenOrders,
    fetchPositions,
    fetchTradeHistory,
    showToast,
  } = useTradeStore();

  useEffect(() => {
    initAuth();
    fetchPairs();
    fetchTickers();
    fetchWallets();
    fetchOpenOrders();
    fetchPositions();
    fetchTradeHistory();

    // Setup initial market data
    setSelectedSymbol(selectedSymbol);

    // Periodic ticker refresh
    const tickerInterval = setInterval(() => {
      fetchTickers();
    }, 5000);

    // Setup SignalR live subscriptions
    signalRService.connect().then((conn) => {
      conn.on('OrderFilled', (data: any) => {
        showToast(data.message || `Order filled: ${data.symbol}`, 'success');
        fetchWallets();
        fetchOpenOrders();
        fetchTradeHistory();
      });

      conn.on('PositionClosed', (data: any) => {
        showToast(data.message || `Position closed: ${data.symbol}`, data.type || 'info');
        fetchWallets();
        fetchPositions();
        fetchTradeHistory();
      });

      conn.on('TickerUpdate', (data: any) => {
        updateTickerPrice(data.symbol, data.price, data.changePercent);
      });

      conn.on('MarketTrade', (data: any) => {
        addMarketTrade(data);
      });
    });

    return () => clearInterval(tickerInterval);
  }, []);

  const handleSelectPair = (symbol: string, mode: 'spot' | 'futures') => {
    setSelectedSymbol(symbol);
    setCurrentPage(mode);
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col font-sans">
      <Navbar currentPage={currentPage} onNavigate={(p) => setCurrentPage(p)} />

      <main className="flex-1">
        {currentPage === 'spot' && <TerminalPage mode="spot" />}
        {currentPage === 'futures' && <TerminalPage mode="futures" />}
        {currentPage === 'markets' && <MarketsPage onSelectPair={handleSelectPair} />}
        {currentPage === 'wallet' && <WalletPage />}
        {currentPage === 'analytics' && <AnalyticsPage />}
      </main>

      <Toast />
    </div>
  );
}

export default App;

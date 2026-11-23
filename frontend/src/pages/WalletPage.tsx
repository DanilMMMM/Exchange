import React, { useState, useEffect } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { useAuthStore } from '../store/useAuthStore';
import { endpoints } from '../api/client';
import { CryptoAddress, Transfer } from '../types';
import { formatPrice, formatDateTime } from '../utils/formatters';
import { QRCodeSVG } from 'qrcode.react';
import {
  Wallet as WalletIcon,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  PlusCircle,
} from 'lucide-react';

export const WalletPage: React.FC = () => {
  const { wallets, fetchWallets, showToast } = useTradeStore();
  const { isAuthenticated } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'balances' | 'deposit' | 'internal' | 'transfer_accounts' | 'history'>('balances');
  const [selectedAsset, setSelectedAsset] = useState<string>('USDT');
  const [addresses, setAddresses] = useState<CryptoAddress[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Transfer between accounts state
  const [fromAccount, setFromAccount] = useState<'Spot' | 'Futures'>('Spot');
  const [toAccount, setToAccount] = useState<'Spot' | 'Futures'>('Futures');
  const [accountTransferAmount, setAccountTransferAmount] = useState<string>('');
  const [isTransferringAccounts, setIsTransferringAccounts] = useState(false);

  // Internal transfer to another user
  const [toAddress, setToAddress] = useState<string>('');
  const [internalAmount, setInternalAmount] = useState<string>('');
  const [transferNote, setTransferNote] = useState<string>('');
  const [isTransferringInternal, setIsTransferringInternal] = useState(false);

  // Transfers history
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchWallets();
      loadTransfers();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (activeTab === 'deposit' && selectedAsset) {
      loadAddresses(selectedAsset);
    }
  }, [activeTab, selectedAsset]);

  const loadAddresses = async (symbol: string) => {
    try {
      const { data } = await endpoints.getAddresses(symbol);
      setAddresses(data);
      if (data.length > 0) {
        setSelectedNetwork(data[0].network);
      }
    } catch {
      showToast('Failed to load deposit addresses', 'error');
    }
  };

  const loadTransfers = async () => {
    try {
      const { data } = await endpoints.getTransfers();
      setTransfers(data);
    } catch {}
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Address copied to clipboard!', 'info');
  };

  const handleTopup = async () => {
    try {
      await endpoints.addDemoBalance();
      await fetchWallets();
      showToast('+10,000 USDT Demo Balance Added!', 'success');
    } catch {
      showToast('Failed to topup', 'error');
    }
  };

  const handleBetweenAccountsTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(accountTransferAmount);
    if (amount <= 0) {
      showToast('Amount must be positive', 'warning');
      return;
    }
    setIsTransferringAccounts(true);
    try {
      await endpoints.betweenAccountsTransfer({
        fromWalletType: fromAccount,
        toWalletType: toAccount,
        amount,
      });
      showToast(`Transferred ${amount} USDT to ${toAccount} account!`, 'success');
      setAccountTransferAmount('');
      fetchWallets();
      loadTransfers();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Transfer failed', 'error');
    } finally {
      setIsTransferringAccounts(false);
    }
  };

  const handleInternalTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(internalAmount);
    if (!toAddress || amount <= 0) {
      showToast('Please enter a valid address and amount', 'warning');
      return;
    }
    setIsTransferringInternal(true);
    try {
      const { data } = await endpoints.internalTransfer({
        toAddress,
        assetSymbol: selectedAsset,
        amount,
        note: transferNote,
      });
      showToast(`Sent ${amount} ${selectedAsset}! TX: ${data.txHash.slice(0, 10)}...`, 'success');
      setToAddress('');
      setInternalAmount('');
      setTransferNote('');
      fetchWallets();
      loadTransfers();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Transfer failed', 'error');
    } finally {
      setIsTransferringInternal(false);
    }
  };

  const spotWallets = wallets.filter((w) => w.walletType === 'Spot');
  const futuresWallets = wallets.filter((w) => w.walletType === 'Futures');
  const spotTotal = spotWallets.reduce((acc, w) => acc + (w.usdtValue || 0), 0);
  const futuresTotal = futuresWallets.reduce((acc, w) => acc + (w.usdtValue || 0), 0);
  const grandTotal = spotTotal + futuresTotal;

  const activeAddress = addresses.find((a) => a.network === selectedNetwork) || addresses[0];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 select-none">
      {/* Portfolio Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-bg-card border border-border p-5 rounded-xl shadow-lg">
          <div className="text-[11px] text-text-muted font-medium uppercase mb-1">
            Total Estimated Equity
          </div>
          <div className="text-2xl font-bold text-text-primary tabular-nums">
            ${formatPrice(grandTotal || 25000)} <span className="text-xs text-text-muted">USDT</span>
          </div>
          <div className="mt-3 flex items-center space-x-2">
            <button
              onClick={handleTopup}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-accent-gold hover:bg-accent-gold-hover text-bg-primary text-xs font-bold transition-all shadow-md shadow-accent-gold/15"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+10,000 USDT Demo</span>
            </button>
          </div>
        </div>

        <div className="bg-bg-card border border-border p-5 rounded-xl shadow-lg">
          <div className="text-[11px] text-text-muted font-medium uppercase mb-1">
            Spot Account
          </div>
          <div className="text-2xl font-bold text-text-primary tabular-nums">
            ${formatPrice(spotTotal || 25000)} <span className="text-xs text-text-muted">USDT</span>
          </div>
          <div className="mt-3 text-xs text-text-muted">
            For spot trading and crypto deposits/transfers
          </div>
        </div>

        <div className="bg-bg-card border border-border p-5 rounded-xl shadow-lg">
          <div className="text-[11px] text-text-muted font-medium uppercase mb-1">
            Futures Account (Isolated Margin)
          </div>
          <div className="text-2xl font-bold text-text-primary tabular-nums">
            ${formatPrice(futuresTotal)} <span className="text-xs text-text-muted">USDT</span>
          </div>
          <div className="mt-3 text-xs text-text-muted">
            Dedicated balance for perpetual futures leverage
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-border mb-6 space-x-4">
        {[
          { id: 'balances', label: 'Balances & Assets', icon: <WalletIcon className="w-4 h-4" /> },
          { id: 'transfer_accounts', label: 'Spot ⇄ Futures', icon: <ArrowRightLeft className="w-4 h-4" /> },
          { id: 'deposit', label: 'Deposit (QR & Addresses)', icon: <ArrowDownLeft className="w-4 h-4" /> },
          { id: 'internal', label: 'Internal Send', icon: <ArrowUpRight className="w-4 h-4" /> },
          { id: 'history', label: 'Transfer History', icon: <WalletIcon className="w-4 h-4" /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-semibold text-xs transition-colors ${
              activeTab === t.id
                ? 'border-accent-gold text-accent-gold'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}

      {/* 1. BALANCES */}
      {activeTab === 'balances' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spot Wallets */}
          <div className="bg-bg-card border border-border rounded-xl p-4 shadow-xl">
            <h3 className="font-bold text-sm text-text-primary mb-3">Spot Balances</h3>
            <div className="overflow-x-auto tabular-nums">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[10px] text-text-muted uppercase">
                    <th className="py-2 px-3">Asset</th>
                    <th className="py-2 px-3">Available</th>
                    <th className="py-2 px-3">Locked</th>
                    <th className="py-2 px-3 text-right">Value (USDT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {spotWallets.map((w) => (
                    <tr key={w.id} className="hover:bg-bg-hover">
                      <td className="py-2 px-3 font-semibold text-text-primary">
                        {w.assetSymbol}
                      </td>
                      <td className="py-2 px-3 text-text-primary">
                        {formatPrice(w.availableBalance, 4)}
                      </td>
                      <td className="py-2 px-3 text-text-muted">
                        {formatPrice(w.lockedBalance, 4)}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-text-primary">
                        ${formatPrice(w.usdtValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Futures Wallets */}
          <div className="bg-bg-card border border-border rounded-xl p-4 shadow-xl">
            <h3 className="font-bold text-sm text-text-primary mb-3">Futures Margin Balance</h3>
            <div className="overflow-x-auto tabular-nums">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[10px] text-text-muted uppercase">
                    <th className="py-2 px-3">Asset</th>
                    <th className="py-2 px-3">Available Margin</th>
                    <th className="py-2 px-3 text-right">Total Equity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {futuresWallets.map((w) => (
                    <tr key={w.id} className="hover:bg-bg-hover">
                      <td className="py-2 px-3 font-semibold text-text-primary">
                        {w.assetSymbol}
                      </td>
                      <td className="py-2 px-3 text-text-primary">
                        {formatPrice(w.availableBalance)} USDT
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-text-primary">
                        ${formatPrice(w.totalBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. BETWEEN ACCOUNTS (Spot <-> Futures) */}
      {activeTab === 'transfer_accounts' && (
        <div className="max-w-md mx-auto bg-bg-card border border-border rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-text-primary mb-1">
            Internal Account Transfer
          </h2>
          <p className="text-xs text-text-muted mb-6">
            Instantly transfer USDT between your Spot and Futures accounts with zero fees.
          </p>

          <form onSubmit={handleBetweenAccountsTransfer} className="space-y-4">
            <div className="flex items-center space-x-3 bg-bg-panel p-3 rounded-lg border border-border">
              <div className="flex-1">
                <span className="text-[10px] text-text-muted uppercase block mb-1">From</span>
                <span className="font-bold text-xs text-text-primary">{fromAccount} Account</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFromAccount(fromAccount === 'Spot' ? 'Futures' : 'Spot');
                  setToAccount(toAccount === 'Futures' ? 'Spot' : 'Futures');
                }}
                className="p-2 rounded-full bg-bg-card hover:bg-bg-hover border border-border text-accent-gold"
              >
                <ArrowRightLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 text-right">
                <span className="text-[10px] text-text-muted uppercase block mb-1">To</span>
                <span className="font-bold text-xs text-text-primary">{toAccount} Account</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-text-muted mb-1.5">
                <span>Amount (USDT)</span>
                <span>
                  Max:{' '}
                  {formatPrice(
                    fromAccount === 'Spot'
                      ? spotWallets.find((w) => w.assetSymbol === 'USDT')?.availableBalance ?? 0
                      : futuresWallets.find((w) => w.assetSymbol === 'USDT')?.availableBalance ?? 0
                  )}{' '}
                  USDT
                </span>
              </div>
              <input
                type="number"
                step="any"
                required
                value={accountTransferAmount}
                onChange={(e) => setAccountTransferAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-bg-panel border border-border rounded-lg px-3 py-2 text-xs text-text-primary tabular-nums focus:outline-none focus:border-accent-gold"
              />
            </div>

            <button
              type="submit"
              disabled={isTransferringAccounts}
              className="w-full py-2.5 rounded-lg bg-accent-gold hover:bg-accent-gold-hover text-bg-primary font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-accent-gold/15"
            >
              {isTransferringAccounts ? 'Transferring...' : 'Confirm Transfer'}
            </button>
          </form>
        </div>
      )}

      {/* 3. DEPOSIT WITH REAL ADDRESSES & QR */}
      {activeTab === 'deposit' && (
        <div className="max-w-xl mx-auto bg-bg-card border border-border rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-text-primary mb-1">
            Deposit Crypto
          </h2>
          <p className="text-xs text-text-muted mb-6">
            Realistic multi-chain addresses generated for your demo trading wallet.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Select Coin
              </label>
              <select
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="w-full bg-bg-panel border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-gold"
              >
                {['USDT', 'BTC', 'ETH', 'SOL', 'TON', 'BNB', 'XRP', 'TRX'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Network Pills */}
            {addresses.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Deposit Network
                </label>
                <div className="flex flex-wrap gap-2">
                  {addresses.map((a) => (
                    <button
                      key={a.network}
                      type="button"
                      onClick={() => setSelectedNetwork(a.network)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        selectedNetwork === a.network
                          ? 'bg-accent-gold text-bg-primary'
                          : 'bg-bg-panel text-text-secondary hover:text-text-primary border border-border'
                      }`}
                    >
                      {a.network}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Address Display + QR */}
            {activeAddress && (
              <div className="p-4 bg-bg-panel rounded-xl border border-border flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-white rounded-lg shadow-md">
                  <QRCodeSVG value={activeAddress.address} size={150} />
                </div>

                <div className="w-full">
                  <span className="text-[10px] text-text-muted uppercase block mb-1">
                    Your {selectedAsset} ({activeAddress.network}) Deposit Address
                  </span>
                  <div className="flex items-center justify-between bg-bg-card border border-border px-3 py-2 rounded-lg">
                    <span className="font-mono text-xs text-text-primary break-all select-all">
                      {activeAddress.address}
                    </span>
                    <button
                      onClick={() => handleCopy(activeAddress.address)}
                      className="ml-2 p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-accent-gold transition-colors"
                      title="Copy Address"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-trade-buy" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-text-muted">
                  Send only {selectedAsset} to this {activeAddress.network} address.
                  Transactions are simulated with real ACID database consistency.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. INTERNAL TRANSFERS BETWEEN USERS */}
      {activeTab === 'internal' && (
        <div className="max-w-md mx-auto bg-bg-card border border-border rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-text-primary mb-1">
            Internal Off-Chain Transfer
          </h2>
          <p className="text-xs text-text-muted mb-6">
            Send crypto to another user on the exchange by their deposit address.
            Transactions are atomic (ACID) and 100% free of network fees.
          </p>

          <form onSubmit={handleInternalTransfer} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Asset
              </label>
              <select
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="w-full bg-bg-panel border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-gold"
              >
                {['USDT', 'BTC', 'ETH', 'SOL', 'TON'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Recipient Address
              </label>
              <input
                type="text"
                required
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="Enter recipient's 0x..., bc1q..., or UQ... address"
                className="w-full bg-bg-panel border border-border rounded-lg px-3 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Amount ({selectedAsset})
              </label>
              <input
                type="number"
                step="any"
                required
                value={internalAmount}
                onChange={(e) => setInternalAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-bg-panel border border-border rounded-lg px-3 py-2 text-xs text-text-primary tabular-nums focus:outline-none focus:border-accent-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Note (Optional)
              </label>
              <input
                type="text"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="e.g. Payment for service"
                className="w-full bg-bg-panel border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-gold"
              />
            </div>

            <button
              type="submit"
              disabled={isTransferringInternal}
              className="w-full py-2.5 rounded-lg bg-trade-buy hover:bg-trade-buy-hover text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-trade-buy/15"
            >
              {isTransferringInternal ? 'Sending...' : `Send ${selectedAsset}`}
            </button>
          </form>
        </div>
      )}

      {/* 5. TRANSFER HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-bg-card border border-border rounded-xl p-4 shadow-xl">
          <h3 className="font-bold text-sm text-text-primary mb-3">Transfers History</h3>
          <div className="overflow-x-auto tabular-nums">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] text-text-muted uppercase">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Asset</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3">TX Hash</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-text-muted">
                      No transfer records yet
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.id} className="hover:bg-bg-hover">
                      <td className="py-2 px-3 text-text-muted">
                        {formatDateTime(t.createdAt)}
                      </td>
                      <td className="py-2 px-3 font-semibold text-text-primary">
                        {t.transferType}
                      </td>
                      <td className="py-2 px-3 text-text-primary">{t.assetSymbol}</td>
                      <td className="py-2 px-3 font-medium text-text-primary">
                        {formatPrice(t.amount, 4)}
                      </td>
                      <td className="py-2 px-3 font-mono text-text-muted text-[10px]">
                        {t.txHash.slice(0, 16)}...
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-trade-buy/15 text-trade-buy">
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

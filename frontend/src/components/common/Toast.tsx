import React from 'react';
import { useTradeStore } from '../../store/useTradeStore';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toastMessage, clearToast } = useTradeStore();

  if (!toastMessage) return null;

  const iconMap = {
    success: <CheckCircle2 className="w-4 h-4 text-trade-buy shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-trade-sell shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-accent-gold shrink-0" />,
    info: <Info className="w-4 h-4 text-text-primary shrink-0" />,
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-3 bg-bg-card border border-border px-4 py-3 rounded-lg shadow-2xl max-w-sm animate-in slide-in-from-bottom-5">
      {iconMap[toastMessage.type]}
      <span className="text-xs text-text-primary font-medium flex-1">
        {toastMessage.text}
      </span>
      <button
        onClick={clearToast}
        className="text-text-muted hover:text-text-primary p-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

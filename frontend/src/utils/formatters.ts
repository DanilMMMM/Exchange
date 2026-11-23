export const formatPrice = (val: number | undefined | null, precision = 2): string => {
  if (val === undefined || val === null || isNaN(val)) return '0.00';
  if (val < 0.0001 && val > 0) return val.toFixed(8);
  if (val < 1 && val > 0) return val.toFixed(4);
  return val.toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
};

export const formatQty = (val: number | undefined | null, precision = 4): string => {
  if (val === undefined || val === null || isNaN(val)) return '0.0000';
  return val.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  });
};

export const formatPercent = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val)) return '+0.00%';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(2)}%`;
};

export const formatDateTime = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return isoString;
  }
};

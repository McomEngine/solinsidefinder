import bs58 from 'bs58';

export const formatNumber = (num: number): string => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
};

export const isValidSolanaAddress = (address: string): boolean => {
  try {
    bs58.decode(address);
    return address.length >= 32 && address.length <= 44;
  } catch (err) {
    return false;
  }
};
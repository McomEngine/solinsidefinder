import { BattleArenaSectionProps } from '../../utils/types';
import TokenBattleWidget from './TokenBattleWidget';

export const BattleArenaSection: React.FC<BattleArenaSectionProps> = ({
  tokenCompareData,
  contractAddress,
  favoriteTokens,
  addFavoriteToken,
  removeFavoriteToken,
}) => {
  return (
    <TokenBattleWidget
      tokenCompareData={tokenCompareData}
      contractAddress={contractAddress}
      favoriteTokens={favoriteTokens}
      addFavoriteToken={addFavoriteToken}
      removeFavoriteToken={removeFavoriteToken}
    />
  );
};

export default BattleArenaSection;
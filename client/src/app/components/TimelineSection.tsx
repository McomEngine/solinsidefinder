import TimelineWidget from './TimelineWidget';

interface TimelineSectionProps {
  timelineData: any[];
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
  setSelectedWallet: (wallet: string | null) => void;
}

export const TimelineSection = ({
  timelineData,
  zoomLevel,
  setZoomLevel,
  setSelectedWallet,
}: TimelineSectionProps) => {
  return (
    <>
      <TimelineWidget
        timelineData={timelineData}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        setSelectedWallet={setSelectedWallet}
      />
      {timelineData.length > 0 && timelineData.every((event: any) => event.priceSource === 'default') && (
        <p className="no-data">
          Price data unavailable for this token. Displaying transactions with default price (0.01 USD).
        </p>
      )}
      {timelineData.length === 0 && (
        <p className="no-data">
          No transaction data available for this token. Try another address.
        </p>
      )}
    </>
  );
};
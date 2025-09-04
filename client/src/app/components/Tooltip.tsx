interface TooltipProps {
    tooltip: { x: number; y: number; text: string } | null;
  }
  
  export const Tooltip = ({ tooltip }: TooltipProps) => {
    if (!tooltip) return null;
  
    return (
      <div
        className="tooltip dystopian-panel"
        style={{
          position: 'absolute',
          top: tooltip.y,
          left: tooltip.x,
          whiteSpace: 'pre-line',
        }}
      >
        {tooltip.text}
      </div>
    );
  };
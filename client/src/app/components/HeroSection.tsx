import { useRef } from 'react';

interface HeroSectionProps {
  showHero: boolean;
  handleDiveIn: () => void;
}

export const HeroSection = ({ showHero, handleDiveIn }: HeroSectionProps) => {
  const heroRef = useRef<HTMLDivElement>(null);

  const titleText = 'BUILD YOUR APP';
  const titleChars = titleText.split('').map((char, index) => (
    <span
      key={index}
      className="code-char"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {char}
    </span>
  ));

  if (!showHero) return null;

  return (
    <div className="hero-section" ref={heroRef}>
      <div className="hero-particles" />
      <div className="hero-content">
        <h1 className="hero-title">{titleChars}</h1>
        <button
          className="enter-button"
          onClick={handleDiveIn}
          aria-label="Enter BUILD YOUR APP"
        >
          <span className="button-text">Enter</span>
          <span className="button-glow" />
        </button>
      </div>
    </div>
  );
};
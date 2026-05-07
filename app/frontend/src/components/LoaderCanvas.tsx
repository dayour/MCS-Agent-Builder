import React, { useState, useEffect } from 'react';

const PHRASES = [
  'Setting things up...',
  'Consulting the stars...',
  'Analyzing intent...',
  'Warming up the neurons...',
  'Picking the right tools...',
  'Mapping your workflow...',
  'Herding the electrons...',
  'Thinking it through...',
  'Connecting the dots...',
  'Lining up the ducks...',
  'Reading between the lines...',
  'Dotting the i\'s...',
  'Building something great...',
  'Almost there...',
];

const CYCLE_MS = 2833;
const TYPING_SPEED_MS = 25;
const FADE_MS = 500;

export const LoaderCanvas: React.FC = () => {
  const [phraseIdx, setPhraseIdx] = useState(() => Math.floor(Math.random() * PHRASES.length));
  const [displayedChars, setDisplayedChars] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const phrase = PHRASES[phraseIdx];

    if (displayedChars < phrase.length) {
      const timer = setTimeout(() => setDisplayedChars(c => c + 1), TYPING_SPEED_MS);
      return () => clearTimeout(timer);
    }

    // Full phrase typed — hold, then fade out, then advance
    let fadeTimer: ReturnType<typeof setTimeout>;
    const holdMs = Math.max(0, CYCLE_MS - (phrase.length * TYPING_SPEED_MS) - FADE_MS);
    const holdTimer = setTimeout(() => {

      setFading(true);
      fadeTimer = setTimeout(() => {
        setPhraseIdx(i => (i + 1) % PHRASES.length);
        setDisplayedChars(0);
        setFading(false);
      }, FADE_MS);
    }, holdMs);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(fadeTimer);
    };
  }, [phraseIdx, displayedChars]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center h-full bg-white">
      <img src="/MCS-Loader.gif" alt="Loading…" />
      <p
        className="text-sm text-[hsl(var(--text-tertiary))] text-center h-5"
        style={{ opacity: fading ? 0 : 1, transition: fading ? 'opacity 500ms' : 'none' }}
      >
        {PHRASES[phraseIdx].slice(0, displayedChars)}
      </p>
    </div>
  );
};

export default LoaderCanvas;

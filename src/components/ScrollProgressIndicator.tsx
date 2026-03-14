import React, { useEffect, useState } from 'react';

export function ScrollProgressIndicator() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let rafId: number | undefined;
    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollProgress = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
        setProgress(scrollProgress);
        rafId = undefined;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="scroll-progress-track">
      <div 
        className="scroll-progress-bar"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}

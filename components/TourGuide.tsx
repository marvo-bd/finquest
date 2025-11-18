import React, { useState, useLayoutEffect, useEffect, useRef } from 'react';

interface TourStep {
  selector: string;
  title: string;
  content: string;
}

interface TourGuideProps {
  steps: TourStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onFinish: () => void;
}

const TourGuide: React.FC<TourGuideProps> = ({ steps, currentStep, onNext, onFinish, onPrev }) => {
  const [position, setPosition] = useState<React.CSSProperties>({ opacity: 0 });
  const [arrowPosition, setArrowPosition] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];

  // Effect to disable body scroll while the tour is active
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  useLayoutEffect(() => {
    const targetElement = document.querySelector(step.selector);
    const tooltipElement = tooltipRef.current;

    if (targetElement && tooltipElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

      // Small delay to allow the smooth scroll to finish before we calculate positions
      const timer = setTimeout(() => {
        const targetRect = targetElement.getBoundingClientRect();
        const tooltipRect = tooltipElement.getBoundingClientRect();
        const PADDING = 16; // 1rem padding from viewport edges
        const GUTTER = 10;
        const isMobile = window.innerWidth < 640;

        let newPosition: React.CSSProperties = {};
        let newArrowPosition: React.CSSProperties = {};

        // --- VERTICAL POSITIONING ---
        const spaceBelow = window.innerHeight - targetRect.bottom;
        const spaceAbove = targetRect.top;
        let top;

        // Default to placing below unless there isn't enough space AND there's more space above.
        if (spaceBelow < tooltipRect.height + PADDING && spaceAbove > spaceBelow) {
            // Place ABOVE
            top = targetRect.top - tooltipRect.height - GUTTER;
            newArrowPosition = { top: '100%', borderTopColor: '#2d3748' };
        } else {
            // Place BELOW
            top = targetRect.bottom + GUTTER;
            newArrowPosition = { bottom: '100%', borderBottomColor: '#2d3748' }; // bg-gray-800
        }

        // Clamp the final position to stay within the viewport
        newPosition.top = Math.max(PADDING, Math.min(top, window.innerHeight - tooltipRect.height - PADDING));


        // --- HORIZONTAL POSITIONING & CLAMPING ---
        if (isMobile) {
            // Center the tooltip horizontally on mobile for a cleaner look.
            newPosition.left = '50%';
            newPosition.transform = 'translateX(-50%)';

            // --- ARROW POSITIONING (Mobile) ---
            const tooltipLeftWhenCentered = (window.innerWidth - tooltipRect.width) / 2;
            const targetCenter = targetRect.left + targetRect.width / 2;
            const arrowLeft = targetCenter - tooltipLeftWhenCentered;
            newArrowPosition.left = `${arrowLeft}px`;

        } else {
            // Use the original desktop logic
            let tooltipCenter = targetRect.left + targetRect.width / 2;
            
            // Clamp tooltip center to viewport
            if (tooltipCenter - tooltipRect.width / 2 < PADDING) {
                tooltipCenter = tooltipRect.width / 2 + PADDING;
            }
            if (tooltipCenter + tooltipRect.width / 2 > window.innerWidth - PADDING) {
                tooltipCenter = window.innerWidth - tooltipRect.width / 2 - PADDING;
            }
            newPosition.left = `${tooltipCenter}px`;
            newPosition.transform = 'translateX(-50%)';

            // --- ARROW POSITIONING (Desktop) ---
            // Calculate where the target's center is relative to the clamped tooltip's left edge
            const targetCenter = targetRect.left + targetRect.width / 2;
            const arrowLeft = targetCenter - (tooltipCenter - tooltipRect.width / 2);
            newArrowPosition.left = `${arrowLeft}px`;
        }
        
        // --- FINAL ARROW CLAMPING ---
        // Clamp arrow position to be within the tooltip bounds to prevent it looking detached
        const arrowClampPadding = 12;
        const currentArrowLeft = parseFloat(newArrowPosition.left as string);
        if (currentArrowLeft < arrowClampPadding) {
            newArrowPosition.left = `${arrowClampPadding}px`;
        }
        if (currentArrowLeft > tooltipRect.width - arrowClampPadding) {
            newArrowPosition.left = `${tooltipRect.width - arrowClampPadding}px`;
        }
        newArrowPosition.transform = 'translateX(-50%)';
        
        setPosition({ ...newPosition, opacity: 1 });
        setArrowPosition(newArrowPosition);

      }, 300); // This delay should match the smooth scroll's typical duration

      return () => clearTimeout(timer);
    }
  }, [currentStep, step.selector]);

  const targetRect = document.querySelector(step.selector)?.getBoundingClientRect();

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/70 animate-fade-in" onClick={onFinish}></div>

      {/* Highlighted element clone */}
      {targetRect && (
        <div
          className="fixed transition-all duration-300 ease-in-out bg-transparent rounded-lg"
          style={{
            top: targetRect.top - 5,
            left: targetRect.left - 5,
            width: targetRect.width + 10,
            height: targetRect.height + 10,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7), 0 0 15px 5px rgba(136, 132, 216, 0.7)',
          }}
        ></div>
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed bg-gray-800 text-white p-5 rounded-lg shadow-2xl w-[calc(100vw-2rem)] max-w-xs z-10 transition-opacity duration-300"
        style={position}
      >
        <div 
            className="absolute w-0 h-0 border-8 border-transparent"
            style={arrowPosition}
        ></div>

        <h3 className="text-lg font-bold mb-2 text-indigo-400">{step.title}</h3>
        <p className="text-sm text-gray-300 mb-4">{step.content}</p>

        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-500">{`${currentStep + 1} / ${steps.length}`}</p>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button onClick={onPrev} className="text-sm py-1 px-3 bg-gray-600 hover:bg-gray-500 rounded-md transition">
                Prev
              </button>
            )}
            {currentStep < steps.length - 1 ? (
              <button onClick={onNext} className="text-sm py-1 px-3 bg-indigo-600 hover:bg-indigo-700 rounded-md transition">
                Next
              </button>
            ) : (
              <button onClick={onFinish} className="text-sm py-1 px-3 bg-green-600 hover:bg-green-700 rounded-md transition">
                Finish
              </button>
            )}
          </div>
        </div>
         <button onClick={onFinish} className="absolute top-2 right-2 text-gray-500 hover:text-white transition text-xs">
            Skip
        </button>
      </div>
    </div>
  );
};

export default TourGuide;

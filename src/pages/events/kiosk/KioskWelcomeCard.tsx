import React, { useEffect, useState } from 'react';
import { CheckCircleIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import { Badge, Button } from '../../../components/UI';

export interface KioskWelcomeCardProps {
  attendeeName: string;
  organization?: string;
  ticketTierName?: string;
  eventTitle: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}

interface ConfettiConfig {
  left: string;
  top: string;
  color: string;
  size: number;
  rotation: number;
  delay: string;
  duration: string;
}

const CONFETTI_PIECES: ConfettiConfig[] = [
  { left: '8%', top: '-8%', color: '#4285F4', size: 10, rotation: 15, delay: '0ms', duration: '2.5s' },
  { left: '16%', top: '-14%', color: '#EA4335', size: 12, rotation: 45, delay: '120ms', duration: '2.8s' },
  { left: '26%', top: '-10%', color: '#FBBC04', size: 9, rotation: 80, delay: '60ms', duration: '2.4s' },
  { left: '38%', top: '-18%', color: '#34A853', size: 14, rotation: 110, delay: '240ms', duration: '3.0s' },
  { left: '50%', top: '-12%', color: '#4285F4', size: 11, rotation: 30, delay: '180ms', duration: '2.6s' },
  { left: '62%', top: '-16%', color: '#EA4335', size: 13, rotation: 75, delay: '90ms', duration: '2.7s' },
  { left: '74%', top: '-10%', color: '#FBBC04', size: 8, rotation: 135, delay: '210ms', duration: '2.3s' },
  { left: '85%', top: '-15%', color: '#34A853', size: 12, rotation: 60, delay: '150ms', duration: '2.9s' },
  { left: '92%', top: '-8%', color: '#4285F4', size: 10, rotation: 95, delay: '30ms', duration: '2.5s' },
  { left: '20%', top: '-22%', color: '#34A853', size: 9, rotation: 160, delay: '300ms', duration: '2.8s' },
  { left: '44%', top: '-25%', color: '#FBBC04', size: 11, rotation: 25, delay: '350ms', duration: '2.9s' },
  { left: '68%', top: '-20%', color: '#4285F4', size: 13, rotation: 70, delay: '280ms', duration: '2.7s' },
  { left: '80%', top: '-24%', color: '#EA4335', size: 10, rotation: 120, delay: '320ms', duration: '3.1s' },
];

export const KioskWelcomeCard: React.FC<KioskWelcomeCardProps> = ({
  attendeeName,
  organization,
  ticketTierName,
  eventTitle,
  onDismiss,
  autoDismissMs = 4000,
}) => {
  const [remainingMs, setRemainingMs] = useState<number>(autoDismissMs);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const left = Math.max(0, autoDismissMs - elapsed);
      setRemainingMs(left);

      if (left <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [autoDismissMs, onDismiss]);

  const progressPercent = Math.max(0, Math.min(100, (remainingMs / autoDismissMs) * 100));
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  return (
    <div
      role="alert"
      aria-live="polite"
      className="w-full max-w-lg bg-surface/90 backdrop-blur-2xl border border-white/50 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.2)] animate-success-pop motion-reduce:animate-none flex flex-col items-center text-center relative overflow-hidden ring-1 ring-white/60"
    >
      {/* Floating Confetti Particle Burst */}
      {CONFETTI_PIECES.map((piece, i) => (
        <div
          key={i}
          className="absolute rounded-sm pointer-events-none motion-reduce:hidden animate-confetti-fall"
          style={{
            left: piece.left,
            top: piece.top,
            backgroundColor: piece.color,
            width: `${piece.size}px`,
            height: `${piece.size * 1.5}px`,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            transform: `rotate(${piece.rotation}deg)`,
            zIndex: 1,
          }}
        />
      ))}

      {/* Google 4-Color Accent Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 flex z-10">
        <div className="h-full w-1/4 bg-[#4285F4]" />
        <div className="h-full w-1/4 bg-[#EA4335]" />
        <div className="h-full w-1/4 bg-[#FBBC04]" />
        <div className="h-full w-1/4 bg-[#34A853]" />
      </div>

      {/* Auto-reset progress indicator line */}
      <div className="absolute top-1.5 left-0 right-0 h-1 bg-success/20 overflow-hidden z-10">
        <div
          className="h-full bg-success transition-transform duration-75 ease-linear will-change-transform"
          style={{ transform: `scaleX(${progressPercent / 100})`, transformOrigin: 'left' }}
        />
      </div>

      {/* Celebratory Checkmark Icon with Glowing Radial Shadow */}
      <div className="w-20 h-20 rounded-full bg-success-container text-success flex items-center justify-center mb-4 ring-8 ring-success/20 shadow-[0_0_28px_rgba(52,168,83,0.35)] animate-pop-in motion-reduce:animate-none z-10">
        <CheckCircleIcon className="w-14 h-14" />
      </div>

      <span className="text-xs uppercase tracking-widest font-extrabold text-success mb-1 z-10">
        Check-In Verified
      </span>

      <h2 className="text-2xl sm:text-3xl font-extrabold text-on-surface mb-2 break-words max-w-full tracking-tight z-10">
        Welcome, {attendeeName}!
      </h2>

      {organization && (
        <p className="text-base font-medium text-on-surface-variant mb-3 z-10">
          {organization}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 mb-6 z-10">
        {ticketTierName && (
          <Badge tone="info" className="text-sm px-3.5 py-1 font-semibold shadow-sm">
            {ticketTierName}
          </Badge>
        )}
        <Badge tone="neutral" className="text-sm px-3.5 py-1 font-medium bg-surface-container shadow-sm">
          {eventTitle}
        </Badge>
      </div>

      {/* Immediate Dismiss / Next Attendee Button */}
      <Button
        variant="filled"
        size="lg"
        onClick={onDismiss}
        iconTrailing={<ArrowRightIcon className="w-5 h-5" />}
        className="w-full min-h-[52px] text-base font-semibold shadow-md z-10"
      >
        Next Attendee ({remainingSeconds}s)
      </Button>
    </div>
  );
};

export default KioskWelcomeCard;

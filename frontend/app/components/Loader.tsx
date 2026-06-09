"use client";

export default function Loader({
  text = "Loading...",
  centerInViewport = false,
  className = "",
}: {
  text?: string;
  centerInViewport?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center space-y-4 animate-fade-in w-full ${
        centerInViewport
          ? "fixed inset-0 z-50 bg-white/80 backdrop-blur-sm h-screen w-screen"
          : "py-12 px-4"
      } ${className}`}
    >
      <div className="relative flex items-center justify-center">
        {/* Animated outer ring */}
        <div className="h-10 w-10 rounded-full border-4 border-[#c322f4]/20 border-t-[#c322f4] animate-spin" />
        {/* Decorative inner pulsing dot */}
        <div className="absolute h-3.5 w-3.5 rounded-full bg-gradient-to-r from-[#d779f4] to-[#c322f4] animate-pulse" />
      </div>
      {text && (
        <span className="text-[10px] font-black uppercase tracking-widest text-[#c322f4] animate-pulse">
          {text}
        </span>
      )}
    </div>
  );
}

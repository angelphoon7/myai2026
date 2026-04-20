import type { ReactNode } from "react";

type IPhone13FrameProps = {
  children: ReactNode;
};

/**
 * iPhone 13–style device chrome (~390×844 pt) for dev / preview.
 * On narrow viewports the frame is hidden so real phones stay full-screen.
 */
export default function IPhone13Frame({ children }: IPhone13FrameProps) {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-white md:min-h-dvh md:items-center md:justify-center md:bg-[#d4d4d8] md:py-8">
      <div
        className={[
          "relative flex w-full flex-1 flex-col md:flex-none",
          "md:aspect-[390/844] md:w-[min(390px,calc(100vw-4rem))] md:max-h-[min(90dvh,844px)]",
          "md:rounded-[3.25rem] md:bg-[#1c1c1e] md:p-[10px]",
          "md:shadow-[0_2px_0_0_rgba(255,255,255,0.06)_inset,0_24px_80px_rgba(0,0,0,0.38),0_8px_24px_rgba(0,0,0,0.22)]",
        ].join(" ")}
      >
        {/* Mute / volume rails (decorative) */}
        <span
          className="pointer-events-none absolute -left-[2px] top-[18%] z-30 hidden h-7 w-[3px] rounded-l-sm bg-[#2c2c2e] md:block"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -left-[2px] top-[24%] z-30 hidden h-12 w-[3px] rounded-l-sm bg-[#2c2c2e] md:block"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -left-[2px] top-[31%] z-30 hidden h-12 w-[3px] rounded-l-sm bg-[#2c2c2e] md:block"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -right-[2px] top-[26%] z-30 hidden h-20 w-[3px] rounded-r-sm bg-[#2c2c2e] md:block"
          aria-hidden
        />

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white md:rounded-[2.65rem] md:bg-white">
          {/* Notch */}
          <div
            className="pointer-events-none absolute left-1/2 top-0 z-40 hidden h-[30px] w-[120px] -translate-x-1/2 rounded-b-[18px] bg-zinc-900 md:block"
            aria-hidden
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
            {children}
          </div>

          {/* Home indicator */}
          <div
            className="pointer-events-none absolute bottom-2 left-1/2 z-40 hidden h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-black/20 md:block"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

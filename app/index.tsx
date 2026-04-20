import React, { useCallback, useEffect, useRef, useState } from "react";

export default function Home() {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const bgPlaylist = ["/caregiver.mp4", "/feed.mp4", "/shirt.mp4"] as const;
  const [bgIndex, setBgIndex] = useState<number>(0);

  const handleVideoEnded = useCallback(() => {
    setBgIndex((i) => (i + 1) % bgPlaylist.length);
  }, [bgPlaylist.length]);

  useEffect(() => {
    // Play the newly active video automatically
    const el = videoRefs.current[bgIndex];
    if (el) {
      el.play().catch(() => {});
    }
  }, [bgIndex]);

  const InputIcon = ({
    children,
  }: {
    children: React.ReactNode;
  }) => (
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/70">
      {children}
    </span>
  );

  return (
    <div className="relative h-dvh w-full flex-1 overflow-hidden bg-black">
      {/* Background videos stacked for smooth crossfade transition */}
      {bgPlaylist.map((src, index) => (
        <video
          key={src}
          ref={(el) => {
            videoRefs.current[index] = el;
          }}
          className={`absolute inset-x-0 top-0 h-[70dvh] w-full object-cover [object-position:center_bottom] transition-opacity duration-1000 [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)] ${
            index === bgIndex ? "opacity-100" : "opacity-0"
          }`}
          src={src}
          muted
          playsInline
          preload="auto"
          onEnded={index === bgIndex ? handleVideoEnded : undefined}
        />
      ))}

      {/* Mask bottom-right corner to hide the video logo */}
      <div className="pointer-events-none absolute bottom-0 right-0 z-10 h-14 w-24 bg-black/0 sm:h-16 sm:w-28" />

      {/* Darken lower area for readability */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[62dvh] bg-gradient-to-b from-transparent via-black/40 to-black/80" />

      {/* Overlay login panel (starts higher, overlaps background) */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col justify-end bg-gradient-to-b from-transparent to-black/40 px-5 pb-8 pt-10 text-white">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
            Welcome!
          </h1>

          <form className="space-y-2.5">
            <div className="relative">
              <InputIcon>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M20 21a8 8 0 1 0-16 0"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </InputIcon>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Username"
                className="h-11 w-full rounded-xl border border-white/18 bg-white/10 pl-11 pr-4 text-[15px] text-white shadow-sm outline-none placeholder:text-white/80 focus:border-white/35 focus:bg-white/20"
              />
            </div>

            <div className="relative">
              <InputIcon>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M7 11V8a5 5 0 0 1 10 0v3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M6 11h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </InputIcon>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                className="h-11 w-full rounded-xl border border-white/18 bg-white/10 pl-11 pr-11 text-[15px] text-white shadow-sm outline-none placeholder:text-white/80 focus:border-white/35 focus:bg-white/20"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Toggle password visibility"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M2 12s3.636-7 10-7 10 7 10 7-3.636 7-10 7-10-7-10-7Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 text-sm drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]">
              <label className="flex items-center gap-2 text-white/80">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/30 bg-white/10 text-white accent-zinc-500"
                />
                Remember me
              </label>
              <button
                type="button"
                className="font-medium text-gray-300 hover:text-white"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="button"
              className="mt-2 h-11 w-full rounded-xl bg-white text-sm font-extrabold tracking-[0.24em] text-black shadow-[0_10px_28px_rgba(255,255,255,0.15)] transition-colors hover:bg-gray-100 active:bg-gray-200"
            >
              LOGIN
            </button>

            <div className="relative mt-2 flex items-center py-2">
              <div className="flex-grow border-t border-white/20"></div>
              <span className="shrink-0 px-3 text-xs text-white/50">OR</span>
              <div className="flex-grow border-t border-white/20"></div>
            </div>

            <button
              type="button"
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-white text-sm font-bold text-gray-900 shadow-sm transition-all hover:bg-gray-100 active:bg-gray-200"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="pt-3 text-center text-sm text-white/70 drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                className="font-semibold text-gray-300 hover:text-white"
              >
                Sign up
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

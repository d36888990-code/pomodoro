import { useState, useEffect, useCallback, useRef } from "react";

type Phase = "focus" | "shortBreak" | "longBreak";

interface PhaseConfig {
  label: string;
  duration: number; // seconds
  color: string;
}

const PHASE_CONFIG: Record<Phase, PhaseConfig> = {
  focus: { label: "专注", duration: 25 * 60, color: "#0071e3" },
  shortBreak: { label: "短休息", duration: 5 * 60, color: "#5e5ce6" },
  longBreak: { label: "长休息", duration: 15 * 60, color: "#ff9f0a" },
};

const PHASE_ORDER: Phase[] = [
  "focus", "shortBreak", "focus", "shortBreak",
  "focus", "shortBreak", "focus", "longBreak",
];

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(PHASE_CONFIG[PHASE_ORDER[0]].duration);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseIndexRef = useRef(phaseIndex);

  // Keep ref in sync
  useEffect(() => { phaseIndexRef.current = phaseIndex; }, [phaseIndex]);

  const currentPhase = PHASE_ORDER[phaseIndex];
  const config = PHASE_CONFIG[currentPhase];
  const totalTime = config.duration;
  const progress = 1 - timeLeft / totalTime;

  // Ring SVG math
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const advancePhase = useCallback(() => {
    const nextIndex = (phaseIndexRef.current + 1) % PHASE_ORDER.length;
    setPhaseIndex(nextIndex);
    setTimeLeft(PHASE_CONFIG[PHASE_ORDER[nextIndex]].duration);
    setIsRunning(false);
  }, []);

  const start = useCallback(() => {
    clearTimer();
    setIsRunning(true);
  }, [clearTimer]);

  const pause = useCallback(() => {
    clearTimer();
    setIsRunning(false);
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    setTimeLeft(config.duration);
  }, [clearTimer, config.duration]);

  const skip = useCallback(() => {
    clearTimer();
    advancePhase();
  }, [clearTimer, advancePhase]);

  // Main timer interval
  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          const current = phaseIndexRef.current;
          const nextIdx = (current + 1) % PHASE_ORDER.length;
          const nextConfig = PHASE_CONFIG[PHASE_ORDER[nextIdx]];

          // Notify
          const phaseLabel = PHASE_CONFIG[PHASE_ORDER[nextIdx]].label;
          window.electronAPI?.showNotification?.("番茄钟", `${phaseLabel}时间到！`);

          setPhaseIndex(nextIdx);
          setIsRunning(false);
          return nextConfig.duration;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [isRunning, clearTimer]);

  // Reset timeLeft when phase changes externally
  useEffect(() => {
    setTimeLeft(config.duration);
  }, [phaseIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleClose = () => {
    window.electronAPI?.close?.();
  };

  const handleMinimize = () => {
    window.electronAPI?.minimize?.();
  };

  return (
    <div className={`${darkMode ? "dark" : ""} h-full`}>
      <div className="relative h-full overflow-hidden frost-glass rounded-[16px]">
        {/* macOS traffic light style buttons + title */}
        <div className="titlebar">
          {/* Close, Minimize simulation (only visual) */}
          <div className="absolute left-4 top-[11px] flex items-center gap-[7px] titlebar-button">
            <div
              onClick={handleClose}
              className="w-[13px] h-[13px] rounded-full bg-[#fe5f57] hover:brightness-90 cursor-pointer transition-all duration-150 border-[0.5px] border-[rgba(0,0,0,0.1)]"
              title="隐藏到托盘"
            />
            <div
              onClick={handleMinimize}
              className="w-[13px] h-[13px] rounded-full bg-[#febc2e] hover:brightness-90 cursor-pointer transition-all duration-150 border-[0.5px] border-[rgba(0,0,0,0.1)]"
              title="最小化"
            />
            <div className="w-[13px] h-[13px] rounded-full bg-[#28c840] border-[0.5px] border-[rgba(0,0,0,0.1)]" />
          </div>
          <span className="text-[13px] font-semibold tracking-[0.3px] text-[#1d1d1f]/60 dark:text-[#f5f5f7]/50">
            番茄钟
          </span>
        </div>

        {/* Dark/Light toggle */}
        <button
          onClick={() => setDarkMode((prev) => !prev)}
          className="btn absolute top-[9px] right-4 z-50 text-[16px] opacity-25 hover:opacity-60 transition-all duration-200"
        >
          {darkMode ? "☀️" : "🌙"}
        </button>

        {/* Main Content */}
        <div className="flex flex-col items-center justify-center h-full pt-8 pb-10 px-8">
          {/* Phase indicator dots */}
          <div className="flex items-center gap-[5px] mb-3">
            {PHASE_ORDER.map((phase, i) => (
              <div
                key={i}
                className="phase-dot"
                style={{
                  background:
                    i === phaseIndex
                      ? config.color
                      : darkMode
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.08)",
                  transform: i === phaseIndex ? "scale(1.3)" : "scale(1)",
                  boxShadow:
                    i === phaseIndex
                      ? `0 0 6px ${config.color}60`
                      : "none",
                }}
              />
            ))}
          </div>

          {/* Phase label */}
          <p
            className="text-[12px] font-semibold tracking-[1px] uppercase mb-5 transition-colors duration-300"
            style={{ color: config.color }}
          >
            {config.label}
          </p>

          {/* Circular progress ring */}
          <div className="relative flex items-center justify-center mb-7">
            <svg width={270} height={270} className="progress-ring">
              <circle
                cx="135"
                cy="135"
                r={radius}
                className="progress-ring__circle-bg"
                strokeWidth="3"
              />
              <circle
                cx="135"
                cy="135"
                r={radius}
                className="progress-ring__circle"
                stroke={config.color}
                strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ filter: `drop-shadow(0 0 6px ${config.color}50)` }}
              />
            </svg>

            {/* Center timer text */}
            <div className="absolute flex flex-col items-center">
              <span className="text-[62px] font-[275] tracking-[2px] tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] transition-all duration-300">
                {formatTime(timeLeft)}
              </span>
              <span className="text-[11px] font-medium text-[#86868b] dark:text-[#98989d] tracking-[0.5px] mt-0.5">
                {progress >= 1 ? "已完成" : isRunning ? "进行中" : "已暂停"}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {!isRunning ? (
              <button onClick={start} className="btn btn-primary">
                开始
              </button>
            ) : (
              <button onClick={pause} className="btn btn-primary">
                暂停
              </button>
            )}
            <button onClick={reset} className="btn btn-secondary">
              重置
            </button>
            <button onClick={skip} className="btn btn-secondary">
              跳过
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

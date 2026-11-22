import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

const DEFAULT_INTERVAL = 4000;

// Polls the cheap submission count and only pulls the full consensus preview
// when that count actually moves, so an open monitor stays light.
export function useExamLive(examId, { onSubmission, onComputed, intervalMs = DEFAULT_INTERVAL } = {}) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const handlers = useRef({ onSubmission, onComputed });
  handlers.current = { onSubmission, onComputed };

  useEffect(() => {
    if (!examId) return undefined;

    let cancelled = false;
    let timer = null;
    let lastCount = null;

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(tick, document.hidden ? intervalMs * 4 : intervalMs);
    };

    const tick = async () => {
      if (cancelled) return;
      if (document.hidden) return schedule();

      try {
        const { submissionCount } = await api.submissionCount(examId);
        if (cancelled) return;
        setConnected(true);

        if (lastCount !== null && submissionCount > lastCount) {
          const preview = await api.liveConsensus(examId);
          if (cancelled) return;
          const payload = { examId, submittedAt: new Date().toISOString(), ...preview };
          setLastEvent({ type: 'submission', at: Date.now(), payload });
          handlers.current.onSubmission?.(payload);
        }
        lastCount = submissionCount;
      } catch {
        if (!cancelled) setConnected(false);
      }
      schedule();
    };

    tick();
    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [examId, intervalMs]);

  return { connected, lastEvent };
}

export default useExamLive;

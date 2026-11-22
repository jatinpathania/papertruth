import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsync(fn, deps = [], { skip = false } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: !skip });
  const callback = useRef(fn);
  callback.current = fn;
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (skip) {
      setState({ data: null, error: null, loading: false });
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    Promise.resolve(callback.current(controller.signal))
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return;
        setState({ data: null, error, loading: false });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [...deps, nonce, skip]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((data) => setState((previous) => ({ ...previous, data })), []);
  return { ...state, reload, setData };
}

export default useAsync;

/**
 * useIsMountedRef — returns a ref whose `.current` is `true` while the
 * component is mounted and flips to `false` on unmount. Use it to
 * short-circuit async callbacks that would otherwise call `setState`
 * on an unmounted component (React no longer warns, but the work is
 * still wasted and can mask real bugs).
 *
 *   const mounted = useIsMountedRef();
 *   doAsync().then((x) => { if (mounted.current) setState(x); });
 */
import { useEffect, useRef } from "react";

export function useIsMountedRef() {
  const mounted = useRef<boolean>(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

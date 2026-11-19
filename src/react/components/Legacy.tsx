import { useLayoutEffect, useRef } from 'react';

/**
 * Draws a piece that has not moved to React yet. `make` builds it with the old code.
 * It is rebuilt on every draw, like the old pages did. Remove each use as its piece moves.
 */
export function LegacyNode({ make }: { make: () => Node }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => { ref.current?.replaceChildren(make()); });
  return <span ref={ref} style={{ display: 'contents' }} />;
}

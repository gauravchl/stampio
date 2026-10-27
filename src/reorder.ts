import { useLayoutEffect, useRef, useState, type PointerEvent, type MouseEvent } from 'react';
import { haptic } from './haptics';

const SLOP = 6; // px a press must travel before it becomes a drag instead of a tap

interface Drag {
  id: string;
  pointerId: number;
  /** Pointer position at press, page coordinates. */
  x0: number;
  y0: number;
  /** Grid slot rects at press, page coordinates. Slots stay put; tiles move between them. */
  slots: { left: number; top: number; right: number; bottom: number }[];
  order: string[];
  active: boolean;
}

/**
 * iOS home-screen style drag-to-reorder for a grid. While a tile is dragged it
 * follows the pointer and the others slide (FLIP) into their new slots; the
 * final order is handed to `onCommit` on release.
 */
export function useDragReorder(ids: string[], enabled: boolean, onCommit: (ids: string[]) => void) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [delta, setDelta] = useState({ x: 0, y: 0 });
  const drag = useRef<Drag | null>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const before = useRef(new Map<string, DOMRect>());
  const swallowClick = useRef(false);

  const list = order ?? ids;

  // Remember where every tile is so the next render can animate from there.
  const snapshot = () => {
    for (const [id, el] of els.current) before.current.set(id, el.getBoundingClientRect());
  };

  useLayoutEffect(() => {
    if (!before.current.size) return;
    for (const [id, r] of before.current) {
      const el = els.current.get(id);
      if (!el || id === dragId) continue;
      const n = el.getBoundingClientRect();
      const dx = r.left - n.left, dy = r.top - n.top;
      if (dx || dy) {
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
          { duration: 300, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
        );
      }
    }
    before.current.clear();
  });

  const end = (commit: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    snapshot();
    if (commit) onCommit(d.order);
    setOrder(null);
    setDragId(null);
  };

  const bind = (id: string) => ({
    ref: (el: HTMLElement | null) => {
      if (el) els.current.set(id, el);
      else els.current.delete(id);
    },
    onPointerDown: (e: PointerEvent) => {
      swallowClick.current = false;
      if (!enabled || e.button !== 0 || drag.current) return;
      drag.current = {
        id, pointerId: e.pointerId, x0: e.pageX, y0: e.pageY, order: list, active: false,
        slots: list.map((s) => {
          const r = els.current.get(s)!.getBoundingClientRect();
          return { left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY };
        }),
      };
    },
    onPointerMove: (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const x = e.pageX - d.x0, y = e.pageY - d.y0;
      if (!d.active) {
        if (Math.hypot(x, y) < SLOP) return;
        d.active = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragId(d.id);
        haptic();
      }
      setDelta({ x, y });
      const to = d.slots.findIndex((r) => e.pageX >= r.left && e.pageX <= r.right && e.pageY >= r.top && e.pageY <= r.bottom);
      const from = d.order.indexOf(d.id);
      if (to >= 0 && to !== from) {
        snapshot();
        const next = d.order.filter((s) => s !== d.id);
        next.splice(to, 0, d.id);
        d.order = next;
      }
      setOrder(d.order);
    },
    onPointerUp: (e: PointerEvent) => {
      if (drag.current?.pointerId !== e.pointerId) return;
      // Mouse still fires a click after a drag ends on the same tile; don't treat it as a tap.
      if (drag.current.active) swallowClick.current = true;
      end(true);
    },
    onPointerCancel: (e: PointerEvent) => {
      if (drag.current?.pointerId === e.pointerId) end(false);
    },
    onClickCapture: (e: MouseEvent) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  });

  /** Keeps the dragged tile under the pointer even after it has moved to a new slot. */
  const style = (id: string) => {
    const d = drag.current;
    if (id !== dragId || !d) return {};
    const from = d.slots[ids.indexOf(id)], at = d.slots[list.indexOf(id)];
    return { translate: `${from.left - at.left + delta.x}px ${from.top - at.top + delta.y}px` };
  };

  return { list, dragId, bind, style };
}

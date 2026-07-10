import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AppState } from '../../core/types';
import { dayProgress } from '../../core/progress';
import type { UseConfirmResult } from '../ConfirmDialog';
import { MobileMasterPage } from './MobileMasterPage';
import { MobileTodayPage } from './MobileTodayPage';
import { MobileDonePage } from './MobileDonePage';

type ConfirmFn = UseConfirmResult['confirm'];

interface Props {
  state: AppState;
  today: string;
  apply: (fn: (s: AppState) => AppState) => void;
  confirm: ConfirmFn;
}

/** Segment order == pager page order (Master, Today, Done). Today is home (index 1). */
const SEGMENTS = ['Master', 'Today', 'Done'] as const;
const HOME_INDEX = 1;

/**
 * Mobile shell (< 900px): segmented control + day-progress bar above a
 * horizontal scroll-snap pager holding the three column pages. Tracks which
 * page is centered via a scroll listener (rAF-throttled) so the segmented
 * control's highlight follows manual swipes, and re-snaps instantly on
 * resize (e.g. orientation change) so a partial scroll position never gets
 * stranded between two pages.
 */
export function MobileBoard({ state, today, apply, confirm }: Props) {
  const pagerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(HOME_INDEX);
  // Mirrors activeIndex for the resize handler below, which is registered
  // once and must not re-run on every page change just to read a fresh value.
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Land on Today by default. Instant (no smooth scroll) — this is initial
  // placement, not a user-driven page change.
  useLayoutEffect(() => {
    const pager = pagerRef.current;
    if (!pager) return;
    pager.scrollTo({ left: pager.clientWidth * HOME_INDEX });
  }, []);

  // Track the centered page as the user swipes. rAF-throttled: 'scroll' can
  // fire far faster than a render is useful for, and 'scrollend' isn't
  // supported everywhere (notably Safari, until recently).
  useEffect(() => {
    const pager = pagerRef.current;
    if (!pager) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const width = pager.clientWidth;
        if (width === 0) return;
        const idx = Math.round(pager.scrollLeft / width);
        setActiveIndex((prev) => (prev === idx ? prev : idx));
      });
    };
    pager.addEventListener('scroll', onScroll, { passive: true });
    return () => pager.removeEventListener('scroll', onScroll);
  }, []);

  // A viewport resize can leave the pager mid-page (its width, and therefore
  // the pixel offset of each page boundary, just changed) — snap back to
  // whichever page was active, instantly.
  useEffect(() => {
    const onResize = () => {
      const pager = pagerRef.current;
      if (!pager) return;
      pager.scrollTo({ left: pager.clientWidth * activeIndexRef.current });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function goToPage(i: number) {
    setActiveIndex(i);
    const pager = pagerRef.current;
    if (!pager) return;
    pager.scrollTo({ left: pager.clientWidth * i, behavior: 'smooth' });
  }

  const doneCount = state.tasks.filter((t) => t.column === 'done').length;
  const progress = dayProgress(state);
  const progressPct = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);

  return (
    <div className="m-board">
      <div className="m-segmented" role="group" aria-label="Board section">
        {SEGMENTS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={'m-segmented__btn' + (activeIndex === i ? ' m-segmented__btn--active' : '')}
            aria-pressed={activeIndex === i}
            onClick={() => goToPage(i)}
          >
            {label}
            {label === 'Done' && doneCount > 0 && (
              <span className="m-done-badge">{doneCount}</span>
            )}
          </button>
        ))}
      </div>
      {progress.total > 0 && (
        <div className="m-progress">
          <div className="m-progress__fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}
      <div className="m-pager" ref={pagerRef}>
        <div className="m-page">
          <MobileMasterPage tasks={state.tasks} today={today} apply={apply} confirm={confirm} />
        </div>
        <div className="m-page">
          <MobileTodayPage tasks={state.tasks} today={today} apply={apply} confirm={confirm} />
        </div>
        <div className="m-page">
          <MobileDonePage
            tasks={state.tasks}
            today={today}
            history={state.history}
            apply={apply}
            confirm={confirm}
          />
        </div>
      </div>
    </div>
  );
}

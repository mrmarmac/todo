import type { ReactNode } from 'react';

export type ColumnKey = 'master' | 'today' | 'done';

interface Props {
  columnKey: ColumnKey;
  name: string;
  /** Shown as a zero-padded figure in the header rule. */
  count: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Header controls that are not the collapse toggle (e.g. Done's Clear). */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Shared shell for the three board columns: a ruled header carrying the column
 * name, its count, and a collapse toggle, above a body that hides when
 * collapsed.
 *
 * Collapse is deliberately vertical in both layouts, and the layout does the
 * rest: on desktop the board is a three-track grid, so a collapsed column keeps
 * its horizontal slot and simply shrinks to its header; on mobile the board is
 * a single stacked track, so collapsing one column frees vertical space and the
 * others flow up to fill it.
 */
export function Column({
  columnKey,
  name,
  count,
  collapsed,
  onToggleCollapse,
  actions,
  children,
}: Props) {
  const bodyId = `col-body-${columnKey}`;
  return (
    <section
      className={`col col--${columnKey}${collapsed ? ' col--collapsed' : ''}`}
      aria-label={name}
    >
      <div className="col__head">
        <button
          type="button"
          className="col__toggle"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          title={`${collapsed ? 'Expand' : 'Collapse'} ${name}`}
          onClick={onToggleCollapse}
        >
          <span className="col__chevron" aria-hidden="true" />
          <span className="col__name">{name}</span>
        </button>
        <span className="col__count" aria-label={`${count} tasks`}>
          {String(count).padStart(2, '0')}
        </span>
        {actions}
      </div>
      <div className="col__body" id={bodyId} hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}

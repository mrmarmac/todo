import { parseUrl } from '../core/urls';

interface Props {
  title: string;
  /** Class for the plain / done text element (ignored for URL pills). */
  className?: string;
  /** Today column only: the title doubles as the set-active toggle. */
  active?: boolean;
  onActivate?: () => void;
}

/**
 * Renders a task's title. A bare URL becomes a tight, clickable pill showing
 * just its domain (see parseUrl); otherwise it's the plain title — as the
 * Today column's activate toggle when `onActivate` is given, else a span.
 */
export function TaskTitle({ title, className, active, onActivate }: Props) {
  const url = parseUrl(title);
  if (url) {
    return (
      <a
        className={'task__url-pill' + (active ? ' task__url-pill--active' : '')}
        href={url.href}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
        // Don't let opening the link also toggle the card's active state / drag.
        onClick={(e) => e.stopPropagation()}
      >
        {url.label}
      </a>
    );
  }

  if (onActivate) {
    return (
      <button
        type="button"
        className={'task__title task__activate' + (active ? ' task__title--active' : '')}
        title={active ? 'Unset active' : 'Set as active'}
        onClick={onActivate}
      >
        {title}
      </button>
    );
  }

  return <span className={className}>{title}</span>;
}

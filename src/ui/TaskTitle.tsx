import { parseUrl } from '../core/urls';

/**
 * A bare-URL string rendered as a tight, clickable pill of just its domain
 * (see parseUrl), or `null` when `title` isn't a URL. Reused for task and
 * subtask titles. `active` mirrors the card/subtask active outline.
 */
export function UrlPill({ title, active }: { title: string; active?: boolean }) {
  const url = parseUrl(title);
  if (!url) return null;
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

interface Props {
  title: string;
  /** Class for the plain / done text element (ignored for URL pills). */
  className?: string;
  /** Today column only: the title doubles as the set-active toggle. */
  active?: boolean;
  onActivate?: () => void;
}

/**
 * Renders a task's title. A bare URL becomes a clickable domain pill; otherwise
 * it's the plain title — as the Today column's activate toggle when `onActivate`
 * is given, else a span.
 */
export function TaskTitle({ title, className, active, onActivate }: Props) {
  if (parseUrl(title)) return <UrlPill title={title} active={active} />;

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

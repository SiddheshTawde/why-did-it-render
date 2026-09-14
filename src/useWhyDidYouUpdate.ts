import { useEffect, useRef } from 'react';

export interface WhyDidYouUpdateOptions {
  /**
   * Prop keys to ignore when diffing (e.g. inline callbacks that
   * legitimately change identity every render).
   */
  ignore?: string[];
  /**
   * Force-enable logging even outside development mode.
   * Defaults to `process.env.NODE_ENV !== 'production'`.
   */
  enabled?: boolean;
  /**
   * Also flag props that changed by reference but are deep-equal
   * (a very common source of unnecessary re-renders from inline
   * objects/arrays/functions). Defaults to true.
   */
  detectReferenceOnlyChanges?: boolean;
}

type PropsRecord = Record<string, unknown>;

interface ChangeEntry {
  key: string;
  before: unknown;
  after: unknown;
  referenceOnly: boolean;
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;

  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    // Circular refs or non-serializable values (functions, symbols) —
    // fall back to treating them as different.
    return false;
  }
}

function isProdByDefault(): boolean {
  try {
    // Works under bundlers (Vite/webpack/Next statically replace this
    // expression at build time) and under Node directly. Guarded with
    // typeof so it never throws in environments without a `process` global.
    return typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  } catch {
    return false;
  }
}

/**
 * Logs exactly which props changed (and how) between renders of the
 * component it's called in. Dev-only by default — becomes a no-op
 * when NODE_ENV is 'production' unless `enabled: true` is passed.
 *
 * @example
 * function ExpensiveList(props) {
 *   useWhyDidYouUpdate('ExpensiveList', props, { ignore: ['onClick'] });
 *   return <ul>...</ul>;
 * }
 */
export function useWhyDidYouUpdate(
  name: string,
  props: PropsRecord,
  options: WhyDidYouUpdateOptions = {}
): void {
  const {
    ignore = [],
    enabled = !isProdByDefault(),
    detectReferenceOnlyChanges = true,
  } = options;

  const previousProps = useRef<PropsRecord | undefined>(undefined);
  const renderCount = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    renderCount.current += 1;

    if (previousProps.current) {
      const allKeys = new Set([
        ...Object.keys(previousProps.current),
        ...Object.keys(props),
      ]);

      const changes: ChangeEntry[] = [];

      allKeys.forEach((key) => {
        if (ignore.includes(key)) return;

        const before = previousProps.current![key];
        const after = props[key];

        if (!Object.is(before, after)) {
          changes.push({
            key,
            before,
            after,
            referenceOnly:
              detectReferenceOnlyChanges && isDeepEqual(before, after),
          });
        }
      });

      if (changes.length > 0) {
        logChanges(name, renderCount.current, changes);
      }
    }

    previousProps.current = props;
  });
}

function logChanges(
  name: string,
  renderCount: number,
  changes: ChangeEntry[]
): void {
  // Guard for non-browser / non-console environments (SSR, some test runners).
  // eslint-disable-next-line no-console
  if (typeof console === 'undefined' || !console.group) return;

  const referenceOnlyCount = changes.filter((c) => c.referenceOnly).length;
  const label = `%c🔄 ${name} re-rendered%c (#${renderCount}) — ${changes.length} prop${
    changes.length === 1 ? '' : 's'
  } changed${referenceOnlyCount > 0 ? `, ${referenceOnlyCount} reference-only` : ''}`;

  // eslint-disable-next-line no-console
  console.groupCollapsed(
    label,
    'color: #e06c75; font-weight: bold;',
    'color: inherit; font-weight: normal;'
  );

  changes.forEach(({ key, before, after, referenceOnly }) => {
    if (referenceOnly) {
      // eslint-disable-next-line no-console
      console.log(
        `%c${key}%c — same value, new reference (deep-equal)`,
        'font-weight: bold;',
        'color: #d19a66;',
        before,
        '→',
        after
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(`%c${key}%c:`, 'font-weight: bold;', 'color: inherit;', before, '→', after);
    }
  });

  // eslint-disable-next-line no-console
  console.groupEnd();
}

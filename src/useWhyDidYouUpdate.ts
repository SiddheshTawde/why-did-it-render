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

/**
 * Structural deep-equal that (unlike JSON.stringify comparison):
 * - ignores object key order
 * - treats an explicit `undefined` value differently from a missing key... 
 *   actually treats both consistently since we walk the union of keys
 * - doesn't choke on values JSON.stringify would drop (undefined, functions)
 */
function isDeepEqual(a: unknown, b: unknown, seen = new Map<object, object>()): boolean {
  if (Object.is(a, b)) return true;

  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;

  // Guard against circular references.
  const seenMatch = seen.get(a as object);
  if (seenMatch) return seenMatch === b;
  seen.set(a as object, b as object);

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, i) => isDeepEqual(item, b[i], seen));
  }

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }

  const aRecord = a as PropsRecord;
  const bRecord = b as PropsRecord;
  const allKeys = new Set([...Object.keys(aRecord), ...Object.keys(bRecord)]);

  for (const key of allKeys) {
    if (!isDeepEqual(aRecord[key], bRecord[key], seen)) return false;
  }
  return true;
}

function isProdByDefault(): boolean {
  try {
    // Deliberately written as the exact literal `process.env.NODE_ENV`
    // (no optional chaining) so bundlers that do a textual
    // find/replace on that expression (webpack DefinePlugin, Next.js,
    // etc.) can statically inline and dead-code-eliminate this branch.
    // The typeof guard keeps it safe in environments with no `process`.
    return typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
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
  // Counts actual RE-renders (mount doesn't count), so the first
  // logged change is correctly labeled "#1", not "#2".
  const renderCount = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    if (previousProps.current) {
      renderCount.current += 1;

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
  // Guard for non-browser / non-console environments (SSR, some test
  // runners). Check the actual methods we call below, not a stand-in.
  if (
    typeof console === 'undefined' ||
    !console.groupCollapsed ||
    !console.groupEnd ||
    !console.log
  ) {
    return;
  }

  const referenceOnlyCount = changes.filter((c) => c.referenceOnly).length;
  const label = `%c🔄 ${name} re-rendered%c (#${renderCount}) — ${changes.length} prop${
    changes.length === 1 ? '' : 's'
  } changed${referenceOnlyCount > 0 ? `, ${referenceOnlyCount} reference-only` : ''}`;

  console.groupCollapsed(
    label,
    'color: #e06c75; font-weight: bold;',
    'color: inherit; font-weight: normal;'
  );

  changes.forEach(({ key, before, after, referenceOnly }) => {
    if (referenceOnly) {
      console.log(
        `%c${key}%c — same value, new reference (deep-equal)`,
        'font-weight: bold;',
        'color: #d19a66;',
        before,
        '→',
        after
      );
    } else {
      console.log(`%c${key}%c:`, 'font-weight: bold;', 'color: inherit;', before, '→', after);
    }
  });

  console.groupEnd();
}
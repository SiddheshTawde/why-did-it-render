# why-did-it-render

A tiny, dev-only React hook that tells you **exactly which prop changed** and caused a re-render — without pulling in a heavy profiler or wrapping your component tree.

```bash
npm install why-did-it-render
```

## Usage

```tsx
import { useWhyDidYouUpdate } from 'why-did-it-render';

function ExpensiveList({ items, onSelect, filter }) {
  useWhyDidYouUpdate('ExpensiveList', { items, onSelect, filter });

  return <ul>{/* ... */}</ul>;
}
```

That's it — one line, no HOC, no wrapper component. On every re-render after the first, it logs a collapsed console group showing exactly which props changed and their before/after values.

## Options

```tsx
useWhyDidYouUpdate('MyComponent', props, {
  // Skip props that legitimately change every render (e.g. inline callbacks)
  ignore: ['onClick'],

  // Force logging even in production (default: dev-only)
  enabled: true,

  // Flag props that changed by reference but are deep-equal —
  // usually caused by inline objects/arrays/functions (default: true)
  detectReferenceOnlyChanges: true,
});
```

## What it catches

- **Real prop changes** — the value actually changed, logged with before → after.
- **Reference-only changes** — the value is deep-equal but a *new* object/array/function reference (a huge source of unnecessary re-renders from inline literals), flagged separately so you know it's safe to `useMemo`/`useCallback` away.

## Production safety

The hook is a no-op when `NODE_ENV === 'production'` unless you explicitly pass `enabled: true`. Combined with tree-shaking and its ~1.5KB size, it's safe to leave the import in your codebase.

## License
This project is licensed under the [MIT License](LICENSE)

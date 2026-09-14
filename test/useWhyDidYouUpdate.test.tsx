import { render } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWhyDidYouUpdate } from '../src/useWhyDidYouUpdate';

function Probe({ value, cb }: { value: number; cb: () => void }) {
  useWhyDidYouUpdate('Probe', { value, cb });
  return null;
}

function ProbeIgnore({ value, onClick }: { value: number; onClick: () => void }) {
  useWhyDidYouUpdate('Probe', { value, onClick }, { ignore: ['onClick'] });
  return null;
}

function ProbeDisabled({ value }: { value: number }) {
  useWhyDidYouUpdate('Probe', { value }, { enabled: false });
  return null;
}

describe('useWhyDidYouUpdate', () => {
  let groupSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let groupEndSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    groupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not log on the first render', () => {
    render(<Probe value={1} cb={() => {}} />);
    expect(groupSpy).not.toHaveBeenCalled();
  });

  it('logs when a prop value changes', () => {
    const cb = () => {};
    const { rerender } = render(<Probe value={1} cb={cb} />);
    rerender(<Probe value={2} cb={cb} />);

    expect(groupSpy).toHaveBeenCalledTimes(1);
    expect(groupEndSpy).toHaveBeenCalledTimes(1);
  });

  it('does not log when no props actually changed', () => {
    const cb = () => {};
    const { rerender } = render(<Probe value={1} cb={cb} />);
    rerender(<Probe value={1} cb={cb} />);

    expect(groupSpy).not.toHaveBeenCalled();
  });

  it('flags reference-only changes for deep-equal objects/arrays', () => {
    function Wrapper() {
      const [, setTick] = useState(0);
      useEffect(() => {
        setTick(1); // trigger one extra render
      }, []);
      useWhyDidYouUpdate('Wrapper', { list: [1, 2, 3] });
      return null;
    }

    render(<Wrapper />);
    // The array literal is a new reference each render but deep-equal,
    // so it should be logged as reference-only via console.log args.
    expect(groupSpy).toHaveBeenCalledTimes(1);
    const loggedReferenceOnly = logSpy.mock.calls.some((call) =>
      String(call[0]).includes('reference')
    );
    expect(loggedReferenceOnly).toBe(true);
  });

  it('respects the ignore list', () => {
    const { rerender } = render(<ProbeIgnore value={1} onClick={() => {}} />);
    rerender(<ProbeIgnore value={1} onClick={() => {}} />);

    // onClick changed identity every render but is ignored, and value
    // didn't change, so nothing should be logged.
    expect(groupSpy).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    const { rerender } = render(<ProbeDisabled value={1} />);
    rerender(<ProbeDisabled value={2} />);

    expect(groupSpy).not.toHaveBeenCalled();
  });
});

import { expect, test, describe } from 'bun:test';
import { parseHTML } from 'linkedom';

// We need to test isDocumentLike indirectly through the module.
// Since isDocumentLike is a private function inside asReadabilityDocument,
// we test the behavior by calling extractWeb with a mock that triggers the path,
// OR we test that linkedom's document passes the duck-type check by verifying
// the underlying behavior that caused the bug: asReadabilityDocument should NOT
// throw for a linkedom document.

// Import extractWeb to exercise the code path, but we can't call it without
// a real network request. Instead, we test the isDocumentLike logic directly
// by re-implementing the same check inline and verifying linkedom's document passes.

describe('isDocumentLike — linkedom Document duck-typing', () => {
  test('linkedom document has querySelector and createElement accessible via prototype chain', () => {
    const { document } = parseHTML('<html><body><p>hello</p></body></html>');

    // This is what the OLD implementation did — only one level up
    function isDocumentLikeOld(v: unknown): boolean {
      if (typeof v !== 'object' || v === null) return false;
      const rec = Object.getOwnPropertyDescriptor(v, 'querySelector') ??
                  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(v) ?? {}, 'querySelector');
      const rec2 = Object.getOwnPropertyDescriptor(v, 'createElement') ??
                   Object.getOwnPropertyDescriptor(Object.getPrototypeOf(v) ?? {}, 'createElement');
      return typeof rec?.value === 'function' && typeof rec2?.value === 'function';
    }

    // This is what the NEW implementation does — uses `in` + Reflect.get
    function isDocumentLikeNew(v: unknown): boolean {
      if (typeof v !== 'object' || v === null) return false;
      return (
        'querySelector' in v && typeof Reflect.get(v, 'querySelector') === 'function' &&
        'createElement' in v && typeof Reflect.get(v, 'createElement') === 'function'
      );
    }

    // The old implementation FAILS for linkedom (methods are deep in prototype chain)
    expect(isDocumentLikeOld(document)).toBe(false);

    // The new implementation PASSES for linkedom
    expect(isDocumentLikeNew(document)).toBe(true);
  });

  test('new implementation rejects null', () => {
    function isDocumentLikeNew(v: unknown): boolean {
      if (typeof v !== 'object' || v === null) return false;
      return (
        'querySelector' in v && typeof Reflect.get(v, 'querySelector') === 'function' &&
        'createElement' in v && typeof Reflect.get(v, 'createElement') === 'function'
      );
    }
    expect(isDocumentLikeNew(null)).toBe(false);
  });

  test('new implementation rejects plain object without required methods', () => {
    function isDocumentLikeNew(v: unknown): boolean {
      if (typeof v !== 'object' || v === null) return false;
      return (
        'querySelector' in v && typeof Reflect.get(v, 'querySelector') === 'function' &&
        'createElement' in v && typeof Reflect.get(v, 'createElement') === 'function'
      );
    }
    expect(isDocumentLikeNew({})).toBe(false);
    expect(isDocumentLikeNew({ querySelector: 'not-a-function' })).toBe(false);
  });
});

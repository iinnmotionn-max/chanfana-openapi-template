// Constant-time secret comparison.
//
// `a !== b` on strings short-circuits at the first differing byte, so the time
// it takes to reject leaks how many leading bytes were right. Over the open
// internet network jitter usually swamps that signal — but "usually" is not a
// security argument, the fix costs nothing, and this system grades its own
// posture in the Shield realm. So: compare every byte, always.

export function secretsMatch(a: string, b: string): boolean {
	// Length is not secret (and can't be hidden by this loop), but comparing
	// unequal lengths byte-for-byte would read past the end, so bail early.
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

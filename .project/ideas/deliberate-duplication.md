---
title: Deliberate duplication
created: 2026-09-06
moved: 2026-09-18
---

`resourceWrite` is symmetrical: a host asks a client for one exactly as a client asks a host. So `publish.ts` implements the whole of it, and so does `ahpd` in its `resources.ts` - the same flags, the same order of preconditions, the same append and insert arithmetic. This client does not depend on `@ahpd/sdk` and is not going to. Both copies carry a comment naming the other.

What now checks that they still agree is `test/fixtures/resource-write.json`, checked into both repositories byte for byte, with a runner in each - `test/resource-write.test.ts` on both sides - so twenty-one cases run against both implementations and a divergence fails a build rather than waiting for somebody to read the two files side by side. What running it here cannot catch is a case added on one side and never copied to the other, because there is no shared package to hold the file; each repository's CI reads the other's copy over HTTP and diffs it, which is what closes that.

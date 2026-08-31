/** Running a changeset operation, including the part where the host says no. */

import type { HostConnection } from './connection.js';
import type { ChangesetOperationTarget } from './types.js';

/**
 * A refusal that names the way out of itself.
 *
 * `-32009` with a `resourceRequest` payload in `data.request`: the host is
 * saying not "no" but "not until you ask", and the payload is the asking. A
 * client that only knew how to press the button would draw one that fails and
 * cannot explain itself.
 */
const unlockable = (error: unknown): Record<string, unknown> | undefined => {
  const held = error as { code?: number; data?: { request?: unknown } };
  if (held.code !== -32009) return undefined;
  const request = held.data?.request;
  if (typeof request !== 'object' || request === null) return undefined;
  const asked = request as Record<string, unknown>;
  return typeof asked.uri === 'string' ? asked : undefined;
};

/**
 * Run one of a changeset's operations, asking for write access if it is refused.
 *
 * Above the seam on purpose. Both host implementations refuse the same way, so
 * doing this once here is what makes the scripted host and a live daemon
 * behave identically from a screen's point of view - and it is a decision
 * rather than plumbing: `ask` is what turns a silent retry into a question,
 * and a shell and a full-screen client want different answers to that.
 *
 * The request is sent back **verbatim**. The host named a resource - the file
 * for an operation on one, the project for an operation on the whole changeset
 * - and asking about a different one is asking the wrong question.
 *
 * Exactly one retry. A second refusal after a grant means the host meant it,
 * and looping on denials is how a button becomes a hang.
 */
export async function operate(
  host: HostConnection,
  changeset: string,
  operationId: string,
  options: {
    target?: ChangesetOperationTarget;
    /**
     * Whether to go ahead and ask for the access the refusal named.
     *
     * Answering `false` leaves the original refusal to be thrown, which is a
     * real outcome: somebody was asked whether to let a host write to their
     * repository and said no.
     */
    ask?(request: { uri: string; write?: boolean; read?: boolean }): Promise<boolean> | boolean;
  } = {},
): Promise<{ message?: string }> {
  if (!host.invoke) throw new Error('This host connection cannot run changeset operations.');
  const run = () => (host.invoke as NonNullable<HostConnection['invoke']>)(
    changeset,
    operationId,
    options.target,
  );
  try {
    return await run();
  }
  catch (error) {
    const asked = unlockable(error);
    if (!asked || !host.requestResource) throw error;
    const wanted = asked as unknown as { uri: string; write?: boolean; read?: boolean };
    if (options.ask && !(await options.ask(wanted))) throw error;
    await host.requestResource(wanted.uri, {
      ...(wanted.read === true ? { read: true } : {}),
      ...(wanted.write === true ? { write: true } : {}),
    });
    return await run();
  }
}

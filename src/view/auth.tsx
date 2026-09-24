import type { RenderOutput } from '@textui/core';
import { defineComponent, useEffect, useRequiredService, useStoreValue } from '@textui/core';
import { Column, Field, Form, FormActions, Panel, TextInput, useForm } from '@textui/widgets';
import { CONTROLLER } from '../control.js';
import { AUTH_ASK } from '../state.js';
import type { AuthAsk } from '../ahp/auth.js';

/**
 * The credential the host asked for, where the person already is.
 *
 * A refusal can be earned on any screen, so this is a modal over whatever is
 * on screen rather than a screen of its own: declining leaves the person
 * exactly where they were. It is keyed by the resource in the store rather
 * than by props, so a second refusal draws its own resource and a redraw does
 * not lose the ask.
 *
 * The field is masked and the secret lives only here and in the host. Nothing
 * is saved, and a credential the host turns down clears the field and leaves
 * the host's own words in its place: the answer to a refused token is to type
 * another one, not to run the refused act again.
 */
export const SignInPrompt: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('SignInPrompt', () => {
    const controller = useRequiredService(CONTROLLER);
    const ask = useStoreValue<AuthAsk | null>(AUTH_ASK, null) ?? null;

    const form = useForm<{ token: string }>({
      initialValues: { token: '' },
      // Empty is not a credential. `FormActions` disables submit until
      // something is typed, and this is what stops a whitespace-only one too.
      validate: (values) => (values.token.trim() === '' ? { token: 'A token is needed' } : {}),
      onSubmit: async (values) => {
        if (ask === null) return;
        const taken = await controller.signIn(ask.resource, values.token.trim());
        // The host turned it down. The prompt stays open, the words it used are
        // in `AUTH_ASK` by now, and what was typed does not sit in the field.
        if (!taken) form.setValue('token', '');
      },
    });

    // A second refusal takes over what the prompt draws. What was typed for
    // the first resource must not sit in the field for the second, so the form
    // is cleared when the resource under it changes.
    useEffect(() => { form.reset({ token: '' }); }, [ask?.resource]);

    // Settled: the layer is closing and there is nothing to draw for the frame
    // it takes to go.
    if (ask === null) return null;

    return (
      <Panel title="Sign in" width={64}>
        <Column gap={1}>
          <Column gap={0}>
            {/* The host's own name for it when it gave one, and the identifier
                either way: the identifier is what has to match, and the name is
                what a person recognises. */}
            <text content={ask.name ?? ask.resource} fg="accent" />
            {ask.name !== undefined ? <text content={ask.resource} fg="muted" /> : null}
          </Column>
          {ask.reason === 'expired'
            ? <text content="The token the host was holding has expired." fg="warning" wrap="word" />
            : null}
          <text
            content={ask.words !== ''
              ? ask.words
              : `${ask.name ?? ask.resource} needs signing in to before the host will go on.`}
            fg={ask.words !== '' ? 'danger' : 'subtle'}
            wrap="word"
          />
          <Form form={form as never}>
            <Field name="token" label="Token" labelWidth={6} required>
              <TextInput
                value={form.values.token}
                mask="*"
                autoFocus
                placeholder="paste or type the token"
                onChange={(value: string) => { form.setValue('token', value); form.touch('token'); }}
                onSubmit={() => { void form.submit(); }}
              />
            </Field>
            <FormActions
              submitLabel="Sign in"
              cancelLabel="Cancel"
              requireDirty
              onCancel={() => controller.dismissSignIn()}
            />
          </Form>
        </Column>
      </Panel>
    );
  });

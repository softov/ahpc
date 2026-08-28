import type { BoxProps, RenderOutput } from '@textui/core';
import { defineComponent, useFocus, useInput, useTheme } from '@textui/core';
import { Row } from '@textui/widgets';

/**
 * The composer's control row: what this message will be sent as.
 *
 * One line under the field, and everything on it is a *current value* rather
 * than a label - which harness, which model, how much it may do before it
 * asks, where it works. A person can read what will happen without opening
 * anything, and change any of it without leaving the composer.
 *
 * Each chip is one command's argument, asked through the palette (see
 * `picker.ts`). That is the whole design: nothing here knows what a model or a
 * permission mode is, so a new chip is a new command and no change to this
 * file.
 */

export interface ComposerOption {
  id: string;
  /** The value, as a person reads it. Never the id the host stores. */
  label: string;
  /**
   * The question, as opposed to the answer in `label`.
   *
   * The chip has no room for it - "Ask each time" is the whole row and the
   * mark in front says which question it belongs to - but anything listing
   * these somewhere with more space needs the pair, and the host's own wording
   * for both is on the schema rather than in this file.
   */
  title?: string;
  icon?: string;
  /** The command whose argument this chip asks about. Absent: shown, not asked. */
  commandId?: string;
}

export interface ComposerBarProps extends BoxProps {
  options: ComposerOption[];
  onOpen(option: ComposerOption, anchorId: string): void;
  onSend(): void;
  /** A turn is running, so this message joins the queue instead. */
  running?: boolean;
  queued?: number;
  sendDisabled?: boolean;
}

/** The focus id of one chip. The picker anchors to it, so it has to be knowable. */
export const chipId = (id: string): string => `chat.option.${id}`;

export const SEND_ID = 'chat.send';

export const ComposerBar: (props: ComposerBarProps) => RenderOutput =
  defineComponent<ComposerBarProps>('ComposerBar', (props) => {
    const { options, onOpen, onSend, running, queued = 0, sendDisabled, ...rest } = props;
    const theme = useTheme();

    return (
      <Row gap={1} {...rest}>
        {options.map((option, at) => (option.commandId
          ? (
            <Chip
              key={option.id}
              focusId={chipId(option.id)}
              // Stated, not inherited. Tab order is registration order, and
              // which chips exist is the *host's* answer - it arrives one
              // round trip after the row is first drawn, so the ones that were
              // there from the start would otherwise come first however far to
              // the right they sit. Tab would run harness, workspace, and then
              // back to the middle.
              order={at}
              label={option.label}
              {...(option.icon ? { icon: option.icon } : {})}
              onOpen={() => onOpen(option, chipId(option.id))}
            />
          )
          : (
            // Shown, not asked: a value that is fixed for this session is
            // still worth reading, and a chip that opens a panel offering one
            // choice is a worse way of saying so.
            <Row key={option.id} gap={1}>
              {option.icon ? <text content={option.icon} fg="subtle" /> : null}
              <text content={option.label} fg="subtle" />
            </Row>
          )))}

        <text content="" flex={1} />
        {queued > 0 ? <text content={`${queued} queued`} fg="warning" /> : null}
        <Chip
          focusId={SEND_ID}
          order={options.length}
          label={running ? 'queue' : 'send'}
          trailing={theme.glyphs.chevronRight}
          tone="accent"
          {...(sendDisabled ? { disabled: true } : {})}
          onOpen={onSend}
        />
      </Row>
    );
  });

interface ChipProps {
  focusId: string;
  /** Where tab reaches it. The row's own order, not the order it mounted in. */
  order: number;
  label: string;
  icon?: string;
  /** After the label. A chevron for something that opens, an arrow for send. */
  trailing?: string;
  tone?: 'accent';
  disabled?: boolean;
  onOpen(): void;
}

/**
 * One value on the control row.
 *
 * Not a `Button`: a button is a verb and these are nouns, and at `size="sm"`
 * four of them still read as four buttons rather than as one sentence about
 * what is about to be sent. What it borrows from a button is the part that
 * matters - it is focusable, tab reaches it, and enter opens it.
 */
const Chip = defineComponent<ChipProps>('ComposerChip', (props) => {
  const { focusId, order, label, icon, trailing, tone, disabled, onOpen } = props;
  const theme = useTheme();
  const focus = useFocus({ id: focusId, order, disabled: disabled === true });

  useInput((event) => {
    if (disabled) return false;
    // Down as well as enter: the panel comes up out of the chip, and reaching
    // for it downwards is what the shape of the thing suggests.
    if (event.name === 'enter' || event.name === 'space' || event.name === 'down') {
      onOpen();
      return true;
    }
    return false;
  }, { focusId: focus.id, enabled: disabled !== true });

  return (
    <Row
      id={focus.id}
      gap={1}
      padding={[0, 1]}
      {...(focus.focused ? { bg: 'selected' as const } : {})}
      onClick={disabled ? undefined : onOpen}
    >
      {/* The mark and the chevron never give up room. As the terminal
          narrows the labels truncate from the right, and a chip that has
          given up its mark as well is four cells of ellipsis that could be
          any of six questions. */}
      {icon ? <text content={icon} shrink={0} fg={focus.focused ? 'inverted' : tone ?? 'muted'} /> : null}
      <text
        content={label}
        truncate="end"
        fg={focus.focused ? 'inverted' : disabled ? 'disabled' : tone ?? undefined}
        {...(tone ? { bold: true } : {})}
      />
      <text
        content={trailing ?? theme.glyphs.chevronDown}
        shrink={0}
        fg={focus.focused ? 'inverted' : 'subtle'}
      />
    </Row>
  );
});

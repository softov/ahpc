import type { BoxProps, RenderOutput, SemanticVariant } from '@textui/core';
import {
  defineComponent,
  useClipboard,
  useEffect,
  useFocus,
  useInput,
  useState,
  useTheme,
} from '@textui/core';
import { Column, Row } from '@textui/widgets';

/**
 * A property list you can walk, and take a value out of.
 *
 * The catalogue's detail pane is where the identifiers live - a session URI, a
 * chat URI - and an identifier you cannot read in full or paste anywhere is
 * decoration. `KeyValue` draws the same pairs and is static: nothing selects a
 * row, so nothing can be copied and nothing can be shown untruncated.
 *
 * So the selected row is the one that gets the room. Every other row is one
 * line with its value truncated, and the selected row wraps its value across
 * as many lines as it needs - which costs nothing when the value is short and
 * is the whole answer when it is a URI in a 36-column pane. `enter` puts it on
 * the clipboard.
 *
 * This is a finding, not a flourish: it is the third component this example
 * wanted that the catalog does not have.
 */

export interface DetailField {
  id: string;
  label: string;
  value: string;
  tone?: SemanticVariant;
  /** Shown instead of the value when there is none, in the subtle tone. */
  absent?: string;
}

export interface SessionDetailsProps extends BoxProps {
  fields: DetailField[];
  focusId?: string;
  /** Width of the label column. The labels are ours, so this is knowable. */
  labelWidth?: number;
  /**
   * Take the keyboard on the frame this mounts, out of whatever holds it.
   *
   * Not `autoFocus`, which claims focus rather than taking it: a pane that
   * appears *because* a key asked for it has to end up with the cursor, and
   * the thing it is taking the cursor from - the session list - is in the
   * same focus scope and already has it.
   *
   * It has to be done here rather than by the screen that mounts this,
   * because a focusable registers in its own effect: on the render that opens
   * the pane, the id does not exist yet and the screen's `focus()` is a call
   * that quietly returns false.
   */
  claim?: boolean;
  /**
   * Which rows show their value whole.
   *
   * `selected` is the default and the one that keeps the pane a list: every
   * row is one line, and the row you have stopped on wraps to as many as its
   * value needs. `all` wraps every row, which is what you want when the
   * values *are* the point - a pane of URIs where the answer is on the third
   * one down and reading it should not mean walking there first.
   */
  values?: 'selected' | 'all';
}

export const SessionDetails: (props: SessionDetailsProps) => RenderOutput =
  defineComponent<SessionDetailsProps>('SessionDetails', (props) => {
    const { fields, focusId, labelWidth = 11, claim, values = 'selected', ...rest } = props;
    const theme = useTheme();
    const clipboard = useClipboard();
    const focus = useFocus({ ...(focusId ? { id: focusId } : {}) });
    const [index, setIndex] = useState(0);
    const [copied, setCopied] = useState<string | null>(null);

    // The selection is an index into a list that changes with the selected
    // session, so it is clamped on the way out rather than reset on the way in.
    const at = Math.max(0, Math.min(index, fields.length - 1));

    // After the registration above, which is the whole point of it being here.
    useEffect(() => { if (claim) focus.focus(); }, [claim]);

    useInput((event) => {
      if (fields.length === 0) return false;
      switch (event.name) {
        case 'up': setIndex(Math.max(0, at - 1)); setCopied(null); return true;
        case 'down': setIndex(Math.min(fields.length - 1, at + 1)); setCopied(null); return true;
        case 'home': setIndex(0); setCopied(null); return true;
        case 'end': setIndex(fields.length - 1); setCopied(null); return true;
        case 'enter': {
          const field = fields[at];
          if (!field || !field.value) return true;
          // OSC 52 where the terminal takes it, and the store either way - so
          // a test can assert what was copied without a terminal at all.
          clipboard.write(field.value);
          setCopied(field.id);
          return true;
        }
        default: return false;
      }
    }, { focusId: focus.id });

    return (
      <Column {...rest} id={focus.id}>
        {fields.map((field, i) => {
          const active = i === at;
          const selected = active && focus.focused;
          const whole = values === 'all' || active;
          return (
            // `align="start"` because a wrapped value makes the row two lines
            // tall and the label is one: centred, it drifted down to sit
            // beside the *second* line of a URI, with nothing at all beside
            // the first. A label names the row it starts.
            <Row key={field.id} gap={1} align="start">
              <text
                content={active ? theme.glyphs.chevronRight : ' '}
                fg={selected ? 'accent' : 'subtle'}
                shrink={0}
              />
              {/* Neither of these gives up a cell. `width` is a starting size,
                  not a floor - shrink is 1 unless it is said - so a value with
                  no space in it to break at was squeezing the label column,
                  and `Chat` ended up four columns left of `Harness`. A column
                  that moves per row is not a column. */}
              <text
                content={field.label}
                width={labelWidth}
                shrink={0}
                fg="muted"
                truncate="end"
              />
              <text
                content={field.value || field.absent || '-'}
                flex={1}
                {...(whole ? { wrap: 'word' as const } : { truncate: 'end' as const })}
                {...(field.value ? {} : { fg: 'subtle' as const })}
                {...(field.tone && field.value ? { fg: field.tone } : {})}
                {...(selected ? { bold: true } : {})}
              />
              {copied === field.id ? <text content="copied" fg="success" shrink={0} /> : null}
            </Row>
          );
        })}
      </Column>
    );
  });

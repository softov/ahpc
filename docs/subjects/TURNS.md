# Turns

A turn is one message to the agent and everything it does to answer: text, tool calls, and questions back to you. A turn can stop and wait for a person, to approve a tool call or to answer a question.

## Screen

Type in the composer and press `enter`. While a turn runs:

| Key | |
| --- | --- |
| `a` | Approve the waiting tool call |
| `d` | Deny it |
| `1` to `9` | Pick an offered option |
| `tab`, `space`, `enter` | Move between a question's fields, select, send |
| `t` | Stop the turn |
| `ctrl+c` | Cancel the running turn |

A message sent while a turn runs is queued behind it.

## Commands

| Command | | Flags |
| --- | --- | --- |
| `prompt <uri> <text>` | Send a message and stream the answer | `--model M` `--queue` `--steer` `--json` |
| `exec <text>` | Create a session, run one turn, and dispose of it | `--agent P` `--cwd DIR` `--trust` `--model M` `--json` |
| `queue <uri> <text>` | Send it after the running turn | `--model M` |
| `unqueue <uri> <id>` | Take a queued message back | |
| `cancel <uri>` | Stop the running turn | |
| `watch <uri>` | Block until the session needs a person, print what it needs, exit | `--until turn\|input\|idle` `--timeout S` `--json` |
| `confirm <uri> <toolCallId>` | Approve a tool call | `--deny` `--option ID` |
| `answer <uri> <requestId>` | Answer a question | `--field k=v` `--reject` |

`prompt` on a session with a running turn is refused, unless you say what to do: `--queue` runs it after that turn, `--steer` sends it into that turn.

A script that drives a session without a person:

```sh
ahpc prompt "$S" "fix the failing test" &
ahpc watch "$S" --until input --json   # prints the tool call or question
ahpc confirm "$S" <toolCallId>
```

## MCP tools

Always served.

<McpTools names="send_turn,queue_turn,cancel_turn,wait_for_attention,confirm_tool_call,answer_question" />

## Host support

Every AHP host runs turns.

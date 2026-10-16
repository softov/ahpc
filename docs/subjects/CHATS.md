# Chats

A session can hold more than one conversation. Each is a chat, with its own transcript, in the same workspace. A chat a tool started names the chat and the tool call that made it.

## Screen

Open the command palette (`ctrl+p`) in a session:

| Command | |
| --- | --- |
| New chat | Another conversation in this session |
| Fork from this turn | A new chat with this conversation up to the selected turn |
| Side chat from this turn | A new chat with the selected turn as context, without copying it |
| Switch chat | Go to another chat |
| Close chat | Close this one |

## Commands

| Command | | Flags |
| --- | --- | --- |
| `chat list <uri>` | The chats in a session | `--json` |
| `chat new <uri> [text]` | Start another, and send `text` if given | |
| `chat show <chatUri>` | What the host says about one | `--full` `--json` |
| `chat history <chatUri>` | Its turns | `--all` `--full` `--json` |
| `chat rm <chatUri>` | Close it | |

`dispatch --chat` sends a raw action to a chat.

## MCP tools

None. The session tools take a session URI.

## Host support

Chats are AHP's [chat channel](https://microsoft.github.io/agent-host-protocol/specification/chat-channel).

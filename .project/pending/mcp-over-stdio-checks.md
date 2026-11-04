---
title: Check that MCP over stdio answers a ping while send_turn runs, and stops a cancelled call
plans:
  - plans/cli/20261104-1112-mcp-over-stdio-answers-at-the-same-time/plan.md
---

# Check that MCP over stdio answers a ping while send_turn runs, and stops a cancelled call

The plan is built on the branch of its pull request.
Run these checks on that branch, or on `main` once the pull request is merged.

## Set up

1. Do steps 1 to 11 of *Set up* in [set-up-a-test-host.md](set-up-a-test-host.md).
2. In a second terminal, run `<ahpc>` with no command, and open `<session>`.
3. In the first terminal, run `<ahpc> mcp`, and paste each line below as one line.

## A ping while send_turn runs

1. Paste `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"check","version":"0"}}}`.
2. Paste `{"jsonrpc":"2.0","method":"notifications/initialized"}`.
3. Paste `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"send_turn","arguments":{"session":"<session>","text":"Run sleep 30, then say done."}}}`.
4. Paste `{"jsonrpc":"2.0","id":3,"method":"ping"}` while the turn runs.
5. Check that the answer with `"id":3` comes at once, before the answer with `"id":2`.

## A cancelled call

1. Paste `{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"send_turn","arguments":{"session":"<session>","text":"Run sleep 30, then say done."}}}`.
2. Paste `{"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":4}}` while the turn runs.
3. Check that the turn stops on the screen in the second terminal.
4. Check that no answer with `"id":4` comes.
5. Paste `{"jsonrpc":"2.0","id":5,"method":"ping"}`, and check that its answer comes.

## Reply

- Write "validated", or what you saw that differs.

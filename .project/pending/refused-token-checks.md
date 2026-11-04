---
title: Check that a refused connection token is told apart from a host that is down
plans:
  - plans/ahp/20261104-0734-a-refused-token-is-told-from-a-down-host/plan.md
---

# Check that a refused connection token is told apart from a host that is down

The plan is built on the branch `ahp/20261104-0734-a-refused-token-is-told-from-a-down-host`.
Run these checks on that branch, or on `main` once its pull request is merged.

## Set up

1. Do steps 1 to 8 of *Set up* in [set-up-a-test-host.md](set-up-a-test-host.md).
2. In the ahpc checkout, run `npm run build`.
3. Write a second token with `openssl rand -hex 16 > <scratch>/other`.

## At start

1. Run `node <ahpc>/dist/src/main.js --host ws://127.0.0.1:9313 --connection-token-file <scratch>/other session list`.
2. Check that it prints `The host at ws://127.0.0.1:9313 refused the connection token.`
3. Stop the host, and run the same command.
4. Check that it prints `Could not reach ws://127.0.0.1:9313: ...` and names the connection token.

## On reconnect

1. Start the host again with its own token.
2. Run `node <ahpc>/dist/src/main.js --host ws://127.0.0.1:9313 --connection-token-file <scratch>/token` with no command.
3. Stop the host, and start it again with `--connection-token-file <scratch>/other`.
4. Check that the status row says the host refused the connection token, while the badge says connecting.
5. Stop the host, and start it again with `--connection-token-file <scratch>/token`.
6. Check that the screen connects again and the line is gone.

## Reply

- Write "validated", or what you saw that differs.

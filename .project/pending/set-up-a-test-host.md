---
title: Set up a test host for the checks by hand
---

# Set up a test host for the checks by hand

The checks in this folder run ahpc against a test ahpd with its own token, folders and port.
Each check file starts with these steps.

## Set up

1. In the ahpd checkout, on `main`, run `pnpm install` and `pnpm build`.
2. In the ahpc checkout, on `main`, run `npm install` and `npm run build`.
3. Make an empty folder `<scratch>` with a folder `xdg` in it.
4. Write a token with `openssl rand -hex 16 > <scratch>/token`.
5. Write `<scratch>/config.json` as `{"plugins":[{"name":"<ahpd>/packages/agent-claude"}]}`, where `<ahpd>` is the ahpd checkout.
6. Make a folder `<work>` with `git init`, two committed files and one commit.
7. In `<work>`, edit one committed file, delete the other, and add one new file.
8. Start the host with `XDG_CONFIG_HOME=<scratch>/xdg node <ahpd>/packages/server/dist/main.js --port 9313 --config-file <scratch>/config.json --sessions memory --automations memory --no-update-check --connection-token-file <scratch>/token --path <work> --no-cwd`.
9. Start a session with `node <ahpc>/dist/src/main.js --host ws://127.0.0.1:9313 --connection-token-file <scratch>/token session new --cwd <work>`.
10. Let `<ahpc>` be `node <ahpc>/dist/src/main.js --host ws://127.0.0.1:9313 --connection-token-file <scratch>/token`.
11. Let `<session>` be the URI that `session new` printed.

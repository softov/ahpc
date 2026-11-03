---
title: Decide on five findings from the checks by hand of 2026-11-03
plans:
  - plans/cli/05-prompt-on-a-busy-session/plan.md
  - plans/cli/20261030-0802-a-dispatch-waits-for-the-hosts-answer/plan.md
  - plans/cli/20261030-0802-ahpd-usage-and-tasks-are-shown/plan.md
---

# Decide on five findings from the checks by hand of 2026-11-03

The checks by hand against ahpd `main` passed on 2026-11-03.
Five things were seen that no check covers.
None blocks a release.
Each section says how to see the finding, and what to decide.

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

## Two parts of an answer print with no gap

`prompt` writes each new markdown part right after the last one, with no line break between them.
On 2026-11-03 a steered turn printed `said yes.The light`.

1. Run `<ahpc> prompt <session> "Write a 500-word story. No tools."`.
2. While it runs, run `<ahpc> prompt <session> "End the story in one sentence." --steer`.
3. Look for two sentences with no space between them where the second part starts.
4. Decide whether a new part starts on a new line.

## The price prints every decimal place

`session history` prints the price as the host sends it, such as `0.1066192 USD`.

1. Run `<ahpc> prompt <session> "Reply with the single word: hi"`.
2. Run `<ahpc> session history <session>`.
3. Look at the price on the usage line under the agent turn.
4. Decide whether the price is rounded, and to how many places.

## A bad terminal URI prints two errors

`terminal send` to a terminal that does not exist prints the subscribe error, -32001, and then the host's rejection.

1. Run `<ahpc> terminal send ahp-terminal:/no-such-terminal hi`.
2. Check that two error lines are printed.
3. Decide whether only one line is printed, and which one.

## `ahpc mcp` over stdio does one call at a time

The stdio server answers one message after the other, as the comment in `src/mcp/stdio.ts` says.
A `send_turn` from one MCP client therefore waits for the client's last `send_turn` to end.
The `busy` refusal is seen only when another client started the turn.

1. Start a long turn on `<session>` with `<ahpc> prompt`.
2. From an MCP client of `<ahpc> mcp`, call `send_turn` on `<session>` without `busy`.
3. Check that the call is refused with "A turn is running."
4. Decide whether this is enough, or whether stdio answers calls at the same time.

## The smoke test needs a folder named `ahpc`

`test/smoke.test.tsx` "puts where the session runs on a row of its own" expects the checkout folder to be named `ahpc`.
It fails in every worktree, and in any clone with another folder name.
CI is green, because its checkout is named `ahpc`.

1. Clone the repository into a folder with another name.
2. Run `npx vitest run test/smoke.test.tsx`.
3. Check that the one case fails.
4. Decide whether the test reads the folder name from the checkout instead.

## Reply

- For each section, write "leave it", "fix it", or what to do instead.

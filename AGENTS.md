<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Playwright tests on every change

After making any code change under `src/`, you must:

1. Update or add Playwright tests under `tests/` to cover the changed behavior — new UI affordances, modified flows, fixed bugs all need test coverage.
2. Run the suite with `npm run test:e2e` (mocked, default) before reporting the task done. Use `npm run test:e2e:live` only when the change depends on real CoinCap API behavior.
3. If tests fail, fix the underlying issue before completing the task. Do not skip, `.only`, or comment out tests to make the suite pass.

The Playwright MCP server is configured in `.mcp.json` — prefer driving the browser through it for ad-hoc verification rather than spinning up a separate session.

# Copy-ready Claude frontend redesign prompt

Copy the text below to Claude after confirming the current functional frontend
is available.

```text
You are redesigning the frontend of the GenLayer project “Package Release Provenance Consistency Register”.

Execution context is mandatory:
- The project root is exactly `E:\Genlayer-Projects\package-release-provenance-consistency-register`.
- The current functional frontend is at revision `e28ce74f55ec561e60ff53737ce99c43f9c02933`.
- Do not work in the CLIProxyAPI directory, your default working directory, a copied project, or any other checkout.
- Before inspecting or editing, change into the project root with `Set-Location -LiteralPath 'E:\Genlayer-Projects\package-release-provenance-consistency-register'` and verify that `git rev-parse --show-toplevel` resolves to that exact directory.
- Verify that `frontend/src/App.tsx`, `frontend/src/styles.css`, and `frontend/index.html` exist there. Do not ask the user to paste source files. If the exact project root is inaccessible, stop and report the exact path and command error; do not substitute another directory.

Before designing, read only the applicable current guidance (do not edit any of it):
- `E:\Genlayer\AGENTS.md`
- `E:\Genlayer\governance\START-HERE.md`
- `E:\Genlayer\governance\AI-HIERARCHY.md`, especially the Claude handoff section
- `E:\Genlayer\brain\Engineering and UI Quality Rules.md`, especially `Connect-wallet picker visual reference`, `FRONTEND.WALLET_SELECTOR`, and `FRONTEND.PUBLIC_WALLET_LANGUAGE`
- `E:\Genlayer\brain\Reusable Frontend Build Patterns.md`, especially the reusable wallet-selector and accessibility patterns
- Inspect `E:\Genlayer\brain\assets\wallet-selector-reference\connect-wallet-picker-reference.png` before changing the picker hierarchy or interaction pattern.
- Applicable official GenLayer documentation: `https://docs.genlayer.com/`. Use it only for relevant current frontend/runtime context; it does not authorize changing contract or transaction behavior.

Scope is strictly frontend source/assets only in the exact project root above:
- You may edit: `frontend/src/App.tsx`, `frontend/src/styles.css`, `frontend/index.html`, and frontend public/static image or brand assets required by the redesign.
- Do not edit the contract, backend, tests, package manifests/lockfiles, RPC/provider/transaction modules, configuration, governance, deployment files, GitHub/Vercel files, or release/evidence documents.
- Do not add dependencies.
- Preserve every existing handler, method name, argument order, readback step, finality/semantic-success guard, bounded polling behavior, selected-wallet routing, and provider isolation behavior. If a UI change needs logic, make the smallest change inside App.tsx only and do not alter the protocol or transaction modules.

Redesign the app as a polished public product for end users and GenLayer judges:
- Create a clear, calm, trustworthy visual system for release provenance and source integrity.
- Improve layout hierarchy, spacing, typography, color palette, responsive behavior, form grouping, case inspection, action affordances, empty states, loading states, success states, error states, disabled states, and narrow/mobile layouts.
- Add a distinctive, simple logo/brand mark that fits the product; it must not imitate a wallet, chain, provider, or developer tool.
- Make the primary flow obvious: register a package release, inspect a case, then take the allowed next action.
- Use accessible labels, keyboard focus states, semantic landmarks, readable contrast, and responsive controls.
- Keep copy concise and user-facing. Never display EIP-6963, provider objects, RPC URLs, chain IDs, wallet routing, implementation details, debug text, test state, tool names, internal reviewer notes, AI/developer instructions, or raw error internals anywhere in UI, modal, tooltip, alert, screenshot, or logo. Translate technical failures into professional user guidance.
- Do not expose secrets or private wallet material. Wallet selection must remain explicit and disconnected on reload.

Wallet picker requirements are mandatory:
- Clicking `Connect wallet` opens a clear picker/sheet like the supplied visual reference: each available option is its own row with recognizable icon, exact wallet name, short user-facing description, and a selection affordance; include MetaMask, OKX Wallet, and Rabby only when available.
- Choosing a wallet is the only event allowed to start connection. Opening the picker, having one option, canceling, pressing Escape, clicking the backdrop, or reloading must issue zero account requests.
- Preserve the current explicit-provider behavior and states: no wallet available, cancel, rejected connection, disconnect, account change, network change, switching wallet, and reconnect after reload.
- Keep connection errors inside the open picker as an accessible alert. Keep the background inert while the picker is open, focus the picker initially, trap Tab/Shift+Tab, close on Escape, and restore focus to the initiating button.
- Do not repeat the three wallet names in helper text, footer, status text, tooltip, or banner outside their individual picker options.

Before editing, inspect the existing frontend files and understand their current behavior. Then implement the redesign directly in the allowed frontend files. Do not redesign the contract or invent unsupported functionality. Keep the existing public data fields and contract workflow intact.

At the end, report only:
1. files changed;
2. a concise description of the visual/UX changes;
3. any frontend-only accessibility or responsive decisions;
4. confirmation that no contract, backend, test, configuration, dependency, deployment, or release file was changed.
Do not claim tests, deployment, or release completion unless I provide those results separately.
```

# Copy-ready Claude frontend redesign prompt

Copy the text below to Claude after confirming the current functional frontend
is available.

```text
You are redesigning the frontend of the GenLayer project “Package Release Provenance Consistency Register”.

Scope is strictly frontend source/assets only:
- You may edit: frontend/src/App.tsx, frontend/src/styles.css, frontend/index.html, and frontend public/static image or brand assets required by the redesign.
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

Before editing, inspect the existing frontend files and understand their current behavior. Then implement the redesign directly in the allowed frontend files. Do not redesign the contract or invent unsupported functionality. Keep the existing public data fields and contract workflow intact.

At the end, report only:
1. files changed;
2. a concise description of the visual/UX changes;
3. any frontend-only accessibility or responsive decisions;
4. confirmation that no contract, backend, test, configuration, dependency, deployment, or release file was changed.
Do not claim tests, deployment, or release completion unless I provide those results separately.
```

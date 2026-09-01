// React DOM assertions use the existing jsdom/Vitest setup; no extra test dependency is needed.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

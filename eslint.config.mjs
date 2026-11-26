import nextConfig from "eslint-config-next";
import boundaries from "eslint-plugin-boundaries";
import functional from "eslint-plugin-functional";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

const nextTsPlugin = nextConfig.find((c) => c.plugins?.["@typescript-eslint"])?.plugins?.[
  "@typescript-eslint"
];
const availableTsRules = new Set(Object.keys(nextTsPlugin?.rules ?? {}));

const strictTypeCheckedRules = Object.fromEntries(
  Object.entries(
    Object.assign({}, ...tseslint.configs.strictTypeChecked.map((c) => c.rules ?? {})),
  ).filter(([name]) => {
    if (!name.startsWith("@typescript-eslint/")) return true;
    return availableTsRules.has(name.slice("@typescript-eslint/".length));
  }),
);

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "backend/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...nextConfig,
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
      boundaries,
      functional,
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "zod",
              message: "Use Effect Schema (`effect/Schema`) instead of Zod.",
            },
            {
              name: "zod-validation-error",
              message: "Use Effect Schema (`effect/Schema`) instead of Zod.",
            },
          ],
        },
      ],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  {
    files: ["src/contexts/**/*.{ts,tsx}", "src/platform/**/*.{ts,tsx}", "src/shared/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      "boundaries/elements": [
        { type: "app", pattern: "src/app/**/*", partialMatch: false },
        { type: "shared-ui", pattern: "src/shared/ui/**/*", partialMatch: false },
        { type: "shared", pattern: "src/shared/**/*", partialMatch: false },
        { type: "platform", pattern: "src/platform/**/*", partialMatch: false },
        {
          type: "shared-kernel",
          pattern: "src/contexts/shared-kernel/**/*",
          partialMatch: false,
        },
        {
          type: "context-domain",
          pattern: "src/contexts/*/domain/**/*",
          capture: ["context"],
          partialMatch: false,
        },
        {
          type: "context-workflows",
          pattern: "src/contexts/*/workflows/**/*",
          capture: ["context"],
          partialMatch: false,
        },
        {
          type: "context-adapters",
          pattern: "src/contexts/*/adapters/**/*",
          capture: ["context"],
          partialMatch: false,
        },
        {
          type: "context-ui",
          pattern: "src/contexts/*/ui/**/*",
          capture: ["context"],
          partialMatch: false,
        },
        {
          type: "context-public",
          pattern: "src/contexts/*/index.ts",
          capture: ["context"],
          partialMatch: false,
        },
      ],
    },
    rules: {
      ...strictTypeCheckedRules,
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='fetch'][arguments.0.value=/^\\/api/]",
          message:
            "Do not call /api/* from new client/context code; use Server Actions or RSC queries.",
        },
      ],
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              from: { element: { type: "shared-kernel" } },
              allow: { to: { element: [{ type: "shared-kernel" }] } },
            },
            {
              from: { element: { type: "context-domain" } },
              allow: {
                to: {
                  element: [
                    { type: "shared-kernel" },
                    {
                      type: "context-domain",
                      captured: { context: "{{ from.captured.context }}" },
                    },
                  ],
                },
              },
            },
            {
              from: { element: { type: "context-workflows" } },
              allow: {
                to: {
                  element: [
                    { type: "shared-kernel" },
                    {
                      type: "context-domain",
                      captured: { context: "{{ from.captured.context }}" },
                    },
                    {
                      type: "context-workflows",
                      captured: { context: "{{ from.captured.context }}" },
                    },
                  ],
                },
              },
            },
            {
              from: { element: { type: "context-adapters" } },
              allow: {
                to: {
                  element: [
                    { type: "shared-kernel" },
                    { type: "shared" },
                    { type: "platform" },
                    {
                      type: "context-domain",
                      captured: { context: "{{ from.captured.context }}" },
                    },
                    {
                      type: "context-workflows",
                      captured: { context: "{{ from.captured.context }}" },
                    },
                    {
                      type: "context-adapters",
                      captured: { context: "{{ from.captured.context }}" },
                    },
                  ],
                },
              },
            },
            {
              from: { element: { type: "context-ui" } },
              allow: {
                to: {
                  element: [
                    { type: "shared-kernel" },
                    { type: "shared-ui" },
                    { type: "shared" },
                    { type: "platform" },
                    {
                      type: "context-domain",
                      captured: { context: "{{ from.captured.context }}" },
                    },
                    {
                      type: "context-workflows",
                      captured: { context: "{{ from.captured.context }}" },
                    },
                    {
                      type: "context-ui",
                      captured: { context: "{{ from.captured.context }}" },
                    },
                    { type: "context-public" },
                  ],
                },
              },
            },
            {
              from: { element: { type: "context-public" } },
              allow: {
                to: {
                  element: [
                    {
                      type: [
                        "context-domain",
                        "context-workflows",
                        "context-adapters",
                        "context-ui",
                      ],
                      captured: { context: "{{ from.captured.context }}" },
                    },
                  ],
                },
              },
            },
            {
              from: { element: { type: "platform" } },
              allow: {
                to: {
                  element: [{ type: "platform" }, { type: "shared" }, { type: "shared-kernel" }],
                },
              },
            },
            {
              from: { element: { type: "shared" } },
              allow: {
                to: { element: [{ type: "shared" }, { type: "shared-kernel" }] },
              },
            },
            {
              from: { element: { type: "shared-ui" } },
              allow: {
                to: { element: [{ type: "shared-ui" }, { type: "shared" }] },
              },
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/contexts/*/domain/**/*.ts"],
    rules: {
      "functional/immutable-data": "error",
      "functional/no-let": "error",
      "functional/no-loop-statements": "error",
      "functional/no-throw-statements": "error",
      "functional/no-try-statements": "error",
      "functional/prefer-readonly-type": "error",
      "no-restricted-properties": [
        "error",
        {
          object: "Date",
          property: "now",
          message: "Pass time as a parameter into domain functions.",
        },
        {
          object: "Math",
          property: "random",
          message: "Pass a seed or RNG as a parameter into domain functions.",
        },
        {
          object: "crypto",
          property: "randomUUID",
          message: "Pass generated IDs as parameters into domain functions.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "zod", message: "Use Effect Schema instead of Zod." },
            {
              name: "@sqlitecloud/drivers",
              message: "Domain must not import DB drivers.",
            },
          ],
          patterns: ["node:*", "next/*"],
        },
      ],
    },
  },
  {
    files: ["src/contexts/*/ui/**/*.tsx"],
    ignores: ["**/__tests__/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='fetch'][arguments.0.value=/^\\/api/]",
          message:
            "Do not call /api/* from new client/context code; use Server Actions or RSC queries.",
        },
        {
          selector: "JSXOpeningElement[name.name=/^(button|select|textarea|label|h[1-6]|p)$/]",
          message: "Use HeroUI v3 wrappers from @/shared/ui instead of raw HTML UI tags.",
        },
        {
          selector:
            "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'][value.value=/^(file|hidden)$/]))",
          message:
            "Use HeroUI v3 input wrappers (TextInput, NumberInput, SearchInput, RangeSlider, CheckboxControl) from @/shared/ui instead of raw <input>.",
        },
      ],
    },
  },
];

export default eslintConfig;

import next from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const config = [
  ...next,
  ...nextTs,
  { ignores: ['.next/**', '.next-e2e/**', 'src/generated/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts'] },
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='parseFloat']",
          message: 'Never use floating point for money. Use the SDK bigint helpers.',
        },
      ],
    },
  },
]

export default config

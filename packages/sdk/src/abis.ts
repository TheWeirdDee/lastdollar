/** Minimal ABI for the USDC ERC-20 interface on Arc (a FiatToken proxy at 0x3600…0000). */
export const usdcAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'isBlacklisted',
    stateMutability: 'view',
    inputs: [{ name: '_account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const

/** ABI of contracts/src/LastDollarSplitter.sol. */
export const splitterAbi = [
  {
    type: 'function',
    name: 'pay',
    stateMutability: 'payable',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'MAX_RECIPIENTS',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'BatchPaid',
    inputs: [
      { name: 'payer', type: 'address', indexed: true },
      { name: 'recipientCount', type: 'uint256', indexed: false },
      { name: 'total', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Payout',
    inputs: [
      { name: 'payer', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'index', type: 'uint256', indexed: false },
    ],
  },
  { type: 'error', name: 'EmptyBatch', inputs: [] },
  {
    type: 'error',
    name: 'TooManyRecipients',
    inputs: [
      { name: 'count', type: 'uint256' },
      { name: 'max', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'LengthMismatch',
    inputs: [
      { name: 'recipients', type: 'uint256' },
      { name: 'amounts', type: 'uint256' },
    ],
  },
  { type: 'error', name: 'ZeroRecipient', inputs: [{ name: 'index', type: 'uint256' }] },
  { type: 'error', name: 'SelfRecipient', inputs: [{ name: 'index', type: 'uint256' }] },
  { type: 'error', name: 'ZeroAmount', inputs: [{ name: 'index', type: 'uint256' }] },
  {
    type: 'error',
    name: 'ValueMismatch',
    inputs: [
      { name: 'expected', type: 'uint256' },
      { name: 'received', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'PayoutFailed',
    inputs: [
      { name: 'index', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'reason', type: 'bytes' },
    ],
  },
  { type: 'error', name: 'Reentrancy', inputs: [] },
] as const

/** Standard ERC-20 Transfer topic, also used by Arc's EIP-7708 native transfer logs. */
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const

/** LastDollarSplitter.MAX_RECIPIENTS; the SDK enforces it before quoting. */
export const SPLITTER_MAX_RECIPIENTS = 200

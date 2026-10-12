export {
  arcMainnet,
  arcTestnet,
  defineArcNetwork,
  explorerAddressUrl,
  explorerTxUrl,
  ARC_NATIVE_TRANSFER_EMITTER,
  ARC_USDC_ADDRESS,
  NATIVE_DECIMALS,
  SCALE,
  TOKEN_DECIMALS,
  type ArcNetworkConfig,
} from './config.js'
export {
  parseUsdc,
  parseUsdc6,
  parseNativeUsdc,
  toNative18,
  toToken6Floor,
  subMicroRemainder,
  isTokenRepresentable,
  saturatingSub,
  formatUsdc,
  formatUsdc6,
  formatNativeExact,
  bigintReplacer,
  bigintReviver,
  type FormatOptions,
} from './units.js'
export {
  applyGasMargin,
  checkExactAffordability,
  feeBudget18,
  maxNativeAmount18,
  maxTokenAmount6,
  projectRemaining,
  sumAmounts,
  type Affordability,
  type ExactAffordabilityInput,
  type RemainderProjection,
} from './math.js'
export {
  buildFeeQuote,
  clampPriorityFee,
  computeMaxFeePerGas,
  defaultFeePolicy,
  feeContextFromBlock,
  parseNextBaseFee,
  readFeeContext,
  type FeeContext,
  type FeePolicy,
  type FeeQuote,
} from './fees.js'
export { LastDollarError, classifyError, isLastDollarError, type LastDollarErrorCode } from './errors.js'
export { readArcBalance, assertClientChain, snapshotFrom, type ReadArcBalanceInput } from './balance.js'
export { validateBatchLines, parseBatchCsv, BATCH_CSV_TEMPLATE, type BatchValidation, type CsvParseResult, type CsvRow } from './batch.js'
export {
  quoteExactPayment,
  quoteMaxPayment,
  quoteBatchPayment,
  requote,
  type QuoteContext,
  type ExactPaymentInput,
  type MaxPaymentInput,
  type BatchPaymentInput,
} from './quote.js'
export { preparePayment, revalidatePlan } from './plan.js'
export { executePayment, toViemChain, type ExecutePaymentInput } from './execute.js'
export { verifyPaymentReceipt, extractTransfers, type VerifyReceiptInput } from './receipt.js'
export { usdcAbi, splitterAbi, TRANSFER_TOPIC, SPLITTER_MAX_RECIPIENTS } from './abis.js'
export type * from './types.js'

export const SDK_VERSION = '0.1.0'

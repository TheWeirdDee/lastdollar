// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title LastDollarSplitter
/// @notice Non-custodial, atomic native-USDC batch payments for Arc.
/// @dev On Arc the native currency is USDC with 18 decimals. The payer sends exactly the sum of
///      all payouts as `msg.value`; the contract forwards each amount within the same call and
///      reverts the whole batch if any payout fails. The contract has no owner, no fees, no
///      upgrade path, no receive/fallback function and never relies on `address(this).balance`.
contract LastDollarSplitter {
    /// @notice Hard cap on recipients per batch so execution cost stays well inside a block.
    uint256 public constant MAX_RECIPIENTS = 200;

    /// @notice Emitted once per batch after every payout succeeded.
    event BatchPaid(address indexed payer, uint256 recipientCount, uint256 total);

    /// @notice Emitted for each payout, in input order.
    event Payout(address indexed payer, address indexed recipient, uint256 amount, uint256 index);

    error EmptyBatch();
    error TooManyRecipients(uint256 count, uint256 max);
    error LengthMismatch(uint256 recipients, uint256 amounts);
    error ZeroRecipient(uint256 index);
    error SelfRecipient(uint256 index);
    error ZeroAmount(uint256 index);
    error ValueMismatch(uint256 expected, uint256 received);
    error PayoutFailed(uint256 index, address recipient, bytes reason);
    error Reentrancy();

    uint256 private _locked = 1;

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    /// @notice Pay every recipient its amount, atomically.
    /// @param recipients Payout addresses. Repeats are allowed and each entry is paid separately.
    /// @param amounts Native (18-decimal) amounts, one per recipient, each greater than zero.
    function pay(address[] calldata recipients, uint256[] calldata amounts) external payable nonReentrant {
        uint256 count = recipients.length;
        if (count == 0) revert EmptyBatch();
        if (count > MAX_RECIPIENTS) revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != amounts.length) revert LengthMismatch(count, amounts.length);

        uint256 total;
        for (uint256 i; i < count; ++i) {
            address recipient = recipients[i];
            if (recipient == address(0)) revert ZeroRecipient(i);
            if (recipient == address(this)) revert SelfRecipient(i);
            uint256 amount = amounts[i];
            if (amount == 0) revert ZeroAmount(i);
            total += amount; // checked arithmetic: overflow reverts
        }
        if (msg.value != total) revert ValueMismatch(total, msg.value);

        for (uint256 i; i < count; ++i) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];
            // Forward all remaining gas: fixed-stipend transfer/send can fail for contract wallets.
            (bool ok, bytes memory reason) = recipient.call{value: amount}("");
            if (!ok) revert PayoutFailed(i, recipient, reason);
            emit Payout(msg.sender, recipient, amount, i);
        }

        emit BatchPaid(msg.sender, count, total);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice TEST ONLY. Placed at 0x3600…0000 on a local anvil chain so the SDK's balance reads
///         work. It mirrors Arc's truncating 6-decimal view of the native balance. It cannot
///         move native value, so ERC-20 transfers are deliberately unsupported here; ERC-20
///         execution is covered by mainnet evidence instead.
contract MockArcUsdcView {
    function decimals() external pure returns (uint8) {
        return 6;
    }

    function balanceOf(address account) external view returns (uint256) {
        return account.balance / 1e12;
    }

    function isBlacklisted(address) external pure returns (bool) {
        return false;
    }

    function transfer(address, uint256) external pure returns (bool) {
        revert("MockArcUsdcView: ERC-20 transfer is not modelled locally");
    }
}

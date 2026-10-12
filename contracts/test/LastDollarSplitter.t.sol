// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {LastDollarSplitter} from "../src/LastDollarSplitter.sol";

contract RevertingReceiver {
    receive() external payable {
        revert("no thanks");
    }
}

contract NoReceiveFunction {}

/// Uses far more than the 2300-gas stipend; a transfer()/send() based splitter would fail here.
contract GasHungryReceiver {
    uint256 public hits;

    receive() external payable {
        for (uint256 i; i < 5; ++i) {
            hits += 1;
        }
    }
}

/// Tries to re-enter with the funds it just received and swallows the failure.
contract ReentrantReceiver {
    LastDollarSplitter public immutable splitter;
    bool public attempted;
    bool public reentrySucceeded;

    constructor(LastDollarSplitter s) {
        splitter = s;
    }

    receive() external payable {
        if (attempted) return;
        attempted = true;
        address[] memory r = new address[](1);
        uint256[] memory a = new uint256[](1);
        r[0] = address(this);
        a[0] = msg.value;
        try splitter.pay{value: msg.value}(r, a) {
            reentrySucceeded = true;
        } catch {}
    }
}

/// Re-enters and bubbles the failure up, so the whole batch must revert.
contract StrictReentrantReceiver {
    LastDollarSplitter public immutable splitter;

    constructor(LastDollarSplitter s) {
        splitter = s;
    }

    receive() external payable {
        address[] memory r = new address[](1);
        uint256[] memory a = new uint256[](1);
        r[0] = address(this);
        a[0] = msg.value;
        splitter.pay{value: msg.value}(r, a);
    }
}

contract LastDollarSplitterTest is Test {
    LastDollarSplitter internal splitter;
    address internal payer = makeAddr("payer");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    event BatchPaid(address indexed payer, uint256 recipientCount, uint256 total);
    event Payout(address indexed payer, address indexed recipient, uint256 amount, uint256 index);

    function setUp() public {
        splitter = new LastDollarSplitter();
        vm.deal(payer, 1_000_000 ether);
    }

    function _two(address a, address b) internal pure returns (address[] memory r) {
        r = new address[](2);
        r[0] = a;
        r[1] = b;
    }

    function _amts(uint256 a, uint256 b) internal pure returns (uint256[] memory r) {
        r = new uint256[](2);
        r[0] = a;
        r[1] = b;
    }

    function test_paysAllRecipientsExactly() public {
        address[] memory r = new address[](3);
        uint256[] memory a = new uint256[](3);
        (r[0], r[1], r[2]) = (alice, bob, carol);
        // Includes a 1-wei payout: native amounts below one micro-USDC are preserved exactly.
        (a[0], a[1], a[2]) = (1e18, 2.5e18, 1);
        vm.expectEmit(true, true, false, true, address(splitter));
        emit Payout(payer, alice, 1e18, 0);
        vm.expectEmit(true, true, false, true, address(splitter));
        emit Payout(payer, bob, 2.5e18, 1);
        vm.expectEmit(true, true, false, true, address(splitter));
        emit Payout(payer, carol, 1, 2);
        vm.expectEmit(true, false, false, true, address(splitter));
        emit BatchPaid(payer, 3, 3.5e18 + 1);
        vm.prank(payer);
        splitter.pay{value: 3.5e18 + 1}(r, a);
        assertEq(alice.balance, 1e18);
        assertEq(bob.balance, 2.5e18);
        assertEq(carol.balance, 1);
        assertEq(address(splitter).balance, 0, "no custody");
    }

    function test_revertsOnEmptyBatch() public {
        vm.prank(payer);
        vm.expectRevert(LastDollarSplitter.EmptyBatch.selector);
        splitter.pay{value: 0}(new address[](0), new uint256[](0));
    }

    function test_revertsOnLengthMismatch() public {
        uint256[] memory a = new uint256[](1);
        a[0] = 1;
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(LastDollarSplitter.LengthMismatch.selector, 2, 1));
        splitter.pay{value: 1}(_two(alice, bob), a);
    }

    function test_revertsWhenValueTooLow() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(LastDollarSplitter.ValueMismatch.selector, 3, 2));
        splitter.pay{value: 2}(_two(alice, bob), _amts(1, 2));
    }

    function test_revertsOnExcessValue() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(LastDollarSplitter.ValueMismatch.selector, 3, 4));
        splitter.pay{value: 4}(_two(alice, bob), _amts(1, 2));
    }

    function test_revertsOnZeroAmount() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(LastDollarSplitter.ZeroAmount.selector, 1));
        splitter.pay{value: 1}(_two(alice, bob), _amts(1, 0));
    }

    function test_revertsOnZeroRecipient() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(LastDollarSplitter.ZeroRecipient.selector, 1));
        splitter.pay{value: 2}(_two(alice, address(0)), _amts(1, 1));
    }

    function test_revertsOnSelfRecipient() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(LastDollarSplitter.SelfRecipient.selector, 0));
        splitter.pay{value: 2}(_two(address(splitter), alice), _amts(1, 1));
    }

    function test_recipientLimit() public {
        uint256 max = splitter.MAX_RECIPIENTS();
        address[] memory r = new address[](max);
        uint256[] memory a = new uint256[](max);
        for (uint256 i; i < max; ++i) {
            r[i] = address(uint160(0x10000 + i));
            a[i] = 1;
        }
        vm.prank(payer);
        splitter.pay{value: max}(r, a);
        assertEq(r[max - 1].balance, 1);

        address[] memory r2 = new address[](max + 1);
        uint256[] memory a2 = new uint256[](max + 1);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(LastDollarSplitter.TooManyRecipients.selector, max + 1, max));
        splitter.pay{value: 0}(r2, a2);
    }

    function test_overflowingTotalReverts() public {
        vm.prank(payer);
        vm.expectRevert(); // arithmetic overflow panic
        splitter.pay{value: 1}(_two(alice, bob), _amts(type(uint256).max, 2));
    }

    function test_duplicateRecipientsArePaidPerEntry() public {
        vm.prank(payer);
        splitter.pay{value: 5}(_two(alice, alice), _amts(2, 3));
        assertEq(alice.balance, 5);
    }

    function test_revertingReceiverRollsBackEveryPayout() public {
        RevertingReceiver bad = new RevertingReceiver();
        address[] memory r = new address[](3);
        uint256[] memory a = new uint256[](3);
        (r[0], r[1], r[2]) = (alice, address(bad), bob);
        (a[0], a[1], a[2]) = (10, 20, 30);
        uint256 before = payer.balance;
        vm.prank(payer);
        vm.expectRevert();
        splitter.pay{value: 60}(r, a);
        assertEq(alice.balance, 0, "earlier payout rolled back");
        assertEq(bob.balance, 0);
        assertEq(payer.balance, before);
    }

    function test_contractWithoutReceiveRollsBack() public {
        NoReceiveFunction nr = new NoReceiveFunction();
        vm.prank(payer);
        vm.expectRevert(
            abi.encodeWithSelector(LastDollarSplitter.PayoutFailed.selector, 1, address(nr), bytes(""))
        );
        splitter.pay{value: 2}(_two(alice, address(nr)), _amts(1, 1));
        assertEq(alice.balance, 0);
    }

    function test_gasHungryReceiverIsSupported() public {
        GasHungryReceiver g = new GasHungryReceiver();
        vm.prank(payer);
        splitter.pay{value: 3}(_two(alice, address(g)), _amts(1, 2));
        assertEq(address(g).balance, 2);
        assertEq(g.hits(), 5);
    }

    function test_reentrancyIsBlocked() public {
        ReentrantReceiver evil = new ReentrantReceiver(splitter);
        vm.prank(payer);
        splitter.pay{value: 3}(_two(address(evil), alice), _amts(2, 1));
        assertTrue(evil.attempted());
        assertFalse(evil.reentrySucceeded());
        assertEq(address(evil).balance, 2);
        assertEq(alice.balance, 1);
        assertEq(address(splitter).balance, 0);
    }

    function test_reentrancyFailureBubblesAndRollsBack() public {
        StrictReentrantReceiver evil = new StrictReentrantReceiver(splitter);
        vm.prank(payer);
        vm.expectRevert();
        splitter.pay{value: 3}(_two(alice, address(evil)), _amts(1, 2));
        assertEq(alice.balance, 0);
    }

    function test_plainDepositsAreRejected() public {
        vm.prank(payer);
        (bool ok,) = address(splitter).call{value: 1}("");
        assertFalse(ok);
    }

    function test_forcedBalanceDoesNotAffectAccounting() public {
        vm.deal(address(splitter), 7); // stands in for a forced deposit
        vm.prank(payer);
        splitter.pay{value: 3}(_two(alice, bob), _amts(1, 2));
        assertEq(address(splitter).balance, 7, "forced balance is neither paid out nor counted");
        assertEq(alice.balance, 1);
        assertEq(bob.balance, 2);
    }

    function testFuzz_conservesValue(uint96[8] memory raw, uint8 n) public {
        uint256 count = bound(n, 1, 8);
        address[] memory r = new address[](count);
        uint256[] memory a = new uint256[](count);
        uint256 total;
        for (uint256 i; i < count; ++i) {
            r[i] = address(uint160(0xA0000 + i));
            a[i] = bound(uint256(raw[i]), 1, type(uint96).max);
            total += a[i];
        }
        vm.deal(payer, total + 1 ether);
        uint256 before = payer.balance;
        vm.prank(payer);
        splitter.pay{value: total}(r, a);
        uint256 received;
        for (uint256 i; i < count; ++i) {
            assertEq(r[i].balance, a[i]);
            received += r[i].balance;
        }
        assertEq(received, total);
        assertEq(payer.balance, before - total);
        assertEq(address(splitter).balance, 0);
    }

    function testFuzz_wrongValueAlwaysReverts(uint64 x, uint64 y, uint128 sent) public {
        uint256 a = bound(uint256(x), 1, type(uint64).max);
        uint256 b = bound(uint256(y), 1, type(uint64).max);
        vm.assume(uint256(sent) != a + b);
        vm.deal(payer, uint256(sent) + 1);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(LastDollarSplitter.ValueMismatch.selector, a + b, uint256(sent)));
        splitter.pay{value: sent}(_two(alice, bob), _amts(a, b));
    }
}

/// Drives random valid and invalid batches for the invariant suite.
contract SplitterHandler is Test {
    LastDollarSplitter public splitter;
    uint256 public paidOut;
    uint256 public sent;

    constructor(LastDollarSplitter s) {
        splitter = s;
        vm.deal(address(this), type(uint128).max);
    }

    function pay(uint64 a, uint64 b, bool wrongValue) external {
        uint256 x = bound(uint256(a), 1, 1e24);
        uint256 y = bound(uint256(b), 1, 1e24);
        address[] memory r = new address[](2);
        uint256[] memory v = new uint256[](2);
        r[0] = address(0xBEEF1);
        r[1] = address(0xBEEF2);
        v[0] = x;
        v[1] = y;
        uint256 value = wrongValue ? x + y + 1 : x + y;
        try splitter.pay{value: value}(r, v) {
            paidOut += x + y;
            sent += value;
        } catch {}
    }
}

contract LastDollarSplitterInvariantTest is Test {
    LastDollarSplitter internal splitter;
    SplitterHandler internal handler;

    function setUp() public {
        splitter = new LastDollarSplitter();
        handler = new SplitterHandler(splitter);
        targetContract(address(handler));
    }

    function invariant_noCustody() public view {
        assertEq(address(splitter).balance, 0);
    }

    function invariant_everythingSentWasPaidOut() public view {
        assertEq(handler.sent(), handler.paidOut());
        assertEq(address(0xBEEF1).balance + address(0xBEEF2).balance, handler.paidOut());
    }
}

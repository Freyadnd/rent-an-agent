// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {AgentVault} from "../src/AgentVault.sol";
import {SubscriptionPayment} from "../src/SubscriptionPayment.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @dev Mock USDC (6 decimals)
contract MockUSDC {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8  public decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply    += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from]            -= amount;
        balanceOf[to]              += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

contract AgentVaultTest is Test {
    MockUSDC        usdc;
    AgentRegistry   registry;
    SubscriptionPayment subPayment;

    address operator  = makeAddr("operator");
    address lp1       = makeAddr("lp1");
    address lp2       = makeAddr("lp2");
    address user      = makeAddr("user");
    address owsWallet = makeAddr("owsWallet");

    uint256 constant MATURITY_DELTA = 30 days;
    uint256 constant FUNDING_GOAL   = 1000e6;

    AgentVault vault;
    uint256 agentId;
    uint256 maturity;

    function setUp() public {
        usdc       = new MockUSDC();
        registry   = new AgentRegistry(address(usdc));
        subPayment = new SubscriptionPayment(address(usdc), address(registry));

        usdc.mint(lp1,      2000e6);
        usdc.mint(lp2,      2000e6);
        usdc.mint(user,     500e6);
        usdc.mint(operator, 5000e6);

        maturity = block.timestamp + MATURITY_DELTA;

        vm.prank(operator);
        (agentId, ) = registry.registerAgent(
            owsWallet,
            "TestAgent",
            "https://agent.example.com",
            "A test agent",
            maturity,
            FUNDING_GOAL,
            0x07  // x402 + subscription + trading
        );

        vault = AgentVault(registry.getAgent(agentId).vault);
    }

    // ─────────────────────────────────────────── deposit ──

    function test_deposit_basic() public {
        vm.startPrank(lp1);
        usdc.approve(address(vault), 500e6);
        vault.deposit(500e6);
        vm.stopPrank();

        assertEq(vault.totalDeposited(), 500e6);
        assertEq(vault.shares(lp1), 500e6);
    }

    function test_deposit_capped_at_goal() public {
        vm.startPrank(lp1);
        usdc.approve(address(vault), 2000e6);
        vault.deposit(2000e6);
        vm.stopPrank();

        assertEq(vault.totalDeposited(), FUNDING_GOAL);
        assertEq(vault.vaultClosed(), true);
    }

    function test_deposit_fails_after_maturity() public {
        vm.warp(maturity + 1);
        vm.startPrank(lp1);
        usdc.approve(address(vault), 100e6);
        vm.expectRevert(AgentVault.VaultNotOpen.selector);
        vault.deposit(100e6);
        vm.stopPrank();
    }

    // ─────────────────────────────────────────── revenue (balance-based) ──

    function test_revenue_direct_transfer() public {
        // Simulate x402: user pays directly to vault address (payTo = vault)
        vm.prank(lp1);
        usdc.approve(address(vault), 500e6);
        vm.prank(lp1);
        vault.deposit(500e6);

        usdc.mint(address(vault), 100e6); // simulate x402 payment landing

        (, uint256 revenue,,,) = vault.status();
        assertEq(revenue, 100e6);
    }

    function test_revenue_zero_before_any_deposit() public {
        (, uint256 revenue,,,) = vault.status();
        assertEq(revenue, 0);
    }

    // ─────────────────────────────────────────── redeem ──

    function test_redeem_full_flow() public {
        vm.prank(lp1); usdc.approve(address(vault), 600e6);
        vm.prank(lp1); vault.deposit(600e6);
        vm.prank(lp2); usdc.approve(address(vault), 400e6);
        vm.prank(lp2); vault.deposit(400e6);

        // x402 revenue lands directly in vault
        usdc.mint(address(vault), 200e6);

        vm.warp(maturity + 1);

        uint256 lp1Before = usdc.balanceOf(lp1);
        uint256 lp2Before = usdc.balanceOf(lp2);

        vm.prank(lp1); vault.redeem();
        vm.prank(lp2); vault.redeem();

        // lp1: (1000+200)*600/1000 = 720
        // lp2: (1000+200)*400/1000 = 480
        assertEq(usdc.balanceOf(lp1) - lp1Before, 720e6);
        assertEq(usdc.balanceOf(lp2) - lp2Before, 480e6);
    }

    function test_redeem_snapshot_consistency() public {
        vm.prank(lp1); usdc.approve(address(vault), 600e6);
        vm.prank(lp1); vault.deposit(600e6);
        vm.prank(lp2); usdc.approve(address(vault), 400e6);
        vm.prank(lp2); vault.deposit(400e6);

        usdc.mint(address(vault), 300e6);

        vm.warp(maturity + 1);

        // lp1 redeems first (triggers snapshot): (1000+300)*600/1000 = 780
        uint256 lp1Before = usdc.balanceOf(lp1);
        vm.prank(lp1); vault.redeem();
        assertEq(usdc.balanceOf(lp1) - lp1Before, 780e6);

        // lp2 uses same snapshot: (1000+300)*400/1000 = 520
        uint256 lp2Before = usdc.balanceOf(lp2);
        vm.prank(lp2); vault.redeem();
        assertEq(usdc.balanceOf(lp2) - lp2Before, 520e6);
    }

    function test_redeem_fails_before_maturity() public {
        vm.prank(lp1); usdc.approve(address(vault), 500e6);
        vm.prank(lp1); vault.deposit(500e6);

        vm.expectRevert(AgentVault.VaultNotMatured.selector);
        vm.prank(lp1); vault.redeem();
    }

    function test_redeem_double_redeem_fails() public {
        vm.prank(lp1); usdc.approve(address(vault), 500e6);
        vm.prank(lp1); vault.deposit(500e6);

        usdc.mint(address(vault), 100e6);

        vm.warp(maturity + 1);
        vm.prank(lp1); vault.redeem();

        vm.expectRevert(AgentVault.AlreadyRedeemed.selector);
        vm.prank(lp1); vault.redeem();
    }

    function test_redeem_no_revenue() public {
        vm.prank(lp1); usdc.approve(address(vault), 500e6);
        vm.prank(lp1); vault.deposit(500e6);

        vm.warp(maturity + 1);

        uint256 before = usdc.balanceOf(lp1);
        vm.prank(lp1); vault.redeem();
        // No revenue → gets back exactly principal
        assertEq(usdc.balanceOf(lp1) - before, 500e6);
    }

    // ─────────────────────────────────────────── preview ──

    function test_preview_redeem() public {
        vm.prank(lp1); usdc.approve(address(vault), 500e6);
        vm.prank(lp1); vault.deposit(500e6);

        usdc.mint(address(vault), 100e6);

        // lp1 owns 100% → 600
        assertEq(vault.previewRedeem(lp1), 600e6);
    }

    // ─────────────────────────────────────────── subscription ──

    function test_subscription_flow() public {
        vm.prank(operator);
        uint256 planId = subPayment.createPlan(agentId, 10e6, 30 days);

        vm.startPrank(user);
        usdc.approve(address(subPayment), 10e6);
        subPayment.subscribe(agentId, planId);
        vm.stopPrank();

        // Vault received USDC directly
        assertEq(usdc.balanceOf(address(vault)), 10e6);
        assertTrue(subPayment.isSubscribed(agentId, user));
    }

    function test_subscription_renewal() public {
        vm.prank(operator);
        uint256 planId = subPayment.createPlan(agentId, 10e6, 30 days);

        vm.startPrank(user);
        usdc.approve(address(subPayment), 20e6);
        subPayment.subscribe(agentId, planId);
        subPayment.subscribe(agentId, planId);
        vm.stopPrank();

        uint256 expiry = subPayment.subscriptionExpiry(agentId, user);
        assertApproxEqAbs(expiry, block.timestamp + 60 days, 2);
        assertEq(usdc.balanceOf(address(vault)), 20e6);
    }

    // ─────────────────────────────────────────── bond ──

    function test_post_bond() public {
        vm.startPrank(operator);
        usdc.approve(address(registry), 500e6);
        registry.postBond(agentId, 500e6);
        vm.stopPrank();

        assertEq(registry.getAgent(agentId).bondAmount, 500e6);
        assertEq(usdc.balanceOf(address(registry)), 500e6);
    }

    function test_withdraw_bond_after_maturity() public {
        vm.startPrank(operator);
        usdc.approve(address(registry), 500e6);
        registry.postBond(agentId, 500e6);
        vm.stopPrank();

        vm.warp(maturity + 1);

        uint256 before = usdc.balanceOf(operator);
        vm.prank(operator);
        registry.withdrawBond(agentId);

        assertEq(usdc.balanceOf(operator) - before, 500e6);
        assertEq(registry.getAgent(agentId).bondAmount, 0);
    }

    function test_withdraw_bond_fails_before_maturity() public {
        vm.startPrank(operator);
        usdc.approve(address(registry), 500e6);
        registry.postBond(agentId, 500e6);
        vm.stopPrank();

        vm.expectRevert(AgentRegistry.VaultNotMatured.selector);
        vm.prank(operator);
        registry.withdrawBond(agentId);
    }

    // ─────────────────────────────────────────── share price model ──

    function test_share_price_fairness() public {
        // LP1 deposits first, then revenue arrives, then LP2 deposits late.
        // LP1 should earn more yield because they took on earlier risk.

        // LP1: 600 USDC → 600e6 shares (initial 1:1)
        vm.prank(lp1); usdc.approve(address(vault), 600e6);
        vm.prank(lp1); vault.deposit(600e6);
        assertEq(vault.shares(lp1), 600e6);

        // 100 USDC revenue arrives (x402 payTo = vault)
        usdc.mint(address(vault), 100e6);
        // balance = 700, totalShares = 600 → share price = 700/600 ≈ 1.1667

        // LP2: 400 USDC → 400e6 * 600e6 / 700e6 ≈ 342.857e6 shares
        vm.prank(lp2); usdc.approve(address(vault), 400e6);
        vm.prank(lp2); vault.deposit(400e6);
        uint256 lp2Shares = vault.shares(lp2);
        assertApproxEqAbs(lp2Shares, 342_857_142, 10);

        // 100 more USDC revenue
        usdc.mint(address(vault), 100e6);
        // balance = 1200, totalShares ≈ 942.857e6

        vm.warp(maturity + 1);

        uint256 lp1Before = usdc.balanceOf(lp1);
        uint256 lp2Before = usdc.balanceOf(lp2);
        vm.prank(lp1); vault.redeem();
        vm.prank(lp2); vault.redeem();

        uint256 lp1Payout = usdc.balanceOf(lp1) - lp1Before;
        uint256 lp2Payout = usdc.balanceOf(lp2) - lp2Before;

        // LP1 deposited $600, should get more than 20% yield (early risk)
        // LP2 deposited $400, should get less than 20% yield (late entry)
        assertGt(lp1Payout, 720e6); // more than naive pro-rata ($720)
        assertLt(lp2Payout, 480e6); // less than naive pro-rata ($480)
        assertApproxEqAbs(lp1Payout + lp2Payout, 1200e6, 10); // sum = total
    }

    function test_deposited_amount_tracked() public {
        vm.prank(lp1); usdc.approve(address(vault), 600e6);
        vm.prank(lp1); vault.deposit(600e6);
        assertEq(vault.depositedAmount(lp1), 600e6);

        // LP1 deposits again
        vm.prank(lp1); usdc.approve(address(vault), 200e6);
        vm.prank(lp1); vault.deposit(200e6);
        assertEq(vault.depositedAmount(lp1), 800e6);
    }

    function test_share_price_initial_is_one() public {
        assertEq(vault.sharePrice(), 1e6); // $1.00 before any deposits
        vm.prank(lp1); usdc.approve(address(vault), 500e6);
        vm.prank(lp1); vault.deposit(500e6);
        assertEq(vault.sharePrice(), 1e6); // still $1.00 after first deposit (no revenue)
    }

    function test_share_price_rises_with_revenue() public {
        vm.prank(lp1); usdc.approve(address(vault), 1000e6);
        vm.prank(lp1); vault.deposit(1000e6);
        usdc.mint(address(vault), 100e6); // 10% revenue
        // price = 1100e6 / 1000e6 * 1e6 = 1_100_000 → $1.10
        assertEq(vault.sharePrice(), 1_100_000);
    }

    function test_post_bond_non_operator_fails() public {
        vm.startPrank(lp1);
        usdc.approve(address(registry), 500e6);
        vm.expectRevert(AgentRegistry.NotOperator.selector);
        registry.postBond(agentId, 500e6);
        vm.stopPrank();
    }
}

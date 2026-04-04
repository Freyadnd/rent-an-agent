// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @title AgentVault
/// @notice Share-price model: later LPs pay a higher price per share, so early
///         depositors earn a larger portion of revenue generated before they joined.
///         Revenue enters directly via x402 payTo or subscription transfer (trustless).
contract AgentVault {
    // ─────────────────────────────────────────────────────────── state ──

    IERC20 public immutable usdc;

    address public immutable operator;
    address public immutable agent;      // OWS wallet (metadata)

    uint256 public immutable maturity;
    uint256 public immutable fundingGoal;

    mapping(address => uint256) public shares;          // share units per LP
    mapping(address => uint256) public depositedAmount; // USDC deposited per LP
    uint256 public totalShares;
    uint256 public totalDeposited;

    // Snapshot of full vault balance taken at first redemption.
    // All subsequent redeems use the same snapshot to prevent race conditions.
    uint256 public balanceSnapshot;
    bool    public snapshotTaken;

    mapping(address => bool) public redeemed;
    bool public vaultClosed;

    // ─────────────────────────────────────────────────────────── events ──

    event Deposited(address indexed lp, uint256 amount, uint256 sharesIssued);
    event Redeemed(address indexed lp, uint256 principal, uint256 yield);

    // ─────────────────────────────────────────────────────────── errors ──

    error FundingGoalReached();
    error VaultNotOpen();
    error VaultNotMatured();
    error VaultAlreadyClosed();
    error AlreadyRedeemed();
    error NoShares();
    error ZeroAmount();

    // ──────────────────────────────────────────────────────── constructor ──

    constructor(
        address _usdc,
        address _operator,
        address _agent,
        uint256 _maturity,
        uint256 _fundingGoal
    ) {
        usdc        = IERC20(_usdc);
        operator    = _operator;
        agent       = _agent;
        maturity    = _maturity;
        fundingGoal = _fundingGoal;
    }

    // ──────────────────────────────────────────────────── LP: deposit ──

    /// @notice LP deposits USDC, receiving shares at the current share price.
    ///         If revenue has already accrued, the share price is higher, so late
    ///         depositors receive fewer shares per dollar — rewarding early LPs.
    function deposit(uint256 amount) external {
        if (block.timestamp >= maturity) revert VaultNotOpen();
        if (vaultClosed) revert VaultAlreadyClosed();
        if (amount == 0) revert ZeroAmount();

        uint256 remaining = fundingGoal - totalDeposited;
        if (remaining == 0) revert FundingGoalReached();

        uint256 accepted = amount > remaining ? remaining : amount;

        // Capture balance BEFORE transfer to compute share price correctly.
        uint256 balanceBefore = usdc.balanceOf(address(this));
        usdc.transferFrom(msg.sender, address(this), accepted);

        // Share price model:
        //   First deposit → 1:1 (price = 1 USDC)
        //   Later deposits → shares = accepted * totalShares / balanceBefore
        uint256 sharesToMint = (totalShares == 0)
            ? accepted
            : (accepted * totalShares) / balanceBefore;

        shares[msg.sender]          += sharesToMint;
        totalShares                 += sharesToMint;
        totalDeposited              += accepted;
        depositedAmount[msg.sender] += accepted;

        if (totalDeposited == fundingGoal) vaultClosed = true;

        emit Deposited(msg.sender, accepted, sharesToMint);
    }

    // ──────────────────────────────────────────────────── LP: redeem ──

    /// @notice At maturity, LP redeems shares at the final vault value.
    ///         First call snapshots the balance; all subsequent calls use the same snapshot.
    function redeem() external {
        if (block.timestamp < maturity) revert VaultNotMatured();
        if (redeemed[msg.sender]) revert AlreadyRedeemed();

        uint256 lpShares = shares[msg.sender];
        if (lpShares == 0) revert NoShares();

        if (!snapshotTaken) {
            balanceSnapshot = usdc.balanceOf(address(this));
            snapshotTaken   = true;
        }

        redeemed[msg.sender] = true;

        uint256 payout    = (balanceSnapshot * lpShares) / totalShares;
        uint256 principal = depositedAmount[msg.sender];
        uint256 yield_    = payout > principal ? payout - principal : 0;

        usdc.transfer(msg.sender, payout);
        emit Redeemed(msg.sender, principal, yield_);
    }

    // ──────────────────────────────────────────────────── view ──

    /// @notice Estimated payout for an LP at current vault value.
    function previewRedeem(address lp) external view returns (uint256) {
        uint256 lpShares = shares[lp];
        if (lpShares == 0 || totalShares == 0) return 0;
        uint256 bal = snapshotTaken ? balanceSnapshot : usdc.balanceOf(address(this));
        return (bal * lpShares) / totalShares;
    }

    /// @notice Current share price in USDC, scaled by 1e6.
    ///         e.g. 1_050_000 = $1.05 per share.
    function sharePrice() external view returns (uint256) {
        if (totalShares == 0) return 1e6; // initial price: $1.00
        uint256 bal = usdc.balanceOf(address(this));
        return (bal * 1e6) / totalShares;
    }

    /// @notice Vault status snapshot.
    function status() external view returns (
        uint256 deposited,
        uint256 revenue,
        uint256 shares_,
        uint256 timeLeft,
        bool    matured
    ) {
        deposited = totalDeposited;
        uint256 bal = snapshotTaken ? balanceSnapshot : usdc.balanceOf(address(this));
        revenue     = bal > totalDeposited ? bal - totalDeposited : 0;
        shares_     = totalShares;
        timeLeft    = block.timestamp >= maturity ? 0 : maturity - block.timestamp;
        matured     = block.timestamp >= maturity;
    }
}

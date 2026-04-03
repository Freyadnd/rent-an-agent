// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @title AgentVault
/// @notice LP 存入 USDC，agent 运行期间产生的收益汇入，到期按份额比例赎回。
///         每个 agent 对应一个 vault 实例，由 AgentRegistry 部署。
contract AgentVault {
    // ─────────────────────────────────────────────────────────── state ──

    IERC20 public immutable usdc;

    address public immutable operator;   // agent 运营方，负责提取启动资金
    address public immutable registry;   // AgentRegistry，唯一有权注册 sweeper 的地址
    address public immutable agent;      // agent 唯一标识（OWS 钱包地址）

    uint256 public immutable maturity;   // 到期时间戳
    uint256 public immutable fundingGoal; // LP 募资上限（USDC，6 decimals）

    // 认购阶段：LP 份额
    mapping(address => uint256) public shares;
    uint256 public totalShares;
    uint256 public totalDeposited;

    // 收益
    uint256 public totalRevenue;

    // sweeper：被授权将 agent 钱包收益打入 vault 的地址
    address public sweeper;

    // 其他授权收益来源（如 SubscriptionPayment 合约）
    mapping(address => bool) public authorizedSources;

    // 运营方已提取的启动资金
    bool public capitalWithdrawn;

    // 赎回记录
    mapping(address => bool) public redeemed;

    bool public vaultClosed; // 到期后设为 true，停止新存款

    // ─────────────────────────────────────────────────────────── events ──

    event Deposited(address indexed lp, uint256 amount, uint256 sharesIssued);
    event RevenueReceived(address indexed from, uint256 amount, string source);
    event Redeemed(address indexed lp, uint256 principal, uint256 yield);
    event CapitalWithdrawn(address indexed operator, uint256 amount);
    event SweeperSet(address indexed sweeper);
    event SourceAuthorized(address indexed source, bool authorized);

    // ─────────────────────────────────────────────────────────── errors ──

    error NotRegistry();
    error NotSweeper();
    error NotOperator();
    error FundingGoalReached();
    error VaultNotOpen();
    error VaultNotMatured();
    error VaultAlreadyClosed();
    error AlreadyRedeemed();
    error NoShares();
    error CapitalAlreadyWithdrawn();
    error ZeroAmount();

    // ──────────────────────────────────────────────────────── constructor ──

    constructor(
        address _usdc,
        address _operator,
        address _registry,
        address _agent,
        uint256 _maturity,
        uint256 _fundingGoal
    ) {
        usdc = IERC20(_usdc);
        operator = _operator;
        registry = _registry;
        agent = _agent;
        maturity = _maturity;
        fundingGoal = _fundingGoal;
    }

    // ──────────────────────────────────────────────────── LP: deposit ──

    /// @notice LP 存入 USDC，按存款比例获得份额。
    ///         募资期间（maturity 前）有效，达到 fundingGoal 后关闭。
    function deposit(uint256 amount) external {
        if (block.timestamp >= maturity) revert VaultNotOpen();
        if (vaultClosed) revert VaultAlreadyClosed();
        if (amount == 0) revert ZeroAmount();

        uint256 remaining = fundingGoal - totalDeposited;
        if (remaining == 0) revert FundingGoalReached();

        // 超出上限则只接受剩余部分
        uint256 accepted = amount > remaining ? remaining : amount;

        usdc.transferFrom(msg.sender, address(this), accepted);

        shares[msg.sender] += accepted;
        totalShares += accepted;
        totalDeposited += accepted;

        if (totalDeposited == fundingGoal) vaultClosed = true;

        emit Deposited(msg.sender, accepted, accepted);
    }

    // ─────────────────────────────────────────── operator: withdraw capital ──

    /// @notice 运营方在募资结束后提取启动资金，用于运行 agent。
    function withdrawCapital() external {
        if (msg.sender != operator) revert NotOperator();
        if (capitalWithdrawn) revert CapitalAlreadyWithdrawn();
        // 募资期结束或募满才可提取
        if (block.timestamp < maturity && !vaultClosed) revert VaultNotOpen();

        capitalWithdrawn = true;
        uint256 amount = totalDeposited;
        usdc.transfer(operator, amount);

        emit CapitalWithdrawn(operator, amount);
    }

    // ─────────────────────────────────────────── revenue: receive ──

    /// @notice Sweeper 将 agent 钱包中的收益打入 vault。
    /// @param source 收益来源标签，如 "x402" / "subscription" / "tx_fee"
    function receiveRevenue(uint256 amount, string calldata source) external {
        if (msg.sender != sweeper && !authorizedSources[msg.sender]) revert NotSweeper();
        if (amount == 0) revert ZeroAmount();

        usdc.transferFrom(msg.sender, address(this), amount);
        totalRevenue += amount;

        emit RevenueReceived(msg.sender, amount, source);
    }

    // ──────────────────────────────────────────────────── LP: redeem ──

    /// @notice 到期后 LP 按份额赎回 principal + 收益。
    function redeem() external {
        if (block.timestamp < maturity) revert VaultNotMatured();
        if (redeemed[msg.sender]) revert AlreadyRedeemed();

        uint256 lpShares = shares[msg.sender];
        if (lpShares == 0) revert NoShares();

        redeemed[msg.sender] = true;

        // pro-rata: lpShares / totalShares * (totalDeposited + totalRevenue)
        uint256 totalPool = totalDeposited + totalRevenue;
        uint256 payout = (totalPool * lpShares) / totalShares;

        // 拆分 principal 和 yield 用于事件记录
        uint256 principal = (totalDeposited * lpShares) / totalShares;
        uint256 yield_ = payout - principal;

        usdc.transfer(msg.sender, payout);

        emit Redeemed(msg.sender, principal, yield_);
    }

    // ──────────────────────────────────────────────── admin ──

    /// @notice 由 registry 设置 sweeper 地址（部署后可更新）。
    function setSweeper(address _sweeper) external {
        if (msg.sender != registry) revert NotRegistry();
        sweeper = _sweeper;
        emit SweeperSet(_sweeper);
    }

    /// @notice 由 registry 授权/撤销收益来源（如 SubscriptionPayment 合约）。
    function setAuthorizedSource(address source, bool authorized) external {
        if (msg.sender != registry) revert NotRegistry();
        authorizedSources[source] = authorized;
        emit SourceAuthorized(source, authorized);
    }

    // ──────────────────────────────────────────────── view ──

    /// @notice 查看某 LP 到期后可赎回的预估金额。
    function previewRedeem(address lp) external view returns (uint256 payout) {
        uint256 lpShares = shares[lp];
        if (lpShares == 0 || totalShares == 0) return 0;
        uint256 totalPool = totalDeposited + totalRevenue;
        payout = (totalPool * lpShares) / totalShares;
    }

    /// @notice vault 当前状态快照。
    function status() external view returns (
        uint256 deposited,
        uint256 revenue,
        uint256 shares_,
        uint256 timeLeft,
        bool matured
    ) {
        deposited = totalDeposited;
        revenue = totalRevenue;
        shares_ = totalShares;
        timeLeft = block.timestamp >= maturity ? 0 : maturity - block.timestamp;
        matured = block.timestamp >= maturity;
    }
}

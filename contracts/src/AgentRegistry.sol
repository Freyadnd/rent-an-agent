// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentVault} from "./AgentVault.sol";

/// @title AgentRegistry
/// @notice 注册 agent，为每个 agent 部署一个 AgentVault。
///         记录 agent 的 OWS 钱包地址、AWS endpoint、运营方等元数据。
contract AgentRegistry {
    // ─────────────────────────────────────────────────────────── types ──

    /// @dev revenueTypes bitmask:
    ///   bit 0 (0x01) = x402 pay-per-use
    ///   bit 1 (0x02) = Subscription
    ///   bit 2 (0x04) = Trading / on-chain tx fees
    struct AgentInfo {
        address operator;       // agent 运营方
        address owsWallet;      // OWS 钱包地址（用于 sweeper 识别来源）
        address vault;          // 对应的 AgentVault
        string  name;           // agent 名称
        string  endpoint;       // AWS API endpoint
        string  description;
        uint8   revenueTypes;   // bitmask of revenue sources
        uint256 registeredAt;
    }

    // ─────────────────────────────────────────────────────────── state ──

    address public immutable usdc;
    address public owner;

    // agentId => AgentInfo
    mapping(uint256 => AgentInfo) public agents;
    uint256 public agentCount;

    // owsWallet => agentId（快速查找）
    mapping(address => uint256) public walletToAgent;

    // ─────────────────────────────────────────────────────────── events ──

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed operator,
        address indexed vault,
        address owsWallet,
        string name
    );
    event SweeperUpdated(uint256 indexed agentId, address sweeper);
    event EndpointUpdated(uint256 indexed agentId, string endpoint);

    // ─────────────────────────────────────────────────────────── errors ──

    error NotOwner();
    error NotOperator();
    error ZeroAddress();
    error InvalidMaturity();
    error InvalidFundingGoal();

    // ──────────────────────────────────────────────────────── constructor ──

    constructor(address _usdc) {
        usdc = _usdc;
        owner = msg.sender;
    }

    // ──────────────────────────────────────────────────── register ──

    /// @notice 运营方注册一个新 agent，自动部署对应的 AgentVault。
    /// @param owsWallet    agent 的 OWS 钱包地址
    /// @param name         agent 名称
    /// @param endpoint     AWS API endpoint（供 LP 了解 agent）
    /// @param description  简介
    /// @param maturity     vault 到期时间戳
    /// @param fundingGoal  募资上限（USDC，6 decimals）
    /// @param sweeper       初始 sweeper 地址（可以是运营方控制的后端钱包）
    /// @param revenueTypes  收益来源位掩码 (0x01=x402, 0x02=subscription, 0x04=trading)
    function registerAgent(
        address owsWallet,
        string calldata name,
        string calldata endpoint,
        string calldata description,
        uint256 maturity,
        uint256 fundingGoal,
        address sweeper,
        uint8   revenueTypes
    ) external returns (uint256 agentId, address vault) {
        if (owsWallet == address(0)) revert ZeroAddress();
        if (maturity <= block.timestamp) revert InvalidMaturity();
        if (fundingGoal == 0) revert InvalidFundingGoal();

        agentId = ++agentCount;

        // 部署 vault
        AgentVault v = new AgentVault(
            usdc,
            msg.sender,  // operator
            address(this),
            owsWallet,
            maturity,
            fundingGoal
        );
        vault = address(v);

        // 设置 sweeper
        if (sweeper != address(0)) {
            v.setSweeper(sweeper);
        }

        agents[agentId] = AgentInfo({
            operator:     msg.sender,
            owsWallet:    owsWallet,
            vault:        vault,
            name:         name,
            endpoint:     endpoint,
            description:  description,
            revenueTypes: revenueTypes,
            registeredAt: block.timestamp
        });

        walletToAgent[owsWallet] = agentId;

        emit AgentRegistered(agentId, msg.sender, vault, owsWallet, name);
    }

    // ──────────────────────────────────────────────── operator actions ──

    /// @notice 运营方更新 sweeper 地址（如更换后端钱包）。
    function setSweeper(uint256 agentId, address sweeper) external {
        AgentInfo storage info = agents[agentId];
        if (msg.sender != info.operator) revert NotOperator();

        AgentVault(info.vault).setSweeper(sweeper);
        emit SweeperUpdated(agentId, sweeper);
    }

    /// @notice 运营方授权/撤销收益来源（如 SubscriptionPayment 合约地址）。
    function setAuthorizedSource(uint256 agentId, address source, bool authorized) external {
        AgentInfo storage info = agents[agentId];
        if (msg.sender != info.operator) revert NotOperator();
        AgentVault(info.vault).setAuthorizedSource(source, authorized);
    }

    /// @notice 运营方更新 AWS endpoint。
    function updateEndpoint(uint256 agentId, string calldata endpoint) external {
        AgentInfo storage info = agents[agentId];
        if (msg.sender != info.operator) revert NotOperator();
        info.endpoint = endpoint;
        emit EndpointUpdated(agentId, endpoint);
    }

    // ──────────────────────────────────────────────── view ──

    function getAgent(uint256 agentId) external view returns (AgentInfo memory) {
        return agents[agentId];
    }

    function getAgentByWallet(address owsWallet) external view returns (AgentInfo memory) {
        return agents[walletToAgent[owsWallet]];
    }

    /// @notice 返回所有 agent 列表（分页）。
    function listAgents(uint256 offset, uint256 limit)
        external
        view
        returns (AgentInfo[] memory result)
    {
        uint256 total = agentCount;
        if (offset >= total) return result;

        uint256 end = offset + limit;
        if (end > total) end = total;

        result = new AgentInfo[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = agents[i + 1]; // agentId starts at 1
        }
    }
}

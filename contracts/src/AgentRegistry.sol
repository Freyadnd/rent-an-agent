// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentVault} from "./AgentVault.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @title AgentRegistry
/// @notice 注册 agent，为每个 agent 部署一个 AgentVault。
///         trading 类 agent 可质押 USDC bond，供 LP 参考信任等级。
contract AgentRegistry {
    // ─────────────────────────────────────────────────────────── types ──

    /// @dev revenueTypes bitmask:
    ///   bit 0 (0x01) = x402 pay-per-use  → trustless (payTo = vault)
    ///   bit 1 (0x02) = Subscription      → trustless (contract routes directly)
    ///   bit 2 (0x04) = Trading / on-chain → trusted   (operator sweeps manually; bond recommended)
    struct AgentInfo {
        address operator;
        address owsWallet;
        address vault;
        string  name;
        string  endpoint;
        string  description;
        uint8   revenueTypes;
        uint256 registeredAt;
        uint256 bondAmount;   // USDC held by registry as operator bond
    }

    // ─────────────────────────────────────────────────────────── state ──

    address public immutable usdc;
    address public owner;

    mapping(uint256 => AgentInfo) public agents;
    uint256 public agentCount;

    mapping(address => uint256) public walletToAgent;

    // ─────────────────────────────────────────────────────────── events ──

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed operator,
        address indexed vault,
        address owsWallet,
        string  name
    );
    event EndpointUpdated(uint256 indexed agentId, string endpoint);
    event BondPosted(uint256 indexed agentId, address indexed operator, uint256 amount);
    event BondWithdrawn(uint256 indexed agentId, address indexed operator, uint256 amount);

    // ─────────────────────────────────────────────────────────── errors ──

    error NotOwner();
    error NotOperator();
    error ZeroAddress();
    error InvalidMaturity();
    error InvalidFundingGoal();
    error VaultNotMatured();
    error ZeroAmount();
    error NoBond();

    // ──────────────────────────────────────────────────────── constructor ──

    constructor(address _usdc) {
        usdc  = _usdc;
        owner = msg.sender;
    }

    // ──────────────────────────────────────────────────── register ──

    /// @notice 运营方注册一个新 agent，自动部署对应的 AgentVault。
    function registerAgent(
        address owsWallet,
        string calldata name,
        string calldata endpoint,
        string calldata description,
        uint256 maturity,
        uint256 fundingGoal,
        uint8   revenueTypes
    ) external returns (uint256 agentId, address vault) {
        if (owsWallet == address(0)) revert ZeroAddress();
        if (maturity <= block.timestamp) revert InvalidMaturity();
        if (fundingGoal == 0) revert InvalidFundingGoal();

        agentId = ++agentCount;

        AgentVault v = new AgentVault(
            usdc,
            msg.sender,   // operator
            owsWallet,
            maturity,
            fundingGoal
        );
        vault = address(v);

        agents[agentId] = AgentInfo({
            operator:     msg.sender,
            owsWallet:    owsWallet,
            vault:        vault,
            name:         name,
            endpoint:     endpoint,
            description:  description,
            revenueTypes: revenueTypes,
            registeredAt: block.timestamp,
            bondAmount:   0
        });

        walletToAgent[owsWallet] = agentId;

        emit AgentRegistered(agentId, msg.sender, vault, owsWallet, name);
    }

    // ──────────────────────────────────────────────── bond ──

    /// @notice 运营方为 trading agent 质押 USDC bond，增强 LP 信任。
    function postBond(uint256 agentId, uint256 amount) external {
        AgentInfo storage info = agents[agentId];
        if (msg.sender != info.operator) revert NotOperator();
        if (amount == 0) revert ZeroAmount();

        IERC20(usdc).transferFrom(msg.sender, address(this), amount);
        info.bondAmount += amount;

        emit BondPosted(agentId, msg.sender, amount);
    }

    /// @notice vault 到期后运营方取回 bond。
    function withdrawBond(uint256 agentId) external {
        AgentInfo storage info = agents[agentId];
        if (msg.sender != info.operator) revert NotOperator();
        if (info.bondAmount == 0) revert NoBond();
        if (block.timestamp < AgentVault(info.vault).maturity()) revert VaultNotMatured();

        uint256 amount = info.bondAmount;
        info.bondAmount = 0;
        IERC20(usdc).transfer(msg.sender, amount);

        emit BondWithdrawn(agentId, msg.sender, amount);
    }

    // ──────────────────────────────────────────────── operator actions ──

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
            result[i - offset] = agents[i + 1];
        }
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {AgentRegistry} from "./AgentRegistry.sol";

/// @title SubscriptionPayment
/// @notice 用户付 USDC 订阅某 agent 的 API，费用直接转入对应 AgentVault。
///         trustless：USDC 直接 transfer 到 vault，无中间步骤。
contract SubscriptionPayment {
    // ─────────────────────────────────────────────────────────── types ──

    struct Plan {
        uint256 price;    // USDC per period (6 decimals)
        uint256 duration; // 订阅时长（秒），0 = 按次付费
        bool    active;
    }

    // ─────────────────────────────────────────────────────────── state ──

    IERC20 public immutable usdc;
    AgentRegistry public immutable registry;

    mapping(uint256 => mapping(uint256 => Plan)) public plans;
    mapping(uint256 => uint256) public planCount;

    // agentId => user => expiry timestamp（0 = 未订阅）
    mapping(uint256 => mapping(address => uint256)) public subscriptions;

    // ─────────────────────────────────────────────────────────── events ──

    event PlanCreated(uint256 indexed agentId, uint256 indexed planId, uint256 price, uint256 duration);
    event Subscribed(uint256 indexed agentId, address indexed user, uint256 planId, uint256 expiry, uint256 amount);
    event PayPerUse(uint256 indexed agentId, address indexed user, uint256 planId, uint256 amount);

    // ─────────────────────────────────────────────────────────── errors ──

    error NotOperator();
    error PlanNotActive();
    error AgentNotFound();
    error ZeroPrice();

    // ──────────────────────────────────────────────────────── constructor ──

    constructor(address _usdc, address _registry) {
        usdc     = IERC20(_usdc);
        registry = AgentRegistry(_registry);
    }

    // ──────────────────────────────────────────────── operator: create plan ──

    function createPlan(uint256 agentId, uint256 price, uint256 duration) external returns (uint256 planId) {
        AgentRegistry.AgentInfo memory info = registry.getAgent(agentId);
        if (msg.sender != info.operator) revert NotOperator();
        if (price == 0) revert ZeroPrice();

        planId = ++planCount[agentId];
        plans[agentId][planId] = Plan({price: price, duration: duration, active: true});

        emit PlanCreated(agentId, planId, price, duration);
    }

    function deactivatePlan(uint256 agentId, uint256 planId) external {
        AgentRegistry.AgentInfo memory info = registry.getAgent(agentId);
        if (msg.sender != info.operator) revert NotOperator();
        plans[agentId][planId].active = false;
    }

    // ──────────────────────────────────────────────── user: subscribe ──

    /// @notice 用户订阅 agent。USDC 直接转入 vault（trustless）。
    function subscribe(uint256 agentId, uint256 planId) external {
        Plan memory plan = plans[agentId][planId];
        if (!plan.active) revert PlanNotActive();

        AgentRegistry.AgentInfo memory info = registry.getAgent(agentId);
        if (info.vault == address(0)) revert AgentNotFound();

        // 直接转入 vault，无需中间合约授权
        usdc.transferFrom(msg.sender, info.vault, plan.price);

        if (plan.duration > 0) {
            uint256 current = subscriptions[agentId][msg.sender];
            uint256 base    = current > block.timestamp ? current : block.timestamp;
            uint256 expiry  = base + plan.duration;
            subscriptions[agentId][msg.sender] = expiry;

            emit Subscribed(agentId, msg.sender, planId, expiry, plan.price);
        } else {
            emit PayPerUse(agentId, msg.sender, planId, plan.price);
        }
    }

    // ──────────────────────────────────────────────── view ──

    function isSubscribed(uint256 agentId, address user) external view returns (bool) {
        return subscriptions[agentId][user] > block.timestamp;
    }

    function subscriptionExpiry(uint256 agentId, address user) external view returns (uint256) {
        return subscriptions[agentId][user];
    }

    function getPlan(uint256 agentId, uint256 planId) external view returns (Plan memory) {
        return plans[agentId][planId];
    }
}

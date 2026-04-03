// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {AgentVault} from "./AgentVault.sol";
import {AgentRegistry} from "./AgentRegistry.sol";

/// @title SubscriptionPayment
/// @notice 用户付 USDC 订阅某 agent 的 API，费用直接进入对应 AgentVault。
///         支持按次付费和按月订阅两种模式。
contract SubscriptionPayment {
    // ─────────────────────────────────────────────────────────── types ──

    struct Plan {
        uint256 price;      // USDC per period (6 decimals)
        uint256 duration;   // 订阅时长（秒），0 = 按次付费
        bool    active;
    }

    // ─────────────────────────────────────────────────────────── state ──

    IERC20 public immutable usdc;
    AgentRegistry public immutable registry;

    // agentId => planId => Plan
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
        usdc = IERC20(_usdc);
        registry = AgentRegistry(_registry);
    }

    // ──────────────────────────────────────────────── operator: create plan ──

    /// @notice 运营方为 agent 创建订阅套餐。
    /// @param duration 订阅时长（秒）。设为 0 表示按次付费。
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

    /// @notice 用户订阅 agent。
    ///         若 duration > 0：续订时从当前 expiry 续期，未订阅时从 now 开始。
    ///         若 duration == 0：按次付费，不记录 expiry。
    function subscribe(uint256 agentId, uint256 planId) external {
        Plan memory plan = plans[agentId][planId];
        if (!plan.active) revert PlanNotActive();

        AgentRegistry.AgentInfo memory info = registry.getAgent(agentId);
        if (info.vault == address(0)) revert AgentNotFound();

        usdc.transferFrom(msg.sender, address(this), plan.price);

        // 把收益直接送入 vault
        usdc.approve(info.vault, plan.price);
        AgentVault(info.vault).receiveRevenue(plan.price, "subscription");

        if (plan.duration > 0) {
            // 按时间订阅：续期逻辑
            uint256 current = subscriptions[agentId][msg.sender];
            uint256 base = current > block.timestamp ? current : block.timestamp;
            uint256 expiry = base + plan.duration;
            subscriptions[agentId][msg.sender] = expiry;

            emit Subscribed(agentId, msg.sender, planId, expiry, plan.price);
        } else {
            // 按次付费：不记录 expiry
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

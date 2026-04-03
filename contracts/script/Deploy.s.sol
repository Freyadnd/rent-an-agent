// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {SubscriptionPayment} from "../src/SubscriptionPayment.sol";

// USDC on Base mainnet
address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
// USDC on Base Sepolia testnet
address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address usdc = block.chainid == 8453 ? USDC_BASE : USDC_BASE_SEPOLIA;

        vm.startBroadcast(deployerKey);

        AgentRegistry registry = new AgentRegistry(usdc);
        SubscriptionPayment subPayment = new SubscriptionPayment(usdc, address(registry));

        vm.stopBroadcast();

        console.log("=== Deployed ===");
        console.log("Chain ID:      ", block.chainid);
        console.log("USDC:          ", usdc);
        console.log("AgentRegistry: ", address(registry));
        console.log("SubscriptionPayment:", address(subPayment));
        console.log("");
        console.log("# Add to backend/.env:");
        console.log("REGISTRY_ADDRESS=", address(registry));
        console.log("SUBSCRIPTION_ADDRESS=", address(subPayment));
        console.log("USDC_ADDRESS=", usdc);
        console.log("");
        console.log("# Add to frontend/.env.local:");
        console.log("NEXT_PUBLIC_REGISTRY_ADDRESS=", address(registry));
        console.log("NEXT_PUBLIC_SUBSCRIPTION_ADDRESS=", address(subPayment));
    }
}

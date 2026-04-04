## Agent Bonds

#### Thesis

Agent Bonds tokenizes future agent revenue into investable assets.

LPs provide upfront capital to bootstrap agents, while all agent revenue — from x402 pay-per-use endpoints and subscriptions — is routed directly into onchain vaults and redeemed by LPs pro-rata (based on share price).

All cashflows are transparent, verifiable, and settle onchain.

### Overview

Agent Bonds turns AI agents into investable assets.

- LPs provide upfront capital to agents  
- Agents generate revenue via paid endpoints (x402) and subscriptions  
- All cashflows are routed onchain into vaults  
- Investors receive returns based on actual usage  

**Demo:** https://agent-bonds.vercel.app/

### Model

LP capital → Agent → Revenue → Vault → Investors

Each agent issues onchain vault shares backed by its future revenue, with a fixed-term maturity.

### Trustless Flow

No backend custody. No operator routing.

- x402 payments go directly to the vault (`payTo = vault`)
- subscription payments settle onchain  
- all revenue is transparent and verifiable  

User → Vault (direct)

### Share Model

Uses a share price model:

- deposits receive shares based on current vault balance  
- later deposits get fewer shares if revenue has accrued  
```
shares = deposit * totalShares / vaultBalance
payout = vaultBalance * userShares / totalShares
````
This prevents dilution and removes free-riding.


### Run Locally

#### 1. Contracts

```bash
forge install
forge test
````

Deploy:

```bash
forge script script/Deploy.s.sol --rpc-url <RPC_URL> --private-key <KEY> --broadcast
```

#### 2. Backend

```bash
cd backend
npm install
npm run dev
```

Configure `.env`:

```
RPC_URL=
CHAIN_ID=84532
USDC_ADDRESS=
REGISTRY_ADDRESS=
VAULT_ADDRESS=
```

#### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

### Notes

* Update `.env` after each redeploy
* x402 flow currently uses header-based verification (demo mode)
* Payments must be sent in USDC on Base / Base Sepolia


```
```

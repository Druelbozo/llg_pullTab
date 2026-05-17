# LLG Pull Tabs API Developer Onboarding Guide

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Authentication (IP Whitelist)](#authentication-ip-whitelist)
4. [Pull Tabs Data Model](#pull-tabs-data-model)
5. [Gameplay & RNG (Weighted Ticket Deal)](#gameplay--rng-weighted-ticket-deal)
6. [API Endpoints](#api-endpoints)
7. [Provider Session & Economy](#provider-session--economy)
8. [Refunds (`PullTabsRounds` & `/provider/refund`)](#refunds-pulltabsrounds--providerrefund)
9. [Seeding Dynamo from repo JSON](#seeding-dynamo-from-repo-json)
10. [Integration Examples](#integration-examples)
11. [Error Handling](#error-handling)
12. [Best Practices](#best-practices)
13. [Bonus free play (links hub)](bonus_free_play_hub.md) — milestone free rounds, session flags (`bonusFreePlayPending`, `hasBonus`, `isFreePlay`)
14. [Support](#support)

---

## Overview

The LLG Pull Tabs API exposes **server-side weighted ticket draws** and a **multi-row symbol grid** for Class II–style pull-tab experiences. Aggregators reuse the same **provider session** pattern as scratch cards (`POST /provider/startGame`): real-money rounds convert **economy minors** (`creditValueMinor`) to **operator wallet minors** for Novalink bet/win, persist a **`PullTabsRounds`** audit row keyed by **`operatorTransactionId`**, and support **Novalink refunds** via **`POST /provider/refund`** in Provider Gateway.

### Key Features

- **Finite ticket pool math**: Winning tickets plus **`losersInDeal`** form **`ticketPoolSize`**; each buy draws one **uniform ticket index**.
- **GLI‑style entropy**: **`get_random_bytes`** from **`shared.rng_utils`** feeds ticket selection and grid layout choices (see **`PullTabsService/pull_tabs_engine.py`**).
- **Dynamo-backed paytables**: Table **`pull-tabs-paytables`** (configurable via **`PULL_TABS_PAYTABLES_TABLE_NAME`**).
- **Per-buy round rows**: Dynamo **`PullTabsRounds-${Environment}`** mirrors scratch **`ScratchCardRounds`** for refunds and TTL cleanup.
- **Bonus milestones**: Same milestone / free-round semantics as scratch when **`gameMetadata.bonusCount`** is set (see **[Bonus free play](bonus_free_play_hub.md)**).

### Architecture

| Layer | Role |
|-------|------|
| **AWS Lambda** | **`PullTabsService`** — paytable APIs and `/buy` |
| **API Gateway** | Routes under **`/pull-tabs/...`** (see **`infrastructure/templates/api.yaml`**) |
| **DynamoDB** | **`pull-tabs-paytables`**, **`PullTabsRounds-*`** ([`storage.yaml](../../../infrastructure/templates/storage.yaml)) |
| **Provider Gateway** | **`POST /provider/refund`** resolves **`PullTabsRounds`** by **`externalId`** |

---

## Getting Started

### Prerequisites

1. **API endpoint** for your stack (staging / prod).
2. **`paytableId`** present in Dynamo **`pull-tabs-paytables`** with **`active: true`**.
3. **`POST /pull-tabs/buy`** and **`POST /pull-tabs/test/buy`** require addresses on the **provider IP whitelist** (same Dynamo-driven check as scratch).
4. For real money: **`POST /provider/startGame`** session with **`operatorSessionId`**, **`operatorUserId`**, **`currency`**, **`gameUuid`** / metadata as required by **`shared.operator_integration_utils`**.

### Quick Start

1. **Discover paytables**: `GET /pull-tabs/get-paytable-ids`
2. **Lobby math**: `POST /pull-tabs/get-paytable-info` with **`paytableId`** and **`creditValueMinor`**
3. **Deep config**: `GET /pull-tabs/get-paytable?paytableId=...`
4. **Open a provider session**: `POST /provider/startGame` (see **[provider_api_onboarding.md](provider_api_onboarding.md)**)
5. **Play**: `POST /pull-tabs/buy` with **`{ "sessionId": "<providerSessionId>" }`**
6. **Internal testing**: `POST /pull-tabs/test/buy` from a **whitelisted IP** with **`paytableId`** + **`creditValueMinor`**
7. **Postman**: **`Postman/LLG_Skillwars_API.*.postman_collection.json`** includes pull-tab requests and descriptions.
8. **Ops**: **[Seed or refresh Dynamo](#seeding-dynamo-from-repo-json)** from `backup/dynamodb/pull-tabs-paytables/*.json` when paytables change.

---

## Authentication (IP Whitelist)

### How It Works (Buy Paths)

Matches scratch / keno **`validate_provider_request_ip`** behavior:

| Endpoint | Provider IP whitelist | Notes |
|----------|------------------------|-------|
| `POST /pull-tabs/buy` | **Required** | Loads **`sessionId`**; **`paytableId`** and **`creditValueMinor`** from **`gameMetadata`** |
| `POST /pull-tabs/test/buy` | **Required** | Self-contained body; no provider session |

### Paytable Reads (Current Service Behavior)

**`PullTabsService` does not invoke the provider IP whitelist** on:

- **`GET /pull-tabs/get-paytable-ids`**
- **`POST /pull-tabs/get-paytable-info`**
- **`GET /pull-tabs/get-paytable`**

Treat these as **catalog reads** callable without session. Your deployed API Gateway may still apply additional restrictions; confirm per environment.

---

## Pull Tabs Data Model

### Table: `pull-tabs-paytables`

| Field | Type | Description |
|-------|------|-------------|
| **`paytableId`** | String | Primary key |
| **`active`** | Boolean | Must be true for **`/buy`** |
| **`style`** | String | Grouped in **`get-paytable-ids`** responses |
| **`rowCount`** | Integer | Number of horizontal rows revealed to the player |
| **`symbolsPerRow`** | Integer | **Must be `3`** in current parser |
| **`losersInDeal`** | Integer | Count of losing tickets in the finite pool (**non-negative**) |
| **`awardTiers`** | Array | Non-empty list of tiers (below) |
| **`rtp`** | Number | Stored RTP (optional transparency; echoed in **`get-paytable-info`**) |
| **`displayName`** / other attrs | Misc | Passed through **`get-paytable`** raw |

#### **`awardTiers[]` Elements**

| Field | Type | Rule |
|-------|------|------|
| **`tierId`** | String | Unique per tier, stable identifier |
| **`symbol`** | String | **Distinct** across tiers; tripled on the winning row when that tier wins |
| **`multiplier`** | Number | **`payoutMinor = int(multiplier × creditValueMinor)`** — must yield **positive** minors for buys using that **`creditValueMinor`** |
| **`ticketWinCount`** | Integer | **Positive**; count of winning tickets **for this tier** in the deal |

Derived at runtime (**`pull_tabs_paytable.py`**):

- **`totalWinningTickets`** = Σ **`ticketWinCount`**
- **`ticketPoolSize`** = **`totalWinningTickets`** + **`losersInDeal`** (must be **> 0**)

**`awardTiers` order matters:** `resolve_outcome_from_index` lays out **winning ticket indices in array order**—first tier consumes indices `0 … ticketWinCount-1`, the next tier continues, and so on, then **losers** occupy the tail. For authoring and `tier_01` / `symbol_01` naming, the repo seed uses **ascending `multiplier`**; when two tiers share the same multiplier, the one with **larger `ticketWinCount` is listed first** (so the densest slice of that multiplier gets the lowest indices). Full worked example: [`prize_poker_6288k_v0001.json`](../../../backup/dynamodb/pull-tabs-paytables/prize_poker_6288k_v0001.json) (**`tier_01`…`tier_07`** / **`symbol_01`…`symbol_07`**).

### Table: `PullTabsRounds-${Environment}`

Keyed by **`operatorTransactionId`** (same shape as **`ScratchCardRounds`** for refund helpers):

| Field | Purpose |
|-------|---------|
| **`operatorTransactionId`** | Dynamo hash key; **`externalId`** from Novalink maps here |
| **`llgSessionId`** | Provider session (**LLG **`sessionId`**) |
| **`betAmount`** | Wallet minors debited (real money paid round) |
| **`operatorBalanceAfterBet`** | Snapshot after bet for refund base |
| **`freePlay`** | When **true**, refund path credits **no** wager back (mirrors scratch) |
| **`operatorWinPosted`** | Blocks refund after win credited |
| **`TTL`** | Expiry |

---

## Gameplay & RNG (Weighted Ticket Deal)

1. **Draw**: Uniform **`ticketPoolIndex`** in **`[0, ticketPoolSize)`** using **`get_random_bytes`**-backed draws (**`play_pull_tab_round`**).
2. **Outcome**: Ticket index **`0`** is the start of the **first** **`awardTiers`** entry; each tier’s **`ticketWinCount`** consecutive indices belong to that tier (see **Data model**). Trailing indices are **losers**. Changing JSON tier **order** changes which index ranges map to which tier—**math (RTP, counts) stays the same** if tier definitions are unchanged.
3. **Probability field**: Response **`outcomeProbability`** = **`tier.ticketWinCount / ticketPoolSize`** for wins, else **`losersInDeal / ticketPoolSize`**.
4. **Grid**: **`rowCount`** rows × **`symbolsPerRow`** (**3**) symbols.
   - **Win**: Exactly **one** row shows **three copies** of **`outcomeSymbol`** and **`isWinRow: true`** (winning row position is random among rows).
   - **Loss**: Every row shows **three distinct** “junk” placeholders (**`__junk_##__`**); no award **`symbol`** appears three times (**`pull_tabs_engine.build_symbol_rows`**).

Clients typically **hide** junk tokens or substitute neutral art—**tier **`symbol`** values are the catalog-facing identifiers for wins.**

---

## API Endpoints

### `GET /pull-tabs/get-paytable-ids`

Returns active IDs grouped by **`style`**:

```json
{
  "paytablesByStyle": {
    "prize_poker": ["prize_poker_6288k_v0001"]
  },
  "totalCount": 1,
  "styleCount": 1
}
```

### `POST /pull-tabs/get-paytable-info`

**Body (required):** **`paytableId`**, **`creditValueMinor`** (integer).

**Returns:** Parsed **`rowCount`**, **`symbolsPerRow`**, **`ticketPoolSize`**, **`totalWinningTickets`**, **`losersInDeal`**, per-tier **`payoutMinor`**, **`rtp`** (nullable), **`awardTiers`** summary rows.

Use this path for lobby pricing at a concrete credit value.

### `GET /pull-tabs/get-paytable`

**Query:** **`paytableId`**

Returns the raw Dynamo item (decimals preserved where applicable).

### `POST /pull-tabs/buy` (provider)

**Body:**

```json
{ "sessionId": "<provider_session_uuid>" }
```

**Session `gameMetadata` (required / optional):**

| Field | Required | Notes |
|-------|----------|-------|
| **`paytableId`** | Yes | Must exist and **`active`** |
| **`creditValueMinor`** | Yes | Integer **> 0**; drives **`payoutMinor`** |
| **`rows`** | No | If set, **must equal** **`rowCount`** on paytable |
| **`symbolsPerRow`** | No | If set, must equal the paytable’s **`symbolsPerRow`** (**`3`** today) |
| **`bonusCount`** | No | Enables milestone **`hasBonus`** / **`isFreePlay`** (see hub doc) |

**Session root:**

- **`currency`** (and operator fields **`operatorSessionId`**, **`operatorUserId`** for real money).

**Successful response fields (subset):**

| Field | Description |
|-------|-------------|
| **`rows`** | Array of `{ "symbols": [...], "isWinRow": bool, … }` row objects |
| **`outcomeTierId`** / **`outcomeSymbol`** | Winner metadata (**`null`** on loss) |
| **`payoutMinor`** | Economy minors won (**integer**) |
| **`ticketPoolIndex`** | Drawn uniform index (**audit**) |
| **`outcomeProbability`** | Rational probability for messaging / QA |
| **`rngNonce`** | Hex from certified draw material |
| **`operatorTransactionId`**, **`operatorRoundId`**, **`operatorSpinId`**, **`operatorBalanceAfterBet`** | Operator linkage |
| **`playCount`** | When session **`playCount`** update succeeds |
| **`hasBonus`**, **`isFreePlay`** | Bonus milestone flags when applicable |

### `POST /pull-tabs/test/buy`

**Whitelist IP required.** Same buy math as **`/buy`**, **no** Dynamo session:

```json
{
  "paytableId": "prize_poker_6288k_v0001",
  "creditValueMinor": 25
}
```

Response matches **`/buy`** outcome shape **excluding** provider wallet fields (**no operator bet/win simulation**).

---

## Provider Session & Economy

Pull-tabs **`/buy`** mirrors scratch’s flow:

1. **`operator_ledger_amount_from_economy_minor`** (**`shared/economy_wallet_conversion.py`**) converts **`creditValueMinor`** to **wallet minors** using session **`currency`** and metadata.
2. **Free play**: consumes **`bonusFreePlayPending`** when configured; persists **`betAmount: 0`**, **`freePlay: true`** on **`PullTabsRounds`** in real mode.
3. Real money: **`call_operator_spin_bet`** then **`call_operator_spin_win`** when **`payoutMinor`** **> 0**; **`PullTabsRounds`** written after successful bet (**paid path**).

Insufficient balance returns **`INSUFFICIENT_FUNDS`** (session cache) vs operator **`OPERATOR_INSUFFICIENT_FUNDS`** variants—see **`PullTabsService/app.py`** for exact codes.

---

## Refunds (`PullTabsRounds` & `/provider/refund`)

Novalink refund callbacks hit **`POST /provider/refund`**. Provider Gateway looks up **`PullTabsRounds`** by **`externalId`** (same as **`operatorTransactionId`** on the round row) and runs the shared **`_refund_operator_round_record`** path ([`ProviderGatewayService/app.py`](../../../ProviderGatewayService/app.py)).

Behavior matches scratch (**`kind="pull_tabs"`**):

- **`freePlay: true`** (or **`betAmount` ≤ 0** handling): **`200`** with current balance — **no** wallet credit (**nothing to refund**).
- Paid rounds: restores **`betAmount`** to **`operatorBalanceAfterBet`** when valid and **`operatorWinPosted`** is absent.

Duplicate refund **`externalId`**: returns idempotent **`200`** per stored markers.

---

## Seeding Dynamo from repo JSON

Use **[`scripts/aws/sync_pull_tabs_paytables_from_backup.py`](../../../scripts/aws/sync_pull_tabs_paytables_from_backup.py)** to **`put_item`** JSON backups into **`pull-tabs-paytables`** (floats coerced to **`Decimal`**).

```bash
# Single file
python scripts/aws/sync_pull_tabs_paytables_from_backup.py \
  --json-file backup/dynamodb/pull-tabs-paytables/prize_poker_6288k_v0001.json

# All *.json in backup/dynamodb/pull-tabs-paytables/
python scripts/aws/sync_pull_tabs_paytables_from_backup.py --all
```

Optional: **`--table`**, **`--region`**, **`--profile`**. By default the table must **already exist** (e.g. CloudFormation); use **`--create-table-if-missing`** only for ad-hoc dev.

---

## Integration Examples

```bash
# List paytables by style
curl -sS -X GET "https://api.example.com/dev/pull-tabs/get-paytable-ids" \
  -H "Content-Type: application/json"

# Lobby payouts at a denomination
curl -sS -X POST "https://api.example.com/dev/pull-tabs/get-paytable-info" \
  -H "Content-Type: application/json" \
  -d '{"paytableId":"prize_poker_6288k_v0001","creditValueMinor":25}'

# Raw Dynamo row
curl -sS "https://api.example.com/dev/pull-tabs/get-paytable?paytableId=prize_poker_6288k_v0001" \
  -H "Content-Type: application/json"

# Provider purchase (whitelist IP — sessionId from startGame)
curl -sS -X POST "https://api.example.com/dev/pull-tabs/buy" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<SESSION_UUID>"}'

# Integration test purchase (whitelist IP)
curl -sS -X POST "https://api.example.com/dev/pull-tabs/test/buy" \
  -H "Content-Type: application/json" \
  -d '{"paytableId":"prize_poker_6288k_v0001","creditValueMinor":25}'
```

---

## Error Handling

Common standardized codes (**`PullTabsService`**, provider path):

| Code | When |
|------|------|
| **`UNAUTHORIZED_IP`** | Buy called from non-whitelisted IP |
| **`SESSION_EXPIRED`** | Provider session TTL elapsed |
| **`MISSING_GAME_METADATA`** / **`MISSING_PAYTABLE_ID`** | Session **`gameMetadata`** incomplete |
| **`INVALID_PAYTABLE_ID`** | Dynamo miss or inactive paytable (inactive returns generic bad request messaging in some paths — treat **`active`** proactively) |
| **`MISSING_CREDIT_VALUE`**, **`INVALID_CREDIT_VALUE`** | **`creditValueMinor`** problems |
| **`GRID_MISMATCH`** / **`INVALID_GRID_PARAMETERS`** | **`rows`** / **`symbolsPerRow`** in session contradict paytable |

HTTP helpers may return **`format_response`** without nested **`standardized_bad_request`** for some catalog paths—parse **`statusCode`** and **`body`** from API Gateway payloads.

---

## Best Practices

1. **Denomination**: Always call **`get-paytable-info`** with the **exact** **`creditValueMinor`** you will use in **`gameMetadata`** (multipliers are evaluated against that integer).
2. **`awardTiers` layout**: Keep tier **order** consistent with your cert / doc story (**index ranges** follow JSON order). After editing backup JSON, **[sync Dynamo](#seeding-dynamo-from-repo-json)** so runtime matches repo seeds.
3. **Optional grid hints**: Omit **`rows`** / **`symbolsPerRow`** unless you want **hard validation** versus the Dynamo paytable (**matches scratch pattern**).
4. **Client display**: Map **`symbol`** IDs to artwork; hide or restyle **`__junk_##__`** row fillers.
5. **Audit**: Log **`rngNonce`**, **`ticketPoolIndex`**, **`operatorTransactionId`** for reconciliation.
6. **Refunds**: Store **`operatorTransactionId`** returned to the operator as the correlate for **`externalId`** on **`/provider/refund`**.

---

## Support

Same channels as **[Scratch Cards onboarding](scratch_cards_api_onboarding.md)**:

- **Email**: integration@llg-gaming.com
- **Support Portal**: https://support.llg-gaming.com
- **Documentation**: https://docs.llg-gaming.com

---

## Conclusion

The Pull Tabs stack gives you **finite-deal IID ticket semantics**, **certified RNG surface area**, session-based **economy ↔ wallet conversion**, and **ScratchCard-aligned** **`PullTabsRounds`** + **`/provider/refund`** handling. Combine this guide with **[provider_api_onboarding.md](provider_api_onboarding.md)** and **[Bonus free play](bonus_free_play_hub.md)** for end-to-end aggregator integration.

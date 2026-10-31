# Build spec: CovenantBasket

A closed-end basket of Kudo covenant NFTs. Depositors contribute live cNFTs
during a creation period and receive ERC-20 shares; the basket is then sealed,
and shares are redeemable for a pro-rata slice of the USDG the basket receives
as those covenants settle.

One Solidity file, no imports, no build dependencies.

## Why it is shaped this way

Three properties of the Kudo contract constrain the design. Each was verified
on Robinhood testnet (chainId 46630) rather than assumed.

1. **A covenant NFT is burned when its promise settles.** `ownerOf` then
   reverts with `ERC721NonexistentToken`. Verified: covenants 15, 23, 24, 29
   and 30 are all settled and all revert; 17 and 31 are unsettled and both
   return an owner. So the basket's holdings disappear as they are fulfilled,
   and the contract must read a revert as "fulfilled" rather than as an error.

2. **Holding the NFT does not entitle the holder to the payment.** Kudo pays
   the address a counterparty writes into `promiseDetail`. Nothing in that path
   reads `ownerOf`. The basket therefore receives money only if the parties
   point `promiseDetail` at it, and the contract must expose that address and
   say so plainly.

3. **Covenant NFTs are transferable while live.** Kudo answers
   `supportsInterface(0x80ac58cd)` true, and both `transferFrom` and
   `safeTransferFrom` simulate successfully against a live covenant. Custody is
   therefore possible, which is what makes a basket feasible at all.

## Functional requirements

| ID | Requirement |
| --- | --- |
| F-1 | User must be able to put a covenant they own into the basket and get a share for it. |
| F-2 | User must be able to see which covenants are in the basket, and how many, before deciding to deposit. |
| F-3 | User must be prevented from depositing a covenant that has already been fulfilled, since there is nothing left to deposit. |
| F-4 | User must be able to hold, send or sell their shares to anyone, without asking permission. |
| F-5 | User must be able to redeem shares for their proportional part of the money the basket has received. |
| F-6 | User must get the same amount for the same shares whether they redeem first or last. |
| F-7 | User must be able to redeem without the curator's cooperation, once the basket is closed. |
| F-8 | User must be able to see what one share is worth at any time. |
| F-9 | User must be able to see how many of the basket's covenants are still outstanding, and how many have been fulfilled. |
| F-10 | User must be able to record that a covenant has been fulfilled, without needing permission to do so. |
| F-11 | User must be able to find the address to pay so that settling a covenant sends the money to the basket rather than elsewhere. |
| F-12 | User must be told, in the contract itself, that paying the wrong address leaves the basket holding covenants and no money. |
| F-13 | Curator must be able to close the basket so that no further shares can ever be created. |
| F-14 | Curator must not be able to do anything else: not take the money, not take the covenants, not stop redemptions, not change the rules. |
| F-15 | User must be able to verify every claim above by reading the chain, without needing the Kudo contract's source code. |

## Technical requirements

| ID | Area | Requirement | On violation |
| --- | --- | --- | --- |
| FR-1 | Shares | One share is minted per covenant deposited. `decimals` is 0; shares are indivisible. | — |
| FR-2 | Shares | Standard ERC-20 surface: `transfer`, `approve`, `transferFrom`, `balanceOf`, `allowance`, `totalSupply`, with `Transfer` and `Approval` events. An allowance of `type(uint256).max` is infinite and is not decremented. | — |
| FR-3 | Shares | Minting emits `Transfer(address(0), depositor, 1)`; burning emits `Transfer(holder, address(0), shares)`. | — |
| FR-4 | Creation | `deposit(covenantId)` accepts a covenant only while its NFT still exists. | `NotLive` |
| FR-5 | Creation | `deposit` pulls the token with `transferFrom`; the caller must have approved the basket first. No implicit custody. | Kudo revert |
| FR-6 | Creation | `deposit` records the depositor for that covenant and appends the id to an enumerable list. | — |
| FR-7 | Creation | `deposit` is refused once the basket is sealed. | `AlreadySealed` |
| FR-8 | Sealing | Only the curator may call `sealBasket()`. | `NotCurator` |
| FR-9 | Sealing | Sealing a second time is refused. | `AlreadySealed` |
| FR-10 | Sealing | No code path mints a share after sealing, so the redemption denominator is fixed for the basket's life. | — |
| FR-11 | Lifecycle | `reconcile(covenantId)` marks a basket covenant settled only when its NFT no longer exists. | `StillLive`, or `NotLive` if never deposited here |
| FR-12 | Lifecycle | `reconcile` is idempotent and callable by anyone: it records what the chain already says and grants no privilege. | — |
| FR-13 | Lifecycle | `liveCount()` derives the number of unfulfilled covenants by querying the chain, not by trusting stored flags. | — |
| FR-14 | Redemption | `redeem(shares)` is refused before the basket is sealed. | `NotSealed` |
| FR-15 | Redemption | Redeeming zero is refused; redeeming more than held is refused. | `NothingToRedeem`, `InsufficientShares` |
| FR-16 | Redemption | Payout is `(usdgBalance + distributed) * shares / totalSupply`, where `distributed` is the lifetime total already paid out. | — |
| FR-17 | Redemption | **Order invariance.** For fixed receipts, what a holder redeems must not depend on how many others redeemed first. This is why FR-16 adds `distributed` back rather than dividing the current balance. | — |
| FR-18 | Redemption | State is written before the USDG transfer, and a failed transfer reverts the whole redemption. | `TransferFailed` |
| FR-19 | Receiving | `onERC721Received` returns its own selector, so `safeTransferFrom` into the basket succeeds. | — |
| FR-20 | Views | `payee()` returns the basket's own address — the value counterparties must write into `promiseDetail` for settlement to arrive here. | — |
| FR-21 | Views | `sharePrice()` returns what one share would currently redeem for, and returns 0 at zero supply rather than dividing by zero. | — |
| FR-22 | Views | `covenantCount()` returns the number of covenants deposited. | — |

## Constraints

- One file, `CovenantBasket.sol`. No imports, no libraries, no inherited
  contracts — it must compile in an environment with no network access.
- Solidity `^0.8.20`, built with solc 0.8.24, optimizer on, 200 runs.
- Custom errors rather than revert strings.
- Kudo and USDG are reached through minimal local interfaces declared in the
  file. The spec must not require Kudo's source or a published ABI.
- `kudo`, `usdg` and `curator` are immutable, set at construction.
- No admin withdrawal, no pause, no upgrade path, no proxy. The curator's only
  power is sealing.

## Out of scope, and stated in the contract

- It cannot compel settlement. An unfulfilled covenant simply sits in the
  basket and no USDG arrives for it.
- It does not route payment. If `promiseDetail` does not name `payee()`, the
  basket holds tokens and no cash.
- There is no valuation oracle. `sharePrice()` reflects cash received only and
  assigns no value to covenants still outstanding.
- Unaudited, testnet only, stated in the file header.

## Open decisions

- **No withdrawal before sealing.** A depositor cannot take a covenant back,
  even during the creation period. Simple and predictable, but it means a
  mistaken deposit is permanent. A `withdraw` restricted to `depositorOf` and
  to the unsealed state would fix it at the cost of more surface.
- **Curator is a single address.** Sealing is the only privileged action, so
  the blast radius is "never sealed" rather than loss of funds — but a basket
  whose curator vanishes can never be redeemed from.

## Acceptance

Tests, each failing before the behaviour exists and passing after:

1. Deposit of a live covenant mints exactly one share and moves the NFT.
2. Deposit of a settled covenant reverts `NotLive`.
3. Deposit without prior approval reverts.
4. Deposit after sealing reverts `AlreadySealed`.
5. Sealing by a non-curator reverts `NotCurator`.
6. Redemption before sealing reverts `NotSealed`.
7. Two holders of a sealed basket redeeming in either order receive identical
   amounts for identical share counts — FR-17.
8. `reconcile` on a live covenant reverts `StillLive`; after the NFT is burned
   it succeeds and is idempotent.
9. `sharePrice()` is 0 at zero supply and does not revert.
10. A failing USDG transfer reverts the redemption and leaves shares intact.

Deployment evidence required with delivery: the contract address on testnet,
the transaction that created it, and one `cast call` against it returning a
value the spec predicts.

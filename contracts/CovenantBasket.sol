// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
    CovenantBasket — a closed-end basket of Kudo covenant NFTs.

    What this is. Depositors contribute live covenant cNFTs during a creation
    period and receive ERC-20 shares, one per covenant. The curator then seals
    the basket: no further deposits, so no later depositor can dilute an
    earlier one. Shares are redeemable for a pro-rata slice of whatever USDG
    the basket has received.

    Three facts about Kudo shaped this contract, and anyone using it should
    know them before they deposit.

    1. A covenant NFT is burned the moment its promise is settled. This basket
       therefore holds assets that disappear on fulfilment: `ownerOf` starts
       reverting and the token is gone. That is expected, not a failure, and
       `reconcile` is how the basket records it.

    2. Holding the NFT does not entitle the holder to the covenant's payment.
       Kudo pays the address written into `promiseDetail` by the counterparty,
       and nothing in that path consults `ownerOf`. So this basket receives
       money only if the parties point `promiseDetail` at it. Call `payee()`
       and use that address, or the basket will hold tokens and no cash.

    3. Nothing here can compel settlement. If a covenant is never fulfilled,
       its NFT simply sits in the basket and no USDG ever arrives for it.

    Unaudited. Testnet. No upgrade path, no admin withdrawal, no pause.
*/

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

interface IERC721 {
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

contract CovenantBasket {
    // --- shares (minimal ERC-20) ---
    string public constant name = "Covenant Basket Share";
    string public constant symbol = "cBASKET";
    uint8 public constant decimals = 0; // one share is one covenant, indivisible

    /// Readable on chain, because this contract's source may never be verified
    /// and a comment nobody can see is not a warning.
    string public constant PAYMENT_NOTICE =
        "Kudo pays the address named in promiseDetail, not the NFT holder. "
        "Settlement reaches this basket only if promiseDetail names payee(). "
        "Unaudited, testnet.";

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // --- basket ---
    IERC721 public immutable kudo;
    IERC20 public immutable usdg;
    address public immutable curator;

    bool public sealed_;

    /// Share count captured when the basket was sealed. Redemption divides by
    /// this, never by `totalSupply`: supply falls as shares are burned, so
    /// using it would pay each redeemer a larger slice than the last and let
    /// the final holder drain the basket.
    uint256 public sharesAtSeal;
    uint256[] public covenantIds;
    mapping(uint256 => address) public depositorOf;
    mapping(uint256 => bool) public settled;

    /// USDG already paid out, so the pro-rata maths uses the basket's lifetime
    /// receipts rather than its current balance, which redemptions reduce.
    uint256 public distributed;

    event Deposited(uint256 indexed covenantId, address indexed from);
    event Sealed(uint256 count);
    event Reconciled(uint256 indexed covenantId);
    event Redeemed(address indexed holder, uint256 shares, uint256 usdgOut);

    error NotCurator();
    error AlreadySealed();
    error NotSealed();
    error NotLive(uint256 covenantId);
    error StillLive(uint256 covenantId);
    error NothingToRedeem();
    error InsufficientShares();
    error TransferFailed();

    constructor(address kudo_, address usdg_, address curator_) {
        kudo = IERC721(kudo_);
        usdg = IERC20(usdg_);
        curator = curator_;
    }

    /// Where counterparties must send settlement for this basket to receive it.
    function payee() external view returns (address) {
        return address(this);
    }

    // --- creation period ---

    /// Deposit a live covenant NFT and mint one share. The caller must have
    /// approved this contract for the token first.
    function deposit(uint256 covenantId) external {
        if (sealed_) revert AlreadySealed();

        // A covenant whose promise is already settled has no token left to
        // deposit, and `ownerOf` reverts. Require a live one explicitly so the
        // failure is legible rather than a bare revert from Kudo.
        if (!_isLive(covenantId)) revert NotLive(covenantId);

        kudo.transferFrom(msg.sender, address(this), covenantId);

        covenantIds.push(covenantId);
        depositorOf[covenantId] = msg.sender;

        totalSupply += 1;
        balanceOf[msg.sender] += 1;

        emit Deposited(covenantId, msg.sender);
        emit Transfer(address(0), msg.sender, 1);
    }

    /// Close the basket. After this no share can be created, so the
    /// denominator in every redemption is fixed.
    function sealBasket() external {
        if (msg.sender != curator) revert NotCurator();
        if (sealed_) revert AlreadySealed();
        sealed_ = true;
        sharesAtSeal = totalSupply;
        emit Sealed(covenantIds.length);
    }

    // --- lifecycle ---

    /// Record that a covenant has been fulfilled and its NFT burned. Anyone may
    /// call it; it only writes what the chain already says.
    function reconcile(uint256 covenantId) external {
        if (settled[covenantId]) return;
        if (depositorOf[covenantId] == address(0)) revert NotLive(covenantId);
        if (_isLive(covenantId)) revert StillLive(covenantId);
        settled[covenantId] = true;
        emit Reconciled(covenantId);
    }

    /// Burn shares for a pro-rata slice of lifetime USDG receipts.
    function redeem(uint256 shares) external {
        if (!sealed_) revert NotSealed();
        if (shares == 0) revert NothingToRedeem();
        if (balanceOf[msg.sender] < shares) revert InsufficientShares();

        uint256 pool = usdg.balanceOf(address(this)) + distributed;
        uint256 owed = (pool * shares) / sharesAtSeal;

        balanceOf[msg.sender] -= shares;
        totalSupply -= shares;
        distributed += owed;

        emit Transfer(msg.sender, address(0), shares);
        emit Redeemed(msg.sender, shares, owed);

        if (owed > 0 && !usdg.transfer(msg.sender, owed)) revert TransferFailed();
    }

    // --- views ---

    function covenantCount() external view returns (uint256) {
        return covenantIds.length;
    }

    /// Every covenant in the basket, in one call, so a prospective depositor
    /// can see what they would be buying into without paging an indexed getter.
    function allCovenants() external view returns (uint256[] memory) {
        return covenantIds;
    }

    /// How many of the basket's covenants have been fulfilled, derived from the
    /// chain the same way liveCount is.
    function fulfilledCount() external view returns (uint256 done) {
        uint256 n = covenantIds.length;
        for (uint256 i = 0; i < n; ++i) {
            if (!_isLive(covenantIds[i])) ++done;
        }
    }

    /// What one share would currently redeem for, in USDG base units.
    function sharePrice() external view returns (uint256) {
        uint256 denom = sealed_ ? sharesAtSeal : totalSupply;
        if (denom == 0) return 0;
        return (usdg.balanceOf(address(this)) + distributed) / denom;
    }

    /// How many of the basket's covenants are still unfulfilled, by asking the
    /// chain rather than trusting `settled`.
    function liveCount() external view returns (uint256 live) {
        uint256 n = covenantIds.length;
        for (uint256 i = 0; i < n; ++i) {
            if (_isLive(covenantIds[i])) ++live;
        }
    }

    // --- ERC-20 ---

    function transfer(address to, uint256 value) external returns (bool) {
        if (balanceOf[msg.sender] < value) revert InsufficientShares();
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < value) revert InsufficientShares();
            allowance[from][msg.sender] = allowed - value;
        }
        if (balanceOf[from] < value) revert InsufficientShares();
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
        return true;
    }

    // --- ERC-721 receiver ---

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC721Received.selector;
    }

    // --- internal ---

    /// True while the covenant's NFT still exists. Kudo burns it when the
    /// promise is settled, after which `ownerOf` reverts, so a failed call is
    /// the signal rather than an error.
    function _isLive(uint256 covenantId) internal view returns (bool) {
        (bool ok, bytes memory data) =
            address(kudo).staticcall(abi.encodeWithSelector(IERC721.ownerOf.selector, covenantId));
        return ok && data.length == 32;
    }
}

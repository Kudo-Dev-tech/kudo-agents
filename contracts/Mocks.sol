// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Minimal stand-ins for Kudo and USDG, for local verification only.
contract MockUSDG {
    mapping(address => uint256) public balanceOf;
    function mint(address to, uint256 v) external { balanceOf[to] += v; }
    function transfer(address to, uint256 v) external returns (bool) {
        require(balanceOf[msg.sender] >= v, "balance");
        balanceOf[msg.sender] -= v; balanceOf[to] += v; return true;
    }
}

/// Behaves like Kudo in the one way that matters: ownerOf reverts once a
/// covenant is burned, which is what the basket reads as "fulfilled".
contract MockKudo {
    error ERC721NonexistentToken(uint256 tokenId);
    mapping(uint256 => address) internal _owner;
    mapping(uint256 => address) public getApproved;

    function mint(address to, uint256 id) external { _owner[id] = to; }
    function burn(uint256 id) external { delete _owner[id]; }

    function ownerOf(uint256 id) external view returns (address o) {
        o = _owner[id];
        if (o == address(0)) revert ERC721NonexistentToken(id);
    }
    function approve(address to, uint256 id) external { getApproved[id] = to; }
    function transferFrom(address from, address to, uint256 id) external {
        require(_owner[id] == from, "not owner");
        require(msg.sender == from || getApproved[id] == msg.sender, "not approved");
        _owner[id] = to; delete getApproved[id];
    }
}

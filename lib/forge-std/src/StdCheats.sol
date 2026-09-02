// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

pragma experimental ABIEncoderV2;

import {StdStorage, stdStorage} from "./StdStorage.sol";
import {console2} from "./console2.sol";
import {Vm} from "./Vm.sol";

abstract contract StdCheatsSafe {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant UINT256_MAX =
        115792089237316195423570985008687907853269984665640564039457584007913129639935;

    bool private gasMeteringOff;

    // Data structures to parse Transaction objects from the broadcast artifact
    // that conform to EIP1559. The Raw structs is what is parsed from the JSON
    // and then converted to the one that is used by the user for better UX.

    struct RawTx1559 {
        string[] arguments;
        address contractAddress;
        string functionSig;
        bytes32 hash;
        RawTx1559Detail txDetail;
        TxReturn[] returns;
    }

    struct RawTx1559Detail {
        AccessList[] accessList;
        bytes data;
        address from;
        bytes gas;
        bytes nonce;
        address to;
        bytes txType;
        bytes value;
    }

    struct Tx1559 {
        string[] arguments;
        address contractAddress;
        string functionSig;
        bytes32 hash;
        Tx1559Detail txDetail;
        TxReturn[] returns;
    }

    struct Tx1559Detail {
        AccessList[] accessList;
        bytes data;
        address from;
        uint256 gas;
        uint256 nonce;
        address to;
        uint256 txType;
        uint256 value;
    }

    // Data structures to parse Transaction objects from the broadcast artifact
    // that DO NOT conform to EIP1559. The Raw structs is what is parsed from the JSON
    // and then converted to the one that is used by the user for better UX.

    struct RawTxLegacy {
        string[] arguments;
        address contractAddress;
        string functionSig;
        bytes32 hash;
        RawTxLegacyDetail txDetail;
        TxReturn[] returns;
    }

    struct RawTxLegacyDetail {
        AccessList[] accessList;
        bytes data;
        address from;
        bytes gas;
        bytes nonce;
        address to;
        bytes txType;
        bytes value;
    }

    struct TxLegacy {
        string[] arguments;
        address contractAddress;
        string functionSig;
        bytes32 hash;
        TxLegacyDetail txDetail;
        TxReturn[] returns;
    }

    struct TxLegacyDetail {
        AccessList[] accessList;
        bytes data;
        address from;
        uint256 gas;
        uint256 nonce;
        address to;
        uint256 txType;
        uint256 value;
    }

    // Data structures to parse Receipt objects from the broadcast artifact.
    // The Raw structs is what is parsed from the JSON
    // and then converted to the one that is used by the user for better UX.

    struct RawReceipt {
        bytes32 blockHash;
        bytes blockNumber;
        address contractAddress;
        bytes cumulativeGasUsed;
        bytes effectiveGasPrice;
        address from;
        bytes gasUsed;
        RawReceiptLog[] logs;
        bytes logsBloom;
        bytes status;
        address to;
        bytes32 transactionHash;
        bytes transactionIndex;
    }

    struct Receipt {
        bytes32 blockHash;
        uint256 blockNumber;
        address contractAddress;
        uint256 cumulativeGasUsed;
        uint256 effectiveGasPrice;
        address from;
        uint256 gasUsed;
        ReceiptLog[] logs;
        bytes logsBloom;
        uint256 status;
        address to;
        bytes32 transactionHash;
        uint256 transactionIndex;
    }

    // Data structures to parse Transaction objects from the broadcast artifact
    // that conform to EIP1559. The Raw structs is what is parsed from the JSON
    // and then converted to the one that is used by the user for better UX.

    struct TxReturn {
        string decodedType;
        string value;
    }

    // Data structures to parse ReceiptLog objects from the broadcast artifact.
    // The Raw structs is what is parsed from the JSON
    // and then converted to the one that is used by the user for better UX.

    struct RawReceiptLog {
        // json tag "= false" required because `address` is a keyword
        address _address;
        bytes32 blockHash;
        bytes blockNumber;
        bytes data;
        bytes logIndex;
        bool removed;
        bytes32[] topics;
        bytes32 transactionHash;
        bytes transactionIndex;
        bytes transactionLogIndex;
    }

    struct ReceiptLog {
        // json tag "= false" required because `address` is a keyword
        address _address;
        bytes32 blockHash;
        uint256 blockNumber;
        bytes data;
        uint256 logIndex;
        bytes32[] topics;
        uint256 transactionIndex;
        uint256 transactionLogIndex;
        bool removed;
    }

    struct AccessList {
        address accessAddress;
        bytes32[] storageKeys;
    }

    struct RawGasUsed {
        string _0;
    }

    struct Chain {
        // The chain id.
        uint256 chainId;
        // The alias of the chain, e.g. "mainnet".
        string chainAlias;
        // The default identity of the chain, e.g. "ETH".
        string defaultSymbol;
        // The default decimals of the chain, e.g. 18.
        uint256 defaultDecimals;
    }

    // Data structures to parse the broadcast artifact, both in EIP1559 and Legacy formats.

    struct EIP1559ScriptArtifact {
        string[] libraries;
        string path;
        string[] pending;
        Receipt[] receipts;
        uint256 timestamp;
        Tx1559[] transactions;
        TxReturn[] txReturns;
    }

    struct RawEIP1559ScriptArtifact {
        string[] libraries;
        string path;
        string[] pending;
        RawReceipt[] receipts;
        uint256 timestamp;
        RawTx1559[] transactions;
        TxReturn[] txReturns;
    }

    struct LegacyScriptArtifact {
        string[] libraries;
        string path;
        string[] pending;
        Receipt[] receipts;
        uint256 timestamp;
        TxLegacy[] transactions;
        TxReturn[] txReturns;
    }

    struct RawLegacyScriptArtifact {
        string[] libraries;
        string path;
        string[] pending;
        RawReceipt[] receipts;
        uint256 timestamp;
        RawTxLegacy[] transactions;
        TxReturn[] txReturns;
    }

    /// @dev Cheats to skip steps in the test.
    modifier skip(bool condition) {
        if (condition) {
            vm.skip(true);
        }
        _;
    }

    /// @dev Cheats to skip steps in the test.
    modifier skipNot(bool condition) {
        if (!condition) {
            vm.skip(true);
        }
        _;
    }

    // Deploy a contract by fetching the contract bytecode from
    // the artifacts directory
    // e.g. `deployCode(code, abi.encode(arg1,arg2,arg3))`
    function deployCode(string memory what, bytes memory args) internal virtual returns (address addr) {
        bytes memory bytecode = abi.encodePacked(vm.getCode(what), args);
        /// @solidity memory-safe-assembly
        assembly {
            addr := create(0, add(bytecode, 0x20), mload(bytecode))
        }

        require(addr != address(0), "StdCheats deployCode(string,bytes): Deployment failed.");
    }

    function deployCode(string memory what) internal virtual returns (address addr) {
        bytes memory bytecode = vm.getCode(what);
        /// @solidity memory-safe-assembly
        assembly {
            addr := create(0, add(bytecode, 0x20), mload(bytecode))
        }

        require(addr != address(0), "StdCheats deployCode(string): Deployment failed.");
    }

    /// @dev get code from an artifact file. Takes in the relative path to the json file
    function readERC20(string memory pathToArtifact) internal view virtual returns (address) {
        return vm.parseJsonAddress(vm.readFile(pathToArtifact), ".deployedTo");
    }

    // Creates a new contract with the specified creation code
    function deployCodeTo(string memory what, address where) internal virtual {
        deployCodeTo(what, "", 0, where);
    }

    function deployCodeTo(string memory what, bytes memory args, address where) internal virtual {
        deployCodeTo(what, args, 0, where);
    }

    function deployCodeTo(string memory what, bytes memory args, uint256 value, address where) internal virtual {
        bytes memory creationCode = vm.getCode(what);
        vm.etch(where, abi.encodePacked(creationCode, args));
        (bool success, bytes memory runtimeBytecode) = where.call{value: value}("");
        require(success, "StdCheats deployCodeTo(string,bytes,uint256,address): Failed to create runtime bytecode.");
        vm.etch(where, runtimeBytecode);
    }

    function makeAddr(string memory name) internal virtual returns (address addr) {
        uint256 privateKey = uint256(keccak256(abi.encodePacked(name)));
        addr = vm.addr(privateKey);
        vm.label(addr, name);
    }

    function makeAddrAndKey(string memory name) internal virtual returns (address addr, uint256 privateKey) {
        privateKey = uint256(keccak256(abi.encodePacked(name)));
        addr = vm.addr(privateKey);
        vm.label(addr, name);
    }

    function destroyAccount(address who, address beneficiary) internal virtual {
        uint256 prevBalance = who.balance;
        vm.etch(who, abi.encodePacked(""));
        vm.deal(who, 0);
        vm.resetNonce(who);

        uint256 prevBal = beneficiary.balance;
        vm.deal(beneficiary, prevBal + prevBalance);
    }

    function changePrank(address msgSender) internal virtual {
        vm.stopPrank();
        vm.startPrank(msgSender);
    }

    function changePrank(address msgSender, address txOrigin) internal virtual {
        vm.stopPrank();
        vm.startPrank(msgSender, txOrigin);
    }

    // solhint-disable-next-line payable-fallback
    function assumeNoRevert() internal virtual {
        vm.assumeNoRevert();
    }

    function assumeNotBlacklisted(address token, address addr) internal view virtual {
        if (!_isContract(token)) {
            return;
        }

        (bool success, bytes memory returnData) =
            token.staticcall(abi.encodeWithSelector(0xfe9d8303, addr)); // `isBlacklisted(address)`
        if (success && returnData.length == 32) {
            require(
                !abi.decode(returnData, (bool)),
                "StdCheats assumeNotBlacklisted(address,address): Token contains a blacklist"
            );
        }

        (success, returnData) = token.staticcall(abi.encodeWithSelector(0xe47d6060, addr)); // `isBlackListed(address)`
        if (success && returnData.length == 32) {
            require(
                !abi.decode(returnData, (bool)),
                "StdCheats assumeNotBlacklisted(address,address): Token contains a blacklist"
            );
        }
    }

    function assumeNoBlacklisted(address token, address addr) internal view virtual {
        assumeNotBlacklisted(token, addr);
    }

    function assumePayable(address addr) internal virtual {
        vm.assume(_isPayable(addr));
    }

    function assumeNotPayable(address addr) internal virtual {
        vm.assume(!_isPayable(addr));
    }

    function assumeNotPrecompile(address addr) internal view virtual {
        assumeNotPrecompile(addr, _pureChainId());
    }

    function assumeNotPrecompile(address addr, uint256 chainId) internal view virtual {
        // Note: For some chains like Optimism these are technically predeploys (i.e. bytecode placed at a specific
        // address), but the same rationale for excluding them applies so we include both of them here.

        // These should not be considered contracts for any chain, e.g. `vm.etch` should not work.
        assumeNotForgeAddress(addr);

        // Note: Do not remove any precompiles here! This list is used to exclude precompiles when fuzzing, so removing
        // one will cause tests to start reverting unexpectedly.
        if (chainId == 1 || chainId == 10 || chainId == 420 || chainId == 31337 || chainId == 5) {
            assumeNotPrecompile(addr, 1, 9); // Common between ETH and Optimism (and local).
            assumeNotPrecompile(addr, 0x4200, 0x4210); // Optimism specific precompiles.
        } else if (chainId == 42161 || chainId == 42170) {
            assumeNotPrecompile(addr, 1, 9); // Common between ETH and Arbitrum.
            assumeNotPrecompile(addr, 0x64, 0x68); // Arbitrum specific precompiles.
        } else if (chainId == 43114 || chainId == 43113) {
            assumeNotPrecompile(addr, 1, 9); // Common between ETH and Avalanche.
            assumeNotPrecompile(addr, 0x0100000000, 0x0100000021); // Avalanche specific precompiles.
        } else {
            assumeNotPrecompile(addr, 1, 9); // Default to excluding the common Ethereum precompiles.
        }
    }

    function assumeNotPrecompile(address addr, uint256 start, uint256 end) internal pure virtual {
        vm.assume(uint160(addr) < start || uint160(addr) > end);
    }

    function assumeNotForgeAddress(address addr) internal pure virtual {
        // vm, console, and CreateX
        vm.assume(
            addr != address(vm) && addr != 0x000000000000000000636F6e736F6c652e6c6f67
                && addr != 0xba5Ed099633D3C6FeAd27e1d323674002dd45341
        );
    }

    function assumeUnusedAddress(address addr) internal view virtual {
        assumeNotPrecompile(addr);
        vm.assume(addr.code.length == 0);
        vm.assume(addr != address(this));
    }

    function _isPayable(address addr) private returns (bool) {
        // We'll just brute force a send of 1 wei here. Can't just be used in view/pure functions.
        uint256 origBalanceTest = address(this).balance;
        uint256 origBalanceAddr = addr.balance;

        vm.deal(address(this), 1);
        (bool success,) = payable(addr).call{value: 1}("");

        // reset balances
        vm.deal(address(this), origBalanceTest);
        vm.deal(addr, origBalanceAddr);

        return success;
    }

    function _viewChainId() private view returns (uint256 chainId) {
        // Assembly required since `block.chainid` was introduced in 0.8.0.
        assembly {
            chainId := chainid()
        }
        address(this); // Silence warnings in older Solc versions.
    }

    function _pureChainId() private pure returns (uint256 chainId) {
        function() internal view returns (uint256) fnIn = _viewChainId;
        function() internal pure returns (uint256) pureFn;
        assembly {
            pureFn := fnIn
        }
        chainId = pureFn();
    }

    function _isContract(address account) private view returns (bool) {
        return account.code.length > 0;
    }

    // Used to prevent compiler warnings in Solidity <0.8.0
    function _castToPure(function() internal view returns (uint256) fnIn)
        internal
        pure
        returns (function() internal pure returns (uint256) fnOut)
    {
        assembly {
            fnOut := fnIn
        }
    }
}

abstract contract StdCheats is StdCheatsSafe {
    using stdStorage for StdStorage;

    StdStorage private stdstore;
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant CONSOLE2_ADDRESS = 0x000000000000000000636F6e736F6c652e6c6f67;

    // Skip forward or rewind time by the specified number of seconds
    function skip(uint256 time) internal virtual {
        vm.warp(block.timestamp + time);
    }

    function rewind(uint256 time) internal virtual {
        vm.warp(block.timestamp - time);
    }

    // Setup a prank from an address that has some ether
    function hoax(address msgSender) internal virtual {
        vm.deal(msgSender, 1 << 128);
        vm.prank(msgSender);
    }

    function hoax(address msgSender, uint256 give) internal virtual {
        vm.deal(msgSender, give);
        vm.prank(msgSender);
    }

    function hoax(address msgSender, address origin) internal virtual {
        vm.deal(msgSender, 1 << 128);
        vm.prank(msgSender, origin);
    }

    function hoax(address msgSender, address origin, uint256 give) internal virtual {
        vm.deal(msgSender, give);
        vm.prank(msgSender, origin);
    }

    // Start perpetual prank from an address that has some ether
    function startHoax(address msgSender) internal virtual {
        vm.deal(msgSender, 1 << 128);
        vm.startPrank(msgSender);
    }

    function startHoax(address msgSender, uint256 give) internal virtual {
        vm.deal(msgSender, give);
        vm.startPrank(msgSender);
    }

    function startHoax(address msgSender, address origin) internal virtual {
        vm.deal(msgSender, 1 << 128);
        vm.startPrank(msgSender, origin);
    }

    function startHoax(address msgSender, address origin, uint256 give) internal virtual {
        vm.deal(msgSender, give);
        vm.startPrank(msgSender, origin);
    }

    function changePrank(address msgSender) internal virtual override {
        vm.stopPrank();
        vm.startPrank(msgSender);
    }

    function changePrank(address msgSender, address txOrigin) internal virtual override {
        vm.stopPrank();
        vm.startPrank(msgSender, origin);
    }

    // The same as Vm's `deal`
    function deal(address to, uint256 give) internal virtual {
        vm.deal(to, give);
    }

    // Set the balance of an account for any ERC20 token, by interacting with StdStorage
    function deal(address token, address to, uint256 give) internal virtual {
        deal(token, to, give, false);
    }

    function deal(address token, address to, uint256 give, bool adjust) internal virtual {
        // get current balance
        (, bytes memory balData) = token.staticcall(abi.encodeWithSelector(0x70a08231, to));
        uint256 prevBal = abi.decode(balData, (uint256));

        // Update the balance
        stdstore.target(token).sig(0x70a08231).with_key(to).checked_write(give);

        // Update total supply if `adjust` is true
        if (adjust) {
            (, bytes memory totSupData) = token.staticcall(abi.encodeWithSelector(0x18160ddd));
            uint256 totSup = abi.decode(totSupData, (uint256));
            if (give < prevBal) {
                totSup -= (prevBal - give);
            } else {
                totSup += (give - prevBal);
            }
            stdstore.target(token).sig(0x18160ddd).checked_write(totSup);
        }
    }

    function dealERC1155(address token, address to, uint256 id, uint256 give, bool adjust) internal virtual {
        // get current balance
        (, bytes memory balData) = token.staticcall(abi.encodeWithSelector(0x00fdd58e, to, id));
        uint256 prevBal = abi.decode(balData, (uint256));

        // Update the balance
        stdstore.target(token).sig(0x00fdd58e).with_key(to).with_key(id).checked_write(give);

        // Update total supply if `adjust` is true
        if (adjust) {
            (, bytes memory totSupData) = token.staticcall(abi.encodeWithSelector(0xbd85b039, id));
            require(
                totSupData.length != 0,
                "StdCheats deal(address,address,uint256,uint256,bool): target for `dealERC1155` must implement `totalSupply(uint256)`"
            );
            uint256 totSup = abi.decode(totSupData, (uint256));
            if (give < prevBal) {
                totSup -= (prevBal - give);
            } else {
                totSup += (give - prevBal);
            }
            stdstore.target(token).sig(0xbd85b039).with_key(id).checked_write(totSup);
        }
    }

    function dealERC721(address token, address to, uint256 id) internal virtual {
        // check if token is NFT
        (bool success, bytes memory returnData) = token.staticcall(abi.encodeWithSelector(0x6352211e, id));
        require(success, "StdCheats dealERC721(address,address,uint256): id not found or invalid.");

        address currentOwner = abi.decode(returnData, (address));

        // get owners token balance
        (, bytes memory balData) = token.staticcall(abi.encodeWithSelector(0x70a08231, currentOwner));
        uint256 prevOwnerBal = abi.decode(balData, (uint256));

        (, bytes memory toBalData) = token.staticcall(abi.encodeWithSelector(0x70a08231, to));
        uint256 prevToBal = abi.decode(toBalData, (uint256));

        stdstore.target(token).sig(0x70a08231).with_key(currentOwner).checked_write(--prevOwnerBal);
        stdstore.target(token).sig(0x70a08231).with_key(to).checked_write(++prevToBal);
        stdstore.target(token).sig(0x6352211e).with_key(id).checked_write(to);
    }

    function deployCodeTo(string memory what, bytes memory args, uint256 value, address where) internal virtual {
        bytes memory creationCode = vm.getCode(what);
        vm.etch(where, abi.encodePacked(creationCode, args));
        (bool success, bytes memory runtimeBytecode) = where.call{value: value}("");
        require(success, "StdCheats deployCodeTo(string,bytes,uint256,address): Failed to create runtime bytecode.");
        vm.etch(where, runtimeBytecode);
    }

    function noGasMetering() internal virtual {
        vm.pauseGasMetering();
    }

    modifier noGasMetering() {
        vm.pauseGasMetering();
        _;
        vm.resumeGasMetering();
    }

    // Makes the address a contract that always reverts.
    function etchRevert(address who) internal virtual {
        vm.etch(who, hex"60006000fd");
    }

    function console2_log_StdCheats(string memory p0) private view {
        (bool status,) = address(CONSOLE2_ADDRESS).staticcall(abi.encodeWithSignature("log(string)", p0));
        status;
    }
}

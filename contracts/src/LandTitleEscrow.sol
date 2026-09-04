// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title LandTitleEscrow
 * @dev Multi-signature escrow smart contract for land title transfers
 * Requires approval from Seller, Buyer, and Registrar before completing transfer
 */
contract LandTitleEscrow {
    enum EscrowStatus {
        PENDING,
        LOCKED_IN_ESCROW,
        SELLER_APPROVED,
        BUYER_APPROVED,
        REGISTRAR_APPROVED,
        COMPLETED,
        REJECTED,
        CANCELLED
    }

    struct Escrow {
        string transactionId;
        string parcelId;
        address seller;
        address buyer;
        address registrar;
        uint256 amount;
        EscrowStatus status;
        bool sellerApproved;
        bool buyerApproved;
        bool registrarApproved;
        uint256 createdAt;
        uint256 completedAt;
        string ipfsDocumentCid;
    }

    // Mapping of transaction ID to Escrow
    mapping(string => Escrow) public escrows;

    // Array to track all escrow IDs
    string[] public escrowIds;

    // Registrar address
    address public registrarAddress;

    // Owner of the contract
    address public owner;

    // Events
    event EscrowCreated(
        string indexed transactionId,
        string indexed parcelId,
        address indexed seller,
        address buyer,
        uint256 amount
    );

    event TransferApproved(
        string indexed transactionId,
        string role,
        address indexed approver
    );

    event TransferCompleted(
        string indexed transactionId,
        address indexed newOwner,
        uint256 timestamp
    );

    event TransferRejected(
        string indexed transactionId,
        string reason,
        uint256 timestamp
    );

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyRegistrar() {
        require(msg.sender == registrarAddress, "Only registrar can call this");
        _;
    }

    modifier escrowExists(string memory _transactionId) {
        require(
            escrows[_transactionId].createdAt != 0,
            "Escrow does not exist"
        );
        _;
    }

    /**
     * @dev Constructor to initialize contract with registrar address
     */
    constructor(address _registrarAddress) {
        owner = msg.sender;
        registrarAddress = _registrarAddress;
    }

    /**
     * @dev Create a new escrow for land transfer
     */
    function createEscrow(
        string memory _transactionId,
        address _seller,
        address _buyer,
        address _registrar,
        string memory _parcelId,
        uint256 _amount,
        string memory _ipfsDocumentCid
    ) public onlyOwner {
        require(_seller != address(0), "Invalid seller address");
        require(_buyer != address(0), "Invalid buyer address");
        require(_registrar != address(0), "Invalid registrar address");
        require(escrows[_transactionId].createdAt == 0, "Escrow already exists");

        escrows[_transactionId] = Escrow({
            transactionId: _transactionId,
            parcelId: _parcelId,
            seller: _seller,
            buyer: _buyer,
            registrar: _registrar,
            amount: _amount,
            status: EscrowStatus.LOCKED_IN_ESCROW,
            sellerApproved: false,
            buyerApproved: false,
            registrarApproved: false,
            createdAt: block.timestamp,
            completedAt: 0,
            ipfsDocumentCid: _ipfsDocumentCid
        });

        escrowIds.push(_transactionId);

        emit EscrowCreated(
            _transactionId,
            _parcelId,
            _seller,
            _buyer,
            _amount
        );
    }

    /**
     * @dev Approve transfer by stakeholder
     */
    function approveTransfer(string memory _transactionId, string memory _role)
        public
        escrowExists(_transactionId)
    {
        Escrow storage escrow = escrows[_transactionId];

        require(
            escrow.status == EscrowStatus.LOCKED_IN_ESCROW ||
                escrow.status == EscrowStatus.SELLER_APPROVED ||
                escrow.status == EscrowStatus.BUYER_APPROVED ||
                escrow.status == EscrowStatus.REGISTRAR_APPROVED,
            "Escrow cannot be approved at this status"
        );

        bytes32 roleHash = keccak256(abi.encodePacked(_role));
        bytes32 sellerHash = keccak256(abi.encodePacked("SELLER"));
        bytes32 buyerHash = keccak256(abi.encodePacked("BUYER"));
        bytes32 registrarHash = keccak256(abi.encodePacked("REGISTRAR"));

        if (roleHash == sellerHash) {
            require(msg.sender == escrow.seller, "Only seller can approve");
            escrow.sellerApproved = true;
            emit TransferApproved(_transactionId, "SELLER", msg.sender);
        } else if (roleHash == buyerHash) {
            require(msg.sender == escrow.buyer, "Only buyer can approve");
            escrow.buyerApproved = true;
            emit TransferApproved(_transactionId, "BUYER", msg.sender);
        } else if (roleHash == registrarHash) {
            require(msg.sender == escrow.registrar, "Only registrar can approve");
            escrow.registrarApproved = true;
            emit TransferApproved(_transactionId, "REGISTRAR", msg.sender);
        } else {
            revert("Invalid role");
        }

        // Update status based on approvals
        updateEscrowStatus(_transactionId);
    }

    /**
     * @dev Update escrow status based on approvals
     */
    function updateEscrowStatus(string memory _transactionId) internal {
        Escrow storage escrow = escrows[_transactionId];

        if (
            escrow.sellerApproved &&
            escrow.buyerApproved &&
            escrow.registrarApproved
        ) {
            escrow.status = EscrowStatus.REGISTRAR_APPROVED;
        } else if (
            escrow.sellerApproved && escrow.buyerApproved
        ) {
            escrow.status = EscrowStatus.BUYER_APPROVED;
        } else if (
            escrow.sellerApproved
        ) {
            escrow.status = EscrowStatus.SELLER_APPROVED;
        }
    }

    /**
     * @dev Complete the transfer after all approvals
     */
    function completeTransfer(string memory _transactionId)
        public
        onlyRegistrar
        escrowExists(_transactionId)
    {
        Escrow storage escrow = escrows[_transactionId];

        require(
            escrow.status == EscrowStatus.REGISTRAR_APPROVED,
            "All parties must approve before completion"
        );
        require(
            escrow.sellerApproved &&
                escrow.buyerApproved &&
                escrow.registrarApproved,
            "Missing required approvals"
        );

        escrow.status = EscrowStatus.COMPLETED;
        escrow.completedAt = block.timestamp;

        emit TransferCompleted(_transactionId, escrow.buyer, block.timestamp);
    }

    /**
     * @dev Reject the transfer
     */
    function rejectTransfer(string memory _transactionId, string memory _reason)
        public
        onlyRegistrar
        escrowExists(_transactionId)
    {
        Escrow storage escrow = escrows[_transactionId];
        require(
            escrow.status != EscrowStatus.COMPLETED,
            "Cannot reject completed transfer"
        );

        escrow.status = EscrowStatus.REJECTED;

        emit TransferRejected(_transactionId, _reason, block.timestamp);
    }

    /**
     * @dev Get escrow details
     */
    function getEscrowState(string memory _transactionId)
        public
        view
        escrowExists(_transactionId)
        returns (Escrow memory)
    {
        return escrows[_transactionId];
    }

    /**
     * @dev Get all escrow IDs
     */
    function getAllEscrowIds() public view returns (string[] memory) {
        return escrowIds;
    }

    /**
     * @dev Get total number of escrows
     */
    function getEscrowCount() public view returns (uint256) {
        return escrowIds.length;
    }

    /**
     * @dev Check if all parties have approved
     */
    function areAllPartiesApproved(string memory _transactionId)
        public
        view
        escrowExists(_transactionId)
        returns (bool)
    {
        Escrow storage escrow = escrows[_transactionId];
        return (escrow.sellerApproved &&
            escrow.buyerApproved &&
            escrow.registrarApproved);
    }

    /**
     * @dev Update registrar address
     */
    function updateRegistrar(address _newRegistrar) public onlyOwner {
        require(_newRegistrar != address(0), "Invalid registrar address");
        registrarAddress = _newRegistrar;
    }
}

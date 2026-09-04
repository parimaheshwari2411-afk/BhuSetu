import { expect } from "chai";
import { ethers } from "hardhat";

describe("LandTitleEscrow", () => {
  it("locks a transfer until seller, buyer, and registrar approve", async () => {
    const [owner, seller, buyer, registrar] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("LandTitleEscrow");
    const escrow = await Factory.deploy(registrar.address);
    await escrow.waitForDeployment();

    const txId = "tx-001";
    await escrow.createEscrow(
      txId,
      seller.address,
      buyer.address,
      registrar.address,
      "parcel-1",
      0,
      "bafydeedcid"
    );

    let state = await escrow.getEscrowState(txId);
    expect(state.status).to.equal(1);

    await escrow.approveTransferByBackend(txId, "SELLER");
    await escrow.approveTransferByBackend(txId, "BUYER");
    await escrow.approveTransferByBackend(txId, "REGISTRAR");

    state = await escrow.getEscrowState(txId);
    expect(state.sellerApproved).to.equal(true);
    expect(state.buyerApproved).to.equal(true);
    expect(state.registrarApproved).to.equal(true);

    await escrow.completeTransfer(txId);
    state = await escrow.getEscrowState(txId);
    expect(state.status).to.equal(5);

    await expect(owner.getAddress()).to.not.equal(ethers.ZeroAddress);
  });
});

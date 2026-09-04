import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const registrar =
    process.env.REGISTRAR_ADDRESS ||
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

  console.log("Deployer:", deployer.address);
  console.log("Registrar:", registrar);

  const Factory = await ethers.getContractFactory("LandTitleEscrow");
  const contract = await Factory.deploy(registrar);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("LandTitleEscrow deployed:", address);
  console.log("Set LAND_TITLE_ESCROW_ADDRESS=" + address + " in backend/.env");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

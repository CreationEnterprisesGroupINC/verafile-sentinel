import { Command } from "commander";
import { commitCommand } from "./commands/commit.js";
import { verifyCommand } from "./commands/verify.js";
import { attestCommand } from "./commands/attest.js";

const program = new Command();

program
  .name("sentinel")
  .description("Verafile Sentinel — cryptographic proof of integrity for defense supply chains")
  .version("1.0.0");

program.addCommand(commitCommand);
program.addCommand(verifyCommand);
program.addCommand(attestCommand);

program.parse(process.argv);

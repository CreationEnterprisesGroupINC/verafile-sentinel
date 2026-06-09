import { Command } from "commander";
import { commitCommand } from "./commands/commit.js";
import { verifyCommand } from "./commands/verify.js";
import { attestCommand } from "./commands/attest.js";
import { reportCommand } from "./commands/report.js";
import { sbomCommand } from "./commands/sbom.js";
import { watchCommand } from "./commands/watch.js";

const program = new Command();

program
  .name("sentinel")
  .description("Verafile Sentinel — cryptographic proof of integrity for defense supply chains")
  .version("1.1.0");

program.addCommand(commitCommand);
program.addCommand(verifyCommand);
program.addCommand(attestCommand);
program.addCommand(reportCommand);
program.addCommand(sbomCommand);
program.addCommand(watchCommand);

program.parse(process.argv);

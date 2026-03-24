#!/usr/bin/env node

declare const process: {
  argv: string[];
};

import { runCli } from "./app";

runCli(process.argv, "sheet");

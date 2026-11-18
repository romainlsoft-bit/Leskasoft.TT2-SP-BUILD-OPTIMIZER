#!/usr/bin/env node
// First-party offline TT2 8.4 parity, independent of public community CSVs.
import {main} from './unity-parity.mjs';
process.exitCode=await main();
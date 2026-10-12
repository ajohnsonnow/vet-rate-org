// Deliberately allocates and touches memory until the cgroup limit kills it.
import { writeSync } from "node:fs";

const STEP_MB = 128;
const held = [];
let total = 0;
for (;;) {
  held.push(Buffer.alloc(STEP_MB * 1024 * 1024, 1));
  total += STEP_MB;
  writeSync(1, `node allocated ${total} MB\n`);
}

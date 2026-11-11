#!/usr/bin/env node
import("../dist/cli.js").catch((err) => {
  if (err && err.code === "ERR_MODULE_NOT_FOUND") {
    console.error("outside-in is not built yet. Run `npm run build` in the repository root first.");
  } else {
    console.error(err);
  }
  process.exit(1);
});

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";

// Unmount React trees between tests so accumulated DOM state doesn't leak.
afterEach(() => {
  cleanup();
});

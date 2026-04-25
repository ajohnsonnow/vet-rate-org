import "@testing-library/jest-dom";
import { expect } from "vitest";
import * as axeMatchers from "vitest-axe/matchers.js";

// Wire vitest-axe's `toHaveNoViolations` matcher so component tests can call
// `expect(await axe(container)).toHaveNoViolations()` directly. This is the
// canonical pattern recommended by vitest-axe and matches jest-axe parity.
expect.extend(axeMatchers);

import { assertNoHorizontalScroll, test } from "../../tools/device-lab";
import { bootReturningUser, openByEvent } from "./helpers";

test("the home screen has no horizontal scroll at the profile's viewport", async ({
  page,
}) => {
  await bootReturningUser(page);
  await assertNoHorizontalScroll(page);
});

test("the Tactical Calculator has no horizontal scroll at the profile's viewport", async ({
  page,
}) => {
  await bootReturningUser(page);
  await openByEvent(page, "openTacticalCalculator");
  await page
    .locator('[role="dialog"][aria-labelledby="calculator-title"]')
    .waitFor({ state: "visible" });
  await assertNoHorizontalScroll(page);
  await assertNoHorizontalScroll(
    page,
    '[role="dialog"][aria-labelledby="calculator-title"]',
  );
});

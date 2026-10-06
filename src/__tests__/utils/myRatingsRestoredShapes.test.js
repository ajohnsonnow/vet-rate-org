/**
 * Restoring a backup writes its ratings to storage as they are. A backup
 * that was edited by hand, or made by something other than this app, can
 * hold entries with no id, null entries, or no list at all. My Packet picks
 * the entry being edited by id, so entries without one all matched "nothing
 * is being edited" and the Ratings tab crashed.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  getMyRatings,
  updateRating,
  removeRating,
  clearMyRatings,
} from "../../utils/veteranProfile";

const KEY = "vet_rate_my_ratings";
const store = (value) => localStorage.setItem(KEY, JSON.stringify(value));

afterEach(clearMyRatings);

describe("getMyRatings: shapes a restored backup can hold", () => {
  it("gives every entry without an id its own id", () => {
    store([
      { name: "Knee (Left)", rating: 40, side: "left", bodyPart: "knee" },
      { name: "Knee (Right)", rating: 20, side: "right", bodyPart: "knee" },
    ]);

    const ids = getMyRatings().map((r) => r.id);

    expect(ids.every((id) => typeof id === "string" && id !== "")).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });

  it("gives the same ids on every read until something is saved", () => {
    store([
      { name: "PTSD", rating: 50 },
      { name: "Tinnitus", rating: 10 },
    ]);

    expect(getMyRatings().map((r) => r.id)).toEqual(
      getMyRatings().map((r) => r.id),
    );
  });

  it("leaves an entry that already has an id unchanged", () => {
    const saved = { id: "rating_1", name: "PTSD", rating: 50 };
    store([saved]);

    expect(getMyRatings()).toEqual([saved]);
  });

  it("drops entries that are not rating objects", () => {
    store([null, "PTSD", 50, ["x"], { name: "Tinnitus", rating: 10 }]);

    const ratings = getMyRatings();

    expect(ratings).toHaveLength(1);
    expect(ratings[0].name).toBe("Tinnitus");
  });

  it.each([{ ratings: [] }, "none", 7, null])(
    "reads %j as no ratings",
    (stored) => {
      store(stored);

      expect(getMyRatings()).toEqual([]);
    },
  );

  it("updates only the entry that was edited", () => {
    store([
      { name: "PTSD", rating: 50 },
      { name: "Tinnitus", rating: 10 },
    ]);
    const [first] = getMyRatings();

    expect(updateRating(first.id, { rating: 70 })).toBe(true);

    expect(getMyRatings().map((r) => r.rating)).toEqual([70, 10]);
  });

  it("removes only the entry that was removed", () => {
    store([
      { name: "PTSD", rating: 50 },
      { name: "Tinnitus", rating: 10 },
    ]);
    const [first] = getMyRatings();

    removeRating(first.id);

    expect(getMyRatings().map((r) => r.name)).toEqual(["Tinnitus"]);
  });
});

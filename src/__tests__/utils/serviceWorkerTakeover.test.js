import { describe, it, expect, vi } from "vitest";
import { createTakeoverGuard } from "../../utils/serviceWorkerTakeover";

function setup(hadController) {
  const reload = vi.fn();
  const announce = vi.fn();
  const guard = createTakeoverGuard({ hadController, reload, announce });
  return { guard, reload, announce };
}

describe("service worker takeover", () => {
  it("never reloads or announces on the first install of a page with no worker", () => {
    const { guard, reload, announce } = setup(false);
    guard.onControllerChange();
    expect(reload).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  });

  it("reloads at once when Reload is clicked in a tab that began with no worker", () => {
    const { guard, reload, announce } = setup(false);
    guard.onControllerChange();
    guard.markRequested();
    guard.onControllerChange();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(announce).not.toHaveBeenCalled();
  });

  it("announces a later update in a tab that began with no worker", () => {
    const { guard, reload, announce } = setup(false);
    guard.onControllerChange();
    guard.onControllerChange();
    expect(reload).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it("reloads the tab whose veteran asked for the update, exactly once", () => {
    const { guard, reload, announce } = setup(true);
    guard.markRequested();
    guard.onControllerChange();
    guard.onControllerChange();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(announce).not.toHaveBeenCalled();
  });

  it("only announces the update in a tab nobody clicked Reload in", () => {
    const { guard, reload, announce } = setup(true);
    guard.onControllerChange();
    expect(reload).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledTimes(1);
  });
});

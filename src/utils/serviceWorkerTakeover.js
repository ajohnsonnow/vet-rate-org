/**
 * Decides what a page does when a new service worker takes control of it
 * (`controllerchange`). The worker takes over every open tab at once, so only
 * the tab whose veteran clicked Reload may reload itself; the others are told
 * a new version is ready and keep whatever is typed or running in them.
 *
 * - `hadController` is read when the page loads: a page that had no worker yet
 *   is seeing the first install claim it, which must never reload anything.
 * - `markRequested` is called only from the Reload click in this page.
 */
export function createTakeoverGuard({ hadController, reload, announce }) {
  let requested = false;
  let reloaded = false;
  return {
    markRequested() {
      requested = true;
    },
    onControllerChange() {
      if (!hadController) return;
      if (!requested) {
        announce();
        return;
      }
      if (reloaded) return;
      reloaded = true;
      reload();
    },
  };
}

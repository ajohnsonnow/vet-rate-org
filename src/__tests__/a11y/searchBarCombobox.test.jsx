/**
 * B-H04: the search suggestions are the #1 journey for keyboard/screen-reader
 * users. They were rendered as <button role="option" aria-selected={false}>
 * (invalid ARIA — option on an interactive button, nothing ever announced as
 * selected, no aria-activedescendant). This renders the real SearchBar and
 * asserts a valid ARIA 1.2 combobox with working keyboard navigation.
 */
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import axe from "axe-core";

import { LanguageProvider } from "../../contexts/LanguageContext";
import SearchBar from "../../components/SearchBar";

function renderSearch(term) {
  return render(
    <LanguageProvider>
      <SearchBar
        searchTerm={term}
        setSearchTerm={() => {}}
        onClear={() => {}}
        isLoading={false}
      />
    </LanguageProvider>,
  );
}

describe("SearchBar combobox a11y (B-H04)", () => {
  it("renders a valid ARIA combobox with role=option items that are not buttons", async () => {
    const { container, getByRole, queryAllByRole } = renderSearch("tinnitus");

    const input = getByRole("combobox");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-controls")).toBe("search-suggestions");

    const options = queryAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    for (const opt of options) {
      // invalid ARIA was role="option" on a <button>
      expect(opt.tagName).not.toBe("BUTTON");
      expect(opt.id).toBeTruthy();
    }

    const { violations } = await axe.run(container, {
      rules: {
        "color-contrast": { enabled: false },
        "scrollable-region-focusable": { enabled: false },
      },
    });
    expect(violations, JSON.stringify(violations, null, 2)).toHaveLength(0);
  });

  it("ArrowDown sets aria-activedescendant and marks that option selected", () => {
    const { getByRole, queryAllByRole } = renderSearch("tinnitus");
    const input = getByRole("combobox");

    expect(input.getAttribute("aria-activedescendant")).toBeFalsy();

    fireEvent.keyDown(input, { key: "ArrowDown" });

    const active = input.getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();
    const selected = queryAllByRole("option").find(
      (o) => o.getAttribute("aria-selected") === "true",
    );
    expect(selected).toBeTruthy();
    expect(selected.id).toBe(active);
  });
});

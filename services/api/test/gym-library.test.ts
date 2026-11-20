import { describe, expect, it } from "vitest";
import { GYM_EXERCISES } from "@calci/shared";
import { getLibrary } from "../src/lib/gym-library";
import { makeDeps } from "./fakes";

describe("getLibrary (feature 015)", () => {
  it("still yields every built-in when the catalog cannot be read", async () => {
    const { deps, catalog } = makeDeps();
    catalog.failList = true;
    expect(await getLibrary(deps)).toEqual(GYM_EXERCISES);
  });
});

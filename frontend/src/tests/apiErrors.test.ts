/**
 * Tests: API error mapping (422 validation errors, 401, 403, generic).
 */

import { describe, it, expect } from "vitest";
import { mapValidationErrors, extractErrorMessage } from "../api/client";
import axios from "axios";

function makeAxiosError(
  status: number,
  data: unknown
) {
  const error = new axios.AxiosError("Request failed", undefined, undefined, undefined, {
    status,
    statusText: "Error",
    data,
    headers: {},
    config: {} as never,
  });
  return error;
}

describe("mapValidationErrors", () => {
  it("maps 422 field errors to field-keyed messages", () => {
    const error = makeAxiosError(422, {
      detail: [
        { loc: ["body", "email"], msg: "value is not a valid email", type: "value_error.email" },
        { loc: ["body", "name"], msg: "field required", type: "value_error.missing" },
      ],
    });

    const result = mapValidationErrors(error);
    expect(result).toEqual({
      email: "value is not a valid email",
      name: "field required",
    });
  });

  it("returns empty object when no detail array", () => {
    const error = makeAxiosError(400, { detail: "Bad request" });
    expect(mapValidationErrors(error)).toEqual({});
  });

  it("returns empty object for non-axios error", () => {
    expect(mapValidationErrors(new Error("oops") as never)).toEqual({});
  });
});

describe("extractErrorMessage", () => {
  it("extracts error.message from backend envelope", () => {
    const error = makeAxiosError(409, {
      error: { code: "CONFLICT", message: "Hospital with identifier 'HOSP-01' already exists." },
    });
    expect(extractErrorMessage(error)).toBe(
      "Hospital with identifier 'HOSP-01' already exists."
    );
  });

  it("extracts string detail", () => {
    const error = makeAxiosError(401, { detail: "Invalid email or password." });
    expect(extractErrorMessage(error)).toBe("Invalid email or password.");
  });

  it("extracts array detail", () => {
    const error = makeAxiosError(422, {
      detail: [{ msg: "field required" }, { msg: "bad email" }],
    });
    expect(extractErrorMessage(error)).toBe("field required; bad email");
  });

  it("extracts details string array from backend", () => {
    const error = makeAxiosError(422, {
      details: ["body → name: Field required"],
    });
    expect(extractErrorMessage(error)).toBe("body → name: Field required");
  });

  it("falls back to Error.message for non-axios error", () => {
    expect(extractErrorMessage(new Error("network failure"))).toBe("network failure");
  });

  it("returns generic message for unknown error", () => {
    expect(extractErrorMessage(null)).toBe("An unexpected error occurred.");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  twilioSmsErrorLooksPermanent,
  twilioWhatsAppErrorLooksPermanent,
} from "./twilio-permanent-delivery-errors.ts";

describe("twilioWhatsAppErrorLooksPermanent", () => {
  it("detects WhatsApp-specific permanent codes", () => {
    assert.equal(
      twilioWhatsAppErrorLooksPermanent("Twilio WhatsApp error_code 63024: invalid recipient"),
      true
    );
    assert.equal(
      twilioWhatsAppErrorLooksPermanent('{"code":63003,"message":"Channel could not find To address"}'),
      true
    );
  });

  it("inherits SMS permanent codes", () => {
    assert.equal(
      twilioWhatsAppErrorLooksPermanent('{"code":21211,"message":"Invalid To Phone Number"}'),
      true
    );
    assert.equal(twilioSmsErrorLooksPermanent('{"code":21211,"message":"Invalid To Phone Number"}'), true);
  });

  it("ignores transient errors", () => {
    assert.equal(twilioWhatsAppErrorLooksPermanent("Twilio WhatsApp error 500: upstream timeout"), false);
  });
});

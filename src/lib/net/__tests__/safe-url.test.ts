import { describe, expect, it } from "vitest";
import { assertPublicUrl, isPublicAddress } from "@/lib/net/safe-url";

describe("isPublicAddress", () => {
  it("rejects loopback, private, link-local, CGNAT, and reserved IPv4", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });
  it("accepts public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "104.16.0.1"]) {
      expect(isPublicAddress(ip), ip).toBe(true);
    }
  });
  it("rejects loopback, ULA, link-local, and v4-mapped private IPv6", () => {
    for (const ip of ["::1", "::", "fd12::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "ff02::1"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    expect(isPublicAddress("2606:4700::1111")).toBe(true);
  });
});

describe("assertPublicUrl", () => {
  it("rejects non-http schemes and credentials", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow(/HTTP/);
    await expect(assertPublicUrl("ftp://example.com")).rejects.toThrow(/HTTP/);
    await expect(assertPublicUrl("https://user:pw@example.com")).rejects.toThrow(/credentials/);
  });
  it("rejects literal private hosts without DNS", async () => {
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(/not publicly routable/);
    await expect(assertPublicUrl("http://localhost:3000")).rejects.toThrow(/not publicly routable/);
    await expect(assertPublicUrl("http://[::1]/")).rejects.toThrow(/not publicly routable/);
    await expect(assertPublicUrl("http://127.1/")).rejects.toThrow(/not publicly routable|resolved/);
  });
  it("accepts a public literal IP", async () => {
    const url = await assertPublicUrl("https://1.1.1.1/");
    expect(url.hostname).toBe("1.1.1.1");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  shouldBlockOfflineNavigation,
  type OfflineNavigationActivation,
  type OfflineNavigationCandidate,
} from "../lib/offline-navigation";

const currentHref = "https://sufeiya.cn/about?view=student";
const primaryActivation: OfflineNavigationActivation = {
  button: 0,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  defaultPrevented: false,
};

function candidate(
  href: string,
  options: Partial<Omit<OfflineNavigationCandidate, "href">> = {},
): OfflineNavigationCandidate {
  return {
    href,
    download: options.download ?? false,
    target: options.target ?? "",
  };
}

function classify({
  online = false,
  activation = primaryActivation,
  link = candidate("/learning-path"),
  location = currentHref,
}: {
  online?: boolean;
  activation?: OfflineNavigationActivation;
  link?: OfflineNavigationCandidate | null;
  location?: string;
} = {}) {
  return shouldBlockOfflineNavigation({
    online,
    activation,
    candidate: link,
    currentHref: location,
  });
}

describe("offline same-origin navigation classification", () => {
  it("blocks only current-context same-origin document navigation while offline", () => {
    for (const link of [
      candidate("/learning-path"),
      candidate("https://sufeiya.cn/platform"),
      candidate("/about?view=teacher"),
      candidate(currentHref),
      candidate("/workspace", { target: "_self" }),
      candidate("/diagnostic", { target: "_top" }),
      candidate("/plan", { target: "  _TOP  " }),
      candidate("/review", { target: "_parent" }),
    ]) {
      assert.equal(classify({ link }), true, link.href);
    }

    assert.equal(classify({ online: true }), false);
  });

  it("preserves same-document fragments, downloads, new contexts, and non-HTTP destinations", () => {
    for (const link of [
      candidate("#faq"),
      candidate("/about?view=student#faq"),
      candidate("https://www.sufeiya.cn/about"),
      candidate("http://sufeiya.cn/about"),
      candidate("https://example.com/learning-path"),
      candidate("mailto:hello@example.com"),
      candidate("tel:+10000000000"),
      candidate("blob:https://sufeiya.cn/synthetic-export"),
      candidate("data:text/plain,local"),
      candidate("/my-data", { download: true }),
      candidate("/resources", { target: "_blank" }),
      candidate("/resources", { target: "preview-window" }),
      candidate("http://["),
    ]) {
      assert.equal(classify({ link }), false, link.href);
    }
  });

  it("leaves modified, non-primary, and already-handled activations untouched", () => {
    for (const override of [
      { button: 1 },
      { button: 2 },
      { altKey: true },
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { defaultPrevented: true },
    ] satisfies Array<Partial<OfflineNavigationActivation>>) {
      assert.equal(classify({ activation: { ...primaryActivation, ...override } }), false);
    }

    assert.equal(classify({ link: null }), false);
    assert.equal(classify({ location: "not a current URL" }), false);
  });
});

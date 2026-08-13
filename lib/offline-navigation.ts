export type OfflineNavigationCandidate = Readonly<{
  href: string;
  download: boolean;
  target: string;
}>;

export type OfflineNavigationActivation = Readonly<{
  button: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  defaultPrevented: boolean;
}>;

const supportedCurrentContextTargets = new Set(["", "_self", "_top", "_parent"]);

export function shouldBlockOfflineNavigation({
  online,
  activation,
  candidate,
  currentHref,
}: {
  online: boolean;
  activation: OfflineNavigationActivation;
  candidate: OfflineNavigationCandidate | null;
  currentHref: string;
}) {
  if (
    online
    || activation.defaultPrevented
    || activation.button !== 0
    || activation.altKey
    || activation.ctrlKey
    || activation.metaKey
    || activation.shiftKey
    || candidate === null
    || candidate.download
  ) {
    return false;
  }

  const target = candidate.target.trim().toLowerCase();
  if (!supportedCurrentContextTargets.has(target)) return false;

  let current: URL;
  let destination: URL;
  try {
    current = new URL(currentHref);
    destination = new URL(candidate.href, current);
  } catch {
    return false;
  }

  if (
    (destination.protocol !== "http:" && destination.protocol !== "https:")
    || destination.origin !== current.origin
  ) {
    return false;
  }

  const isSameDocumentFragment =
    destination.pathname === current.pathname
    && destination.search === current.search
    && destination.hash.length > 0;

  return !isSameDocumentFragment;
}

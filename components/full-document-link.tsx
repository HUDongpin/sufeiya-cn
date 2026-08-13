"use client";

import { useEffect, useRef } from "react";
import type { AnchorHTMLAttributes, MouseEvent } from "react";

type FullDocumentLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onClick" | "onClickCapture" | "target"
> & {
  href: string;
};

export function FullDocumentLink({ href, ...props }: FullDocumentLinkProps) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    linkRef.current?.setAttribute("data-full-document-navigation-ready", "true");
  }, []);

  const navigateOutsideTheAppRouter = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    window.location.assign(event.currentTarget.href);
  };

  return (
    <a
      {...props}
      data-full-document-navigation="true"
      data-full-document-navigation-ready="false"
      href={href}
      ref={linkRef}
      target="_top"
      onClickCapture={navigateOutsideTheAppRouter}
    />
  );
}

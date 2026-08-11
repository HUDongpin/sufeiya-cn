import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "页面没有找到｜苏肥鸭多邻国",
  robots: { index: false, follow: false },
};

export default function AnonymousCatchAllPage() {
  notFound();
}

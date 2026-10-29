import { Splash } from "@/components/Splash";
import { env } from "@/lib/env";

export default function Loading() {
  return <Splash name={env.storeName()} />;
}

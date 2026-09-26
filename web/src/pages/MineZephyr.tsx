import MineGuide from "./MineGuide";

// /mine/zephyr - see MineGuide.tsx. One component, two coins; this file exists
// so routes.ts can name a distinct PageKey per URL.
export default function MineZephyr() {
  return <MineGuide coinId="zph" />;
}

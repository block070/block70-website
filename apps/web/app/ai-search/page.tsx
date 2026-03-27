import { AISearchChat } from "@/components/ai/ai-search-chat";

export const metadata = {
  title: "Crypto intelligence assistant · Block70",
  description:
    "Ask in natural language—narratives, coins, signals, sources, and whale context in one place. Not financial advice.",
};

export default function AISearchPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <AISearchChat />
    </div>
  );
}

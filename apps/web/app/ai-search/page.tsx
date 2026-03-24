import { AISearchChat } from "@/components/ai/ai-search-chat";

export const metadata = {
  title: "AI Crypto Assistant · Block70",
  description:
    "Structured crypto guidance: opportunities, Block70 scores, data snapshot, and clear next steps. Not financial advice.",
};

export default function AISearchPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <AISearchChat />
    </div>
  );
}

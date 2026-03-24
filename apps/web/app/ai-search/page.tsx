import { AISearchChat } from "@/components/ai/ai-search-chat";

export const metadata = {
  title: "AI Crypto Search · Block70",
  description:
    "Chat with Block70: streaming answers, Block70 scores, live coin data, and curated trade links. Not financial advice.",
};

export default function AISearchPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <AISearchChat />
    </div>
  );
}

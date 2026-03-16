import {
  LegalPageLayout,
  LegalSection,
  LegalParagraph,
} from "@/components/legal/legal-page-layout";

export const metadata = {
  title: "Financial Risk Disclaimer · Block70",
  description: "Cryptocurrency and investment risk disclaimer. Not financial advice.",
};

export default function DisclaimerPage() {
  return (
    <LegalPageLayout
      title="Financial Risk Disclaimer"
      lastUpdated="2025-01-01"
    >
      <LegalSection title="Risk of cryptocurrency investing">
        <LegalParagraph>
          Cryptocurrency and digital asset investing involves substantial risk,
          including the risk of loss of some or all of your capital. Prices can
          be highly volatile and may be influenced by regulatory, technical,
          market, and other factors beyond our control.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Signals and insights are informational">
        <LegalParagraph>
          All signals, insights, analytics, and content on Block70 are for
          informational and educational purposes only. They do not constitute
          recommendations to buy, sell, or hold any asset. Past performance of
          any signal, strategy, or metric does not guarantee future results.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Block70 is not financial advice">
        <LegalParagraph>
          <strong className="text-slate-200">
            Block70 does not provide financial, investment, legal, or tax advice.
          </strong>{" "}
          You should consult qualified professionals before making investment
          decisions. You are solely responsible for evaluating the risks and
          for your own trading and investment choices.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Past performance">
        <LegalParagraph>
          Past performance does not guarantee future results. Historical data,
          backtests, and performance metrics are not indicative of future
          outcomes. Any projections or hypothetical results may not be realized.
        </LegalParagraph>
      </LegalSection>
    </LegalPageLayout>
  );
}

import {
  LegalPageLayout,
  LegalSection,
  LegalParagraph,
} from "@/components/legal/legal-page-layout";

export const metadata = {
  title: "Data Accuracy Disclaimer · Block70",
  description: "Disclaimer on third-party data and accuracy of market and analytics data.",
};

export default function DataAccuracyPage() {
  return (
    <LegalPageLayout
      title="Data Accuracy Disclaimer"
      lastUpdated="2025-01-01"
    >
      <LegalSection title="Third-party sources">
        <LegalParagraph>
          Market data, prices, and other information displayed on Block70 may
          come from third-party sources, including exchanges, index providers,
          and data aggregators. We do not guarantee the accuracy, completeness,
          or timeliness of such data. Delays, errors, or omissions may occur.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="No guarantee of accuracy">
        <LegalParagraph>
          Block70 does not guarantee the accuracy of:{" "}
          <strong className="text-slate-200">market prices</strong>;{" "}
          <strong className="text-slate-200">signals</strong> (which are
          derived from various inputs and may be wrong);{" "}
          <strong className="text-slate-200">analytics</strong> (metrics,
          rankings, or scores); or{" "}
          <strong className="text-slate-200">wallet tracking</strong> (on-chain
          data may be incomplete or misattributed). You should verify
          important data through independent sources before making decisions.
        </LegalParagraph>
      </LegalSection>
    </LegalPageLayout>
  );
}

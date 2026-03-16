import {
  LegalPageLayout,
  LegalSection,
  LegalParagraph,
} from "@/components/legal/legal-page-layout";

export const metadata = {
  title: "API Terms · Block70",
  description: "API rate limits, commercial usage, data redistribution, and bot integrations.",
};

export default function ApiTermsPage() {
  return (
    <LegalPageLayout
      title="API Usage Terms"
      lastUpdated="2025-01-01"
    >
      <LegalSection title="API rate limits">
        <LegalParagraph>
          Use of the Block70 API is subject to rate limits as specified in our
          documentation and your plan. You must not exceed these limits or
          attempt to circumvent them (e.g., by using multiple keys for the same
          use case). We may throttle or suspend access for excessive or abusive
          use.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Commercial usage">
        <LegalParagraph>
          Commercial use of the API (e.g., in products or services you offer to
          third parties) may require a separate agreement or plan. You may not
          resell raw API access or use the API in a way that competes with
          Block70’s core offerings without our prior written consent.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Data redistribution">
        <LegalParagraph>
          You may not redistribute Block70 data (e.g., signals, insights,
          market data) to third parties in bulk or in a way that substitutes for
          direct use of our Services, unless expressly permitted in your
          agreement or plan. Attribution may be required where redistribution is
          allowed.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Bot integrations">
        <LegalParagraph>
          Bot and automated integrations must comply with our rate limits and
          documentation. You are responsible for ensuring your bots do not
          harm our systems or other users. We may revoke API keys used for
          abusive or unauthorized automation.
        </LegalParagraph>
      </LegalSection>
    </LegalPageLayout>
  );
}

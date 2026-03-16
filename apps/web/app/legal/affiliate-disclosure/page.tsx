import {
  LegalPageLayout,
  LegalSection,
  LegalParagraph,
} from "@/components/legal/legal-page-layout";

export const metadata = {
  title: "Affiliate Disclosure · Block70",
  description: "Disclosure of affiliate relationships and compensation.",
};

export default function AffiliateDisclosurePage() {
  return (
    <LegalPageLayout
      title="Affiliate Disclosure"
      lastUpdated="2025-01-01"
    >
      <LegalSection title="Disclosure">
        <LegalParagraph>
          Block70 may participate in affiliate programs. This means we may earn
          a commission or other compensation when you click on certain links or
          sign up for certain products or services mentioned on our platform.
          Such relationships do not influence our editorial content; we aim to
          provide useful and accurate information regardless of affiliate
          status.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Transparency">
        <LegalParagraph>
          Where we have a financial relationship with a product or service we
          mention, we will disclose that relationship where appropriate. Our
          goal is to be transparent with our users about how we may be
          compensated.
        </LegalParagraph>
      </LegalSection>
    </LegalPageLayout>
  );
}

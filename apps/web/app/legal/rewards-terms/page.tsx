import {
  LegalPageLayout,
  LegalSection,
  LegalParagraph,
} from "@/components/legal/legal-page-layout";

export const metadata = {
  title: "Rewards Program Terms · Block70",
  description: "Blocks have no cash value; subject to modification and abuse protection.",
};

export default function RewardsTermsPage() {
  return (
    <LegalPageLayout
      title="Rewards Program Terms"
      lastUpdated="2025-01-01"
    >
      <LegalSection title="No cash value">
        <LegalParagraph>
          Block70 rewards (e.g., “Blocks”) are in-platform points or units that
          have no cash value unless otherwise explicitly stated in writing. They
          cannot be exchanged for legal tender, cryptocurrency, or other
          monetary value except as permitted in specific reward redemption
          offers we may make available.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Modification or removal">
        <LegalParagraph>
          We may modify, pause, or discontinue the rewards program or any
          reward at any time. We may change the rules for earning, redeeming, or
          using rewards with reasonable notice where feasible. Continued
          participation after changes constitutes acceptance.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Abuse protection">
        <LegalParagraph>
          We reserve the right to take action against abuse, including
          multiple accounts, automated or fraudulent earning, or violation of
          program rules. Such action may include forfeiture of rewards,
          suspension or termination of account, and any other measures we deem
          necessary.
        </LegalParagraph>
      </LegalSection>
    </LegalPageLayout>
  );
}

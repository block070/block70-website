import {
  LegalPageLayout,
  LegalSection,
  LegalParagraph,
} from "@/components/legal/legal-page-layout";

export const metadata = {
  title: "Community Guidelines · Block70",
  description: "Rules for posting alpha, sharing signals, and strategy discussions.",
};

export default function CommunityGuidelinesPage() {
  return (
    <LegalPageLayout
      title="Community Content Policy (Community Guidelines)"
      lastUpdated="2025-01-01"
    >
      <LegalSection title="Rules for posting and sharing">
        <LegalParagraph>
          When posting alpha, sharing signals, or participating in strategy
          discussions, you must be honest and accurate. Do not fabricate data,
          fake screenshots, or misrepresent performance. Clearly distinguish
          between opinion and fact. Respect other users and avoid harassment,
          hate speech, or personal attacks.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Prohibited conduct">
        <LegalParagraph>
          The following are prohibited: <strong className="text-slate-200">Fraud</strong>—
          scams, phishing, or deceptive schemes.{" "}
          <strong className="text-slate-200">Market manipulation</strong>—pump-
          and-dump, wash trading, or coordinated misleading activity.{" "}
          <strong className="text-slate-200">Spam</strong>—repetitive,
          off-topic, or unauthorized promotional content.{" "}
          <strong className="text-slate-200">Misleading claims</strong>—false
          guarantees of returns, fake credentials, or impersonation. We may
          remove content and suspend or ban accounts that violate these rules.
        </LegalParagraph>
      </LegalSection>
    </LegalPageLayout>
  );
}

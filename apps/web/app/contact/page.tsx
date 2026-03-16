import { LegalPageLayout, LegalSection, LegalParagraph } from "@/components/legal/legal-page-layout";

export const metadata = {
  title: "Contact · Block70",
  description: "Contact Block70 for legal inquiries and support.",
};

const LEGAL_EMAIL = "legal@block70.com";

export default function ContactPage() {
  return (
    <LegalPageLayout title="Contact" lastUpdated="2025-01-01">
      <LegalSection title="Legal inquiries">
        <LegalParagraph>
          For legal inquiries, including privacy requests, terms, and
          compliance, please contact us at:{" "}
          <a
            href={`mailto:${LEGAL_EMAIL}`}
            className="font-medium text-emerald-400 hover:underline"
          >
            {LEGAL_EMAIL}
          </a>
        </LegalParagraph>
      </LegalSection>
      <LegalSection title="Data protection (GDPR and similar)">
        <LegalParagraph>
          If you are in the EEA, UK, or another jurisdiction with data
          protection laws, you may use the same email to exercise your rights
          (access, correction, erasure, portability, objection, or to lodge a
          complaint). We will respond within the timeframe required by
          applicable law.
        </LegalParagraph>
      </LegalSection>
    </LegalPageLayout>
  );
}

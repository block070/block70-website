import {
  LegalPageLayout,
  LegalSection,
  LegalParagraph,
} from "@/components/legal/legal-page-layout";

export const metadata = {
  title: "Cookie Policy · Block70",
  description: "Use of cookies for authentication, analytics, and preferences.",
};

export default function CookiePolicyPage() {
  return (
    <LegalPageLayout
      title="Cookie Policy"
      lastUpdated="2025-01-01"
    >
      <LegalSection title="Authentication">
        <LegalParagraph>
          We use cookies (and similar technologies) to keep you signed in and
          to manage your session. These are essential for the service to
          function and cannot be disabled if you wish to use your account.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Analytics">
        <LegalParagraph>
          We use cookies and similar technologies for analytics to understand
          how our site and features are used (e.g., page views, feature usage).
          This helps us improve the product. Analytics may be collected only
          after you have accepted non-essential cookies via our cookie consent
          banner, where required by law.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Preferences">
        <LegalParagraph>
          We store preferences (e.g., theme, language) in cookies or local
          storage so your choices persist across visits. You can clear these in
          your browser settings.
        </LegalParagraph>
      </LegalSection>
    </LegalPageLayout>
  );
}

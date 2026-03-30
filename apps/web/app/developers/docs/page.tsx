import { redirect } from "next/navigation";

/** Canonical API reference lives at /apidocs */
export default function DevelopersDocsRedirectPage() {
  redirect("/apidocs");
}

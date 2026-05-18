import { Suspense } from "react";
import { ResetPasswordPage } from "@/components/pages/auth/reset-password-page";

export default function Page() {
  return (
    <Suspense>
      <ResetPasswordPage />
    </Suspense>
  );
}
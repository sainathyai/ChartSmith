"use client";

import { Suspense } from "react";
import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { exchangeGoogleCodeForSession } from "@/lib/auth/actions/exchange-google-code";
import { logger } from "@/lib/utils/logger";

function GoogleCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error || !code) {
      window.opener?.postMessage({ type: 'google-auth', error: true }, window.location.origin);
      // Close popup on error
      setTimeout(() => {
        try {
          window.close();
        } catch (error) {
          console.warn("Could not close popup window:", error);
        }
      }, 100);
      return;
    }

    console.log("exchanging google code for session");
    exchangeGoogleCodeForSession(code)
      .then((jwt) => {
        try {
          const payload = JSON.parse(atob(jwt.split('.')[1]));
          console.log(payload);
          if (payload.isWaitlisted) {
            window.opener?.postMessage({ type: 'google-auth', jwt }, window.location.origin);
            if (window.opener) {
              window.opener.location.href = '/waitlist';
              setTimeout(() => {
                try {
                  window.close();
                } catch (error) {
                  console.warn("Could not close popup window:", error);
                }
              }, 100);
            } else {
              router.push('/waitlist');
            }
            return;
          }
        } catch (e) {
          logger.error("Failed to parse JWT:", e);
        }

        window.opener?.postMessage({ type: 'google-auth', jwt }, window.location.origin);
        // Close popup after sending message
        setTimeout(() => {
          try {
            window.close();
          } catch (error) {
            // COOP policy may block window.close(), user can close manually
            console.warn("Could not close popup window:", error);
          }
        }, 100);
      })
      .catch((error) => {
        logger.error("Auth Error:", error);
        window.opener?.postMessage({ type: 'google-auth', error: true }, window.location.origin);
        // Close popup on error too
        setTimeout(() => {
          try {
            window.close();
          } catch (error) {
            console.warn("Could not close popup window:", error);
          }
        }, 100);
      });
  }, [searchParams, router]);

  return null;
}

export default function GoogleCallbackPage() {
  return (
    <Suspense>
      <GoogleCallback />
    </Suspense>
  );
}

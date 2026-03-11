import { useEffect } from "react";

const SURVEY_URL = "https://docs.google.com/forms/d/e/1FAIpQLScUXCCslEWSXdU1XBZkRLmYyT4V05vKWuSZDTP1ObavV0O03Q/viewform?usp=sharing";

const FeedbackRedirect = () => {
  useEffect(() => {
    window.location.href = SURVEY_URL;
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-lg text-muted-foreground">Redirecting to feedback form…</p>
    </div>
  );
};

export default FeedbackRedirect;

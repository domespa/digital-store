import { LandingProvider } from "../../context/LandingContext";
import type { LandingPageProps } from "../../types/landing";

// ============================
//      IMPORT SEZIONI
// ============================
import HeroSect from "./sections/HeroSect";
import ProblemsSect from "./sections/ProblemsSect";
import FeaturesSect from "./sections/FeaturesSect";
import TestimonialSect from "./sections/TestimonialSect";

const LandingPageContent = () => {
  return (
    <div className="landing-page">
      <HeroSect />
      <ProblemsSect />
      <FeaturesSect />
      <TestimonialSect />
    </div>
  );
};

export default function LandingPage({
  config,
  className = "",
}: LandingPageProps) {
  return (
    <div className={`min-h-screen ${className}`}>
      <LandingProvider config={config}>
        <LandingPageContent />
      </LandingProvider>
    </div>
  );
}

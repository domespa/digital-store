// ===========================
//           LANDING TYPES
// ===========================
export interface HeroConfig {
  title: string;
  subtitle: string;
  image: string;
  ctaText: string;
}

export interface LandingUser {
  country: string;
  currency: string;
  latitude: number;
  longitude: number;
}

export interface LandingContextType {
  config: LandingConfig | null;

  user: LandingUser | null;

  isLoading: boolean;
}

// PROB
export interface Problem {
  id: string;
  icon: string;
  title: string;
  description: string;
  painPoints: string[];
}

export interface ProblemsConfig {
  title: string;
  subtitle: string;
  problems: Problem[];
}

// FEATURES
export interface Feature {
  id: string;
  icon: string;
  title: string;
  description: string;
  benefits: string[];
}

export interface Bonus {
  id: string;
  title: string;
  description: string;
  value: number;
  icon: string;
}

// PRICING
export interface PricingHighlight {
  icon: string;
  title: string;
  description: string;
}

export interface PricingBonus {
  title: string;
  description: string;
  value: number;
}

export interface PricingUrgency {
  enabled: boolean;
  message: string;
  countdown?: boolean;
}

export interface PricingConfig {
  title: string;
  subtitle: string;
  mainPrice: number;
  originalPrice: number;
  currency: string;
  included: string[];
  highlights: PricingHighlight[];
  guarantees: string[];
  urgency?: PricingUrgency;
  bonuses?: PricingBonus[];
}

export interface FeaturesConfig {
  title: string;
  subtitle: string;
  features: Feature[];
  bonuses: Bonus[];
}

// TESTIM
export interface Testimonial {
  id: string;
  name: string;
  title?: string;
  location?: string;
  content: string;
  rating: number;
  before?: string;
  after?: string;
}

export interface TestimonialsConfig {
  title: string;
  subtitle: string;
  testimonials: Testimonial[];
}

// FAQ
export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export interface FAQConfig {
  title: string;
  subtitle: string;
  faqs: FAQ[];
}

export interface LandingConfig {
  productId: string;
  hero: HeroConfig;
  problems: ProblemsConfig;
  features: FeaturesConfig;
  testimonials: TestimonialsConfig;
  faq: FAQConfig;
  pricing: PricingConfig;
  settings: {
    theme: "default" | "dark" | "minimal";
    colors: { primary: string; secondary: string; accent: string };
    showCountdown?: boolean;
    countdownEnd?: string;
    currency: string;
  };
}

export interface LandingPageProps {
  config: LandingConfig;
  className?: string;
}

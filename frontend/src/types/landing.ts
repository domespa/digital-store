// ===========================
//           LANDING TYPES
// ===========================
export interface HeroConfig {
  title: string;
  subtitle: string;
  image: string;
  ctaText: string;
  subtext?: string;
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
  emotionalHook: string;
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
  valueStack?: Array<{
    item: string;
    value: number | string;
  }>;
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

export interface TrustBarConfig {
  stats: Array<{
    number: string;
    label: string;
    icon?: string;
  }>;
  trustedBy?: string;
  logos?: Array<{
    name: string;
    url: string;
  }>;
}

export interface UrgencyConfig {
  enabled: boolean;
  endDate: string;
  message: string;
  urgencyText: string;
  showStock?: boolean;
  stockRemaining?: number;
}

export interface ContentPreviewConfig {
  title: string;
  subtitle: string;
  totalPages: number;
  chapters: Array<{
    number: number;
    title: string;
    description: string;
    highlights?: string[];
  }>;
}

export interface FinalCtaConfig {
  title: string;
  subtitle: string;
  ctaText: string;
  guaranteeText: string;
  urgencyMessage?: string;
  stats: string[];
}

export interface StickyBarConfig {
  enabled: boolean;
  text: string;
  ctaText: string;
  showTimer: boolean;
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
  trustBar: TrustBarConfig;
  urgency: UrgencyConfig;
  contentPreview: ContentPreviewConfig;
  finalCta: FinalCtaConfig;
  stickyBar: StickyBarConfig;
}

export interface LandingPageProps {
  config: LandingConfig;
  className?: string;
}

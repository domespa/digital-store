import type { LandingConfig } from "../../types/landing";

export const adhdWomenConfig: LandingConfig = {
  productId: "",

  // HEROSECT //
  hero: {
    title: "Stop Feeling Invisible",
    subtitle:
      "The complete guide every ADHD woman was waiting for to transform chaos into control and finally live the life you deserve",
    image: "dopo",
    ctaText: "START YOUR TRANSFORMATION NOW",
  },

  // PROBLEMSSECT
  problems: {
    title: "Do You Recognize Yourself in These Situations?",
    subtitle:
      "If you answered YES to even one of these questions, you're not alone. Millions of women live this invisible reality every day.",
    problems: [
      {
        id: "overwhelm",
        icon: "😰",
        title: "Constant Emotional Overwhelm",
        description:
          "You always feel overwhelmed, like you're always running behind on everything, with the feeling that life is slipping out of your hands.",
        painPoints: [
          "Sudden crying spells for no apparent reason",
          "Feeling like you're never good enough",
          "Difficulty managing intense emotions",
          "Shame for not being able to do 'simple' things",
        ],
      },
      {
        id: "chaos",
        icon: "🌪️",
        title: "Total Organizational Chaos",
        description:
          "Your home, your work, your mind always seem to be in disorder, despite all your efforts to get organized.",
        painPoints: [
          "Piles of papers, clothes, objects everywhere",
          "Forgotten or mixed up appointments",
          "Projects started but never finished",
          "Constantly losing keys, documents, phone",
        ],
      },
      {
        id: "relationships",
        icon: "😔",
        title: "Complicated Relationships",
        description:
          "People don't understand why you're 'like this', they judge you as lazy or scatter-brained, and you start believing it too.",
        painPoints: [
          "Partner frustrated by your 'forgetfulness'",
          "Friendships lost due to unmet commitments",
          "Colleagues who think you're uninterested",
          "Children who suffer from your disorganization",
        ],
      },
      {
        id: "energy",
        icon: "⚡",
        title: "Dysregulated Energy",
        description:
          "You go from moments of extreme hyperactivity to periods of total exhaustion, without being able to find balance.",
        painPoints: [
          "Sleepless nights with racing mind",
          "Days when you can't get out of bed",
          "Impulsivity that leads to wrong decisions",
          "Difficulty relaxing and turning off your mind",
        ],
      },
      {
        id: "self_esteem",
        icon: "💔",
        title: "Rock-Bottom Self-Esteem",
        description:
          "Years of 'failures' have convinced you that you're wrong, different, inadequate. But that's not true.",
        painPoints: [
          "Constant comparisons with other 'better' women",
          "Perpetual guilt about everything",
          "Fear of others' judgment",
          "Conviction of being an 'impostor'",
        ],
      },
      {
        id: "masking",
        icon: "🎭",
        title: "Constant Masking",
        description:
          "You pretend to be 'normal' all day, but inside you're dying from the fatigue of playing a role that doesn't belong to you.",
        painPoints: [
          "Exhausted from maintaining the facade",
          "Fear that they'll discover 'how you really are'",
          "Loss of your true identity",
          "Emotional isolation even when surrounded by people",
        ],
      },
    ],
  },

  // FEATURESSECT
  features: {
    title: "What You'll Get With This Revolutionary Ebook",
    subtitle:
      "It's not just another book about ADHD. It's the complete system that will forever transform your relationship with yourself and your neurodivergence.",
    features: [
      {
        id: "understanding",
        icon: "🧠",
        title: "Truly Understand Your ADHD Brain",
        description:
          "Discover how your neurodivergent mind really works and why you've always struggled with things that seem simple to others.",
        benefits: [
          "Scientific foundations of ADHD in women",
          "Why female symptoms are different",
          "How ADHD affects emotions and relationships",
          "Personalized self-assessment tests",
        ],
      },
      {
        id: "superpowers",
        icon: "⚡",
        title: "Transform Chaos Into Superpowers",
        description:
          "Learn to see your differences not as flaws to hide, but as unique strengths to celebrate and use.",
        benefits: [
          "Identify your hidden ADHD talents",
          "Strategies to harness hyperfocus",
          "How to transform impulsivity into creativity",
          "Techniques for managing variable energy",
        ],
      },
      {
        id: "organization",
        icon: "🎯",
        title: "ADHD-Friendly Organization System",
        description:
          "Forget traditional methods that don't work. Discover strategies created specifically for the female ADHD brain.",
        benefits: [
          "Organization methods that respect your rhythms",
          "Personalized time management techniques",
          "Strategies to complete started projects",
          "Simple and effective priority system",
        ],
      },
      {
        id: "self_worth",
        icon: "💝",
        title: "Rebuild Your Self-Esteem",
        description:
          "Free yourself definitively from shame, guilt, and destructive self-criticism that has accompanied you for years.",
        benefits: [
          "Techniques to stop negative internal dialogue",
          "Strategies to manage rejection sensitivity",
          "How to build healthy boundaries in relationships",
          "ADHD-specific self-compassion exercises",
        ],
      },
    ],
    bonuses: [
      {
        id: "workbook",
        title: "Interactive Workbook (PDF)",
        description:
          "50+ practical exercises and printable worksheets to immediately apply the book's strategies",
        value: 47,
        icon: "📝",
      },
      {
        id: "audio",
        title: "Complete Audio Version",
        description:
          "The entire ebook read by a professional voice, perfect for those with concentration difficulties",
        value: 29,
        icon: "🎧",
      },
      {
        id: "checklist",
        title: "Daily ADHD Checklists",
        description:
          "10 ready-made templates to organize your days without overwhelm",
        value: 19,
        icon: "✅",
      },
    ],
  },

  // TESTIMONIALSECT
  testimonials: {
    title: "What Women Who Have Already Transformed Their Lives Say",
    subtitle:
      "Real stories of women who have overcome ADHD and now live with confidence and control",
    testimonials: [
      {
        id: "maria",
        name: "Maria Johnson",
        title: "Entrepreneur",
        location: "New York",
        content:
          "For 35 years I thought I was broken. This ebook made me understand that my brain is just different, not defective. Now I run my company with a clarity I never had before.",
        rating: 5,
        before: "Constantly overwhelmed, projects never finished",
        after: "Confident CEO, well-organized team",
      },
      {
        id: "sarah",
        name: "Sarah Davis",
        title: "Mother of 2",
        location: "California",
        content:
          "I finally found strategies that really work for an ADHD mom. My family now lives in an organized home and I've found the peace I had lost.",
        rating: 4,
        before: "Chaotic home, constant guilt",
        after: "Functional routines, peaceful family",
      },
      {
        id: "jennifer",
        name: "Jennifer Wilson",
        title: "College Student",
        location: "Texas",
        content:
          "Studying had become a nightmare. Thanks to this system I learned to study with my ADHD, not against it. My GPA went from 2.4 to 3.8!",
        rating: 5,
        before: "Low grades, study anxiety",
        after: "High GPA, effective study habits",
      },
    ],
  },

  // FAQ
  faq: {
    title: "Frequently Asked Questions",
    subtitle: "We've answered the most common questions from our readers",
    faqs: [
      {
        id: "diagnosis",
        question:
          "Is this ebook suitable for me if I don't have an official ADHD diagnosis?",
        answer:
          "Absolutely yes! Many women discover they have ADHD precisely by reading content like this. The ebook will help you understand if your symptoms are compatible with ADHD and give you practical tools regardless of formal diagnosis.",
        category: "product",
      },
      {
        id: "results",
        question: "How long does it take to see results?",
        answer:
          "Many readers report positive changes within the first few weeks. However, complete transformation requires time and consistent practice. Most women see significant results within 2-3 months of consistently applying the strategies.",
        category: "product",
      },
      {
        id: "format",
        question: "Is it available in audio format?",
        answer:
          "Yes! The ebook also includes the professional audio version, perfect for those with concentration difficulties in reading or who prefer to listen during commutes.",
        category: "product",
      },
      {
        id: "guarantee",
        question: "How does the money-back guarantee work?",
        answer:
          "You have a full 30 days to try the ebook. If you're not satisfied for any reason, just send an email and you'll receive a complete refund, no questions asked.",
        category: "payment",
      },
      {
        id: "sharing",
        question: "Can I share the ebook with other people?",
        answer:
          "The ebook is copyright protected for personal use. If you know other women who might benefit, we encourage you to purchase separate copies or share the link to this page.",
        category: "product",
      },
    ],
  },

  // PRICING
  pricing: {
    title: "Transform Your ADHD Life Today",
    subtitle:
      "Everything you need to go from chaos to control - complete system, not just a book",

    mainPrice: 47,
    originalPrice: 197,
    currency: "USD",

    included: [
      "Complete 200+ Page ADHD Guide",
      "10 Comprehensive Chapters",
      "Interactive Worksheets & Checklists",
      "Morning Routine Templates",
      "Symptom Tracking Templates",
      "Professional Resource Directory",
      "Crisis Support Resources",
      "Lifetime Access & Updates",
    ],

    highlights: [
      {
        icon: "📚",
        title: "10 In-Depth Chapters",
        description:
          "From late diagnosis to motherhood, relationships to workplace success",
      },
      {
        icon: "🧠",
        title: "Female-Focused Content",
        description:
          "Written specifically for how ADHD manifests in women's brains and bodies",
      },
      {
        icon: "⚡",
        title: "Practical Strategies",
        description:
          "Real techniques from women who've transformed their ADHD lives",
      },
      {
        icon: "📋",
        title: "Ready-to-Use Templates",
        description:
          "Morning routines, tracking sheets, checklists - everything ready to print",
      },
    ],

    guarantees: [
      "Instant digital download",
      "Works on all devices",
      "Based on real research & testimonials",
    ],
  },

  // SETTINGS
  settings: {
    theme: "default",
    colors: {
      primary: "#7C3AED",
      secondary: "#EC4899",
      accent: "#F59E0B",
    },
    showCountdown: true,
    countdownEnd: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    currency: "USD",
  },
};

export default adhdWomenConfig;

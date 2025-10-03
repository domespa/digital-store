import type { LandingConfig } from "../../types/landing";

export const adhdWomenConfig: LandingConfig = {
  productId: "cmgagj3jr00044emfdvtzucfb",

  hero: {
    title: "Finally Understand Why Your Brain Works Differently",
    subtitle:
      "The evidence-based guide that helped 15,000+ women transform their ADHD from a daily struggle into their greatest strength",
    image: "dopo",
    ctaText: "Get Instant Access Now",
    subtext:
      "Instant digital download • Works on all devices • Lifetime access",
  },

  trustBar: {
    stats: [
      { number: "15,247", label: "Women Helped", icon: "👩" },
      { number: "4.9/5", label: "Average Rating", icon: "⭐" },
      { number: "98%", label: "Would Recommend", icon: "💝" },
      { number: "Instant", label: "Digital Download", icon: "⚡" },
    ],
    trustedBy: "As featured in women's health communities worldwide",
  },

  urgency: {
    enabled: true,
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    message: "Limited Time: Get the Complete Bundle at 77% OFF",
    urgencyText: "Price increases to $118 in:",
    showStock: true,
    stockRemaining: 47,
  },

  problems: {
    title: "Do Any of These Sound Familiar?",
    subtitle:
      "If you nodded yes to even one, you're not alone. Over 6 million women in the US live with undiagnosed or misunderstood ADHD.",
    emotionalHook:
      "You're not lazy. You're not broken. You're not 'too much.' Your brain just works differently—and that's exactly why nothing you've tried has worked.",
    problems: [
      {
        id: "overwhelm",
        icon: "😰",
        title: "The Constant Mental Overwhelm",
        description:
          "Your mind races with a thousand thoughts, yet you can't focus on the one thing that matters right now.",
        painPoints: [
          "Starting your day already exhausted from the chaos in your head",
          "Feeling paralyzed when you have too many tasks",
          "Crying out of frustration because 'simple' things feel impossible",
          "Beating yourself up for not being 'normal'",
        ],
      },
      {
        id: "chaos",
        icon: "🌪️",
        title: "The Organizational Nightmare",
        description:
          "Despite buying every planner and trying every system, your life still feels like controlled chaos at best.",
        painPoints: [
          "Losing important items daily (keys, phone, documents)",
          "Missing appointments you swore you wrote down",
          "Piles of 'I'll deal with this later' everywhere",
          "Starting 10 projects but finishing none",
        ],
      },
      {
        id: "relationships",
        icon: "💔",
        title: "The Relationship Strain",
        description:
          "The people you love don't understand, and their judgment cuts deeper than they know.",
        painPoints: [
          "Your partner calling you 'forgetful' or 'careless'",
          "Friends who stopped inviting you because you 'always cancel'",
          "Coworkers who think you're not trying hard enough",
          "Feeling like you're failing everyone who matters",
        ],
      },
      {
        id: "masking",
        icon: "🎭",
        title: "The Exhausting Mask",
        description:
          "You spend so much energy pretending to be 'normal' that you've forgotten who you really are.",
        painPoints: [
          "Coming home completely drained from 'performing' all day",
          "Fear of people discovering the 'real' messy you",
          "Wondering if anyone would love you without the mask",
          "Losing yourself in the role you think you should play",
        ],
      },
      {
        id: "self_worth",
        icon: "😔",
        title: "The Shame Spiral",
        description:
          "Years of 'not measuring up' have convinced you that something is fundamentally wrong with you.",
        painPoints: [
          "Believing you're the problem in every situation",
          "Constant comparison to women who 'have it together'",
          "Feeling like an impostor in your own life",
          "Secret fear that you'll never be enough",
        ],
      },
      {
        id: "energy",
        icon: "⚡",
        title: "The Energy Rollercoaster",
        description:
          "From hyperactive to completely burned out, sometimes within the same day, with no middle ground.",
        painPoints: [
          "3 AM and your brain won't shut off",
          "Noon and you can't get out of bed",
          "Impulsive decisions you regret hours later",
          "Never knowing which version of yourself will show up",
        ],
      },
    ],
  },

  contentPreview: {
    title: "Everything You Need to Finally Understand and Manage Your ADHD",
    subtitle:
      "Not just theory—practical strategies from women who've been exactly where you are",
    totalPages: 200,
    chapters: [
      {
        number: 1,
        title: "The Hidden Face of Female ADHD",
        description:
          "Why women go undiagnosed for decades and why your symptoms look nothing like the 'textbook' definition",
        highlights: [
          "The 3 types of ADHD and why women present differently",
          "Why masking makes diagnosis harder",
          "Common misdiagnoses that delay treatment",
        ],
      },
      {
        number: 2,
        title: "Your ADHD Brain Explained",
        description:
          "The neuroscience behind why your brain works differently (and why that's actually a strength)",
        highlights: [
          "How ADHD affects executive function",
          "Why emotions feel so intense",
          "The hidden gifts of ADHD thinking",
        ],
      },
      {
        number: 3,
        title: "The Late Diagnosis Journey",
        description:
          "Processing your diagnosis and healing from years of misunderstanding yourself",
        highlights: [
          "The 5 stages of ADHD diagnosis grief",
          "Reframing your past with new understanding",
          "Building self-compassion after diagnosis",
        ],
      },
      {
        number: 4,
        title: "Hormones & Your ADHD",
        description:
          "How your menstrual cycle, pregnancy, and menopause dramatically affect your symptoms",
        highlights: [
          "Tracking symptoms with your cycle",
          "Managing ADHD during pregnancy",
          "Perimenopause and ADHD intensification",
        ],
      },
      {
        number: 5,
        title: "Daily Strategies That Actually Work",
        description:
          "ADHD-friendly systems that work WITH your brain, not against it",
        highlights: [
          "The 2-minute rule that changed everything",
          "Time-blocking for ADHD brains",
          "Beating procrastination without willpower",
        ],
      },
      {
        number: 6,
        title: "Relationships, Work & Social Life",
        description:
          "Practical communication strategies and boundary-setting for every relationship",
        highlights: [
          "Explaining ADHD to your partner effectively",
          "Workplace accommodations you deserve",
          "Managing rejection sensitive dysphoria",
        ],
      },
      {
        number: 7,
        title: "ADHD Motherhood",
        description:
          "Managing your ADHD while raising kids (who might have ADHD too)",
        highlights: [
          "Morning routines that actually work",
          "Managing mom guilt",
          "Modeling healthy ADHD management for kids",
        ],
      },
      {
        number: 8,
        title: "Treatment Options",
        description:
          "Everything from medication to therapy to lifestyle interventions",
        highlights: [
          "Medication guide for women",
          "CBT techniques for ADHD",
          "Exercise, nutrition, and sleep strategies",
        ],
      },
      {
        number: 9,
        title: "Real Stories from Real Women",
        description:
          "Transformation stories from women who stopped struggling and started thriving",
        highlights: [
          "Late diagnosis experiences",
          "Career breakthroughs after diagnosis",
          "Relationship healing journeys",
        ],
      },
      {
        number: 10,
        title: "Resources & Next Steps",
        description: "Your complete action plan plus every resource you need",
        highlights: [
          "Finding ADHD-competent professionals",
          "Online communities and support groups",
          "Symptom tracking templates",
        ],
      },
    ],
  },

  features: {
    title: "Transform Your ADHD from Struggle to Strength",
    subtitle:
      "This isn't just information—it's a complete transformation system based on real science and real women's experiences",
    features: [
      {
        id: "understanding",
        icon: "🧠",
        title: "Finally Understand Why You've Struggled",
        description:
          "Discover the science behind female ADHD and why traditional advice never worked for you",
        benefits: [
          "Why only 25% of ADHD diagnoses are women (and what this means)",
          "The 3 ADHD presentations and why inattentive type is invisible",
          "How masking costs you energy and authenticity every single day",
          "Self-assessment tests used by actual clinicians",
        ],
      },
      {
        id: "hormones",
        icon: "🌙",
        title: "Master Your Hormonal Cycles",
        description:
          "Learn how your menstrual cycle, pregnancy, and menopause dramatically change your ADHD symptoms",
        benefits: [
          "Track symptom patterns with your cycle for better management",
          "Why week 3-4 of your cycle feels impossible (and what to do)",
          "Managing ADHD during pregnancy without medication",
          "Perimenopause strategies when symptoms intensify",
        ],
      },
      {
        id: "strategies",
        icon: "⚡",
        title: "Systems That Actually Work for ADHD Brains",
        description:
          "Forget rigid schedules. Get flexible strategies designed for how your brain actually works",
        benefits: [
          "The 2-minute rule that stops procrastination instantly",
          "Time-blocking without the rigidity that makes you quit",
          "How to finish projects without willpower or motivation",
          "Body-doubling techniques for remote work",
        ],
      },
      {
        id: "relationships",
        icon: "💝",
        title: "Heal Your Relationships & Self-Worth",
        description:
          "Stop the shame spiral. Communicate your needs without guilt. Set boundaries that protect your energy.",
        benefits: [
          "Scripts to explain ADHD to partners, family, and coworkers",
          "Managing Rejection Sensitive Dysphoria (RSD) effectively",
          "How to stop masking and show up authentically",
          "Self-compassion practices specifically for ADHD women",
        ],
      },
    ],
    bonuses: [
      {
        id: "workbook",
        title: "50+ Page Interactive Workbook",
        description:
          "Self-assessment tests, symptom trackers, and exercises you can start using today to see immediate changes",
        value: 47,
        icon: "📝",
      },
      {
        id: "audio",
        title: "Professional Audiobook (8+ Hours)",
        description:
          "Listen while doing dishes, driving, or walking. Perfect for ADHD brains that can't sit still to read",
        value: 29,
        icon: "🎧",
      },
      {
        id: "templates",
        title: "ADHD-Friendly Template Library",
        description:
          "Morning routines, meal planning, cycle tracking sheets, and crisis management tools - all ready to print",
        value: 19,
        icon: "✅",
      },
      {
        id: "resources",
        title: "Professional Resource Directory",
        description:
          "Finding ADHD-competent therapists, psychiatrists, and coaches who actually understand female ADHD",
        value: 15,
        icon: "🏥",
      },
    ],
  },

  testimonials: {
    title: "Real Women, Real Transformations",
    subtitle:
      "These aren't paid reviews—they're authentic stories from women who finally found answers",
    testimonials: [
      {
        id: "maria",
        name: "Maria J.",
        title: "Entrepreneur, Age 37",
        location: "New York",
        content:
          "I spent 35 years thinking I was broken. This guide helped me understand my brain isn't defective—it's just different. Now I run my company with clarity I never thought possible.",
        rating: 5,
        before: "Overwhelmed, chaotic, projects never finished",
        after: "Confident CEO with organized systems that work",
      },
      {
        id: "sarah",
        name: "Sarah D.",
        title: "Mother of 3",
        location: "California",
        content:
          "The mom guilt was crushing me. These strategies actually work for ADHD moms—not generic advice, but real solutions. My kids finally have the present mom they deserve.",
        rating: 5,
        before: "Chaotic home, constant guilt, always forgetting things",
        after: "Functional routines, peaceful family life",
      },
      {
        id: "jennifer",
        name: "Jennifer W.",
        title: "Graduate Student",
        location: "Texas",
        content:
          "Studying with ADHD felt impossible. This system taught me to work WITH my brain, not against it. My GPA went from 2.4 to 3.8 in one semester.",
        rating: 5,
        before: "Failing grades, study anxiety, procrastination",
        after: "Dean's list, effective study habits, confidence",
      },
    ],
  },

  faq: {
    title: "Common Questions Answered",
    subtitle:
      "Everything you need to know before you start your transformation",
    faqs: [
      {
        id: "diagnosis",
        question:
          "I don't have an official diagnosis. Is this guide still for me?",
        answer:
          "Absolutely. Many women discover they have ADHD through content like this. The guide helps you understand if your symptoms match ADHD and gives you practical tools regardless of formal diagnosis. Plus, it includes guidance on getting professionally evaluated if you choose to.",
        category: "product",
      },
      {
        id: "results",
        question: "How quickly will I see results?",
        answer:
          "Most women report feeling understood and validated within the first chapter. Practical changes often begin within 1-2 weeks of implementing the strategies. Complete transformation is a journey—most women see significant life changes within 2-3 months of consistent application.",
        category: "product",
      },
      {
        id: "format",
        question: "What formats do I get?",
        answer:
          "You receive the complete PDF (optimized for all devices), the full audiobook (professionally narrated), the interactive workbook, and all bonus templates. Everything downloads instantly—no shipping, no waiting.",
        category: "product",
      },
      {
        id: "digital",
        question: "What happens after I purchase?",
        answer:
          "You'll receive instant access to download all materials (PDF, audiobook, workbook, templates). Everything is yours to keep forever, and you'll receive all future updates at no additional cost. All sales are final for digital products.",
        category: "product",
      },
      {
        id: "scientific",
        question: "Is this based on real science?",
        answer:
          "Yes. Every strategy is grounded in current ADHD research and neuroscience, combined with real-world experiences from thousands of women. The guide includes references to peer-reviewed studies and clearly distinguishes between clinical evidence and personal testimonials.",
        category: "product",
      },
    ],
  },

  pricing: {
    title: "Your Complete ADHD Transformation System",
    subtitle:
      "Everything you need to finally understand your brain and build a life that works for you",
    mainPrice: 27,
    originalPrice: 118,
    currency: "USD",
    valueStack: [
      { item: "Complete 200+ Page Guide", value: 47 },
      { item: "Professional Audiobook (8+ Hours)", value: 29 },
      { item: "Interactive Workbook (50+ Pages)", value: 19 },
      { item: "Template Library (30+ Tools)", value: 15 },
      { item: "Resource Directory", value: 8 },
      { item: "Lifetime Updates", value: "FREE" },
    ],
    included: [
      "Complete 200+ Page ADHD Guide (PDF)",
      "Professional Audiobook Version (8+ Hours)",
      "Interactive Workbook with 50+ Exercises",
      "30+ Ready-to-Use Templates",
      "Morning Routine Templates",
      "Symptom & Cycle Tracking Sheets",
      "Professional Resource Directory",
      "Crisis Support Resources",
      "Lifetime Access & All Future Updates",
    ],
    highlights: [
      {
        icon: "📚",
        title: "10 Comprehensive Chapters",
        description:
          "From diagnosis to daily management, relationships to motherhood",
      },
      {
        icon: "🧠",
        title: "Female-Specific Content",
        description:
          "Written specifically for how ADHD manifests in women's brains and bodies",
      },
      {
        icon: "⚡",
        title: "Actionable Strategies",
        description:
          "Not just theory—proven techniques from women who've transformed their lives",
      },
      {
        icon: "📋",
        title: "Ready-to-Use Tools",
        description:
          "Templates, trackers, and checklists you can implement today",
      },
    ],
    guarantees: [
      "Instant digital download - start reading in 2 minutes",
      "Lifetime access - yours forever, including all future updates",
      "Works on any device - phone, tablet, computer, e-reader",
      "Secure payment processing with SSL encryption",
    ],
  },

  finalCta: {
    title: "Your ADHD Doesn't Have to Control Your Life Anymore",
    subtitle:
      "Join 15,247 women who've transformed from struggling to thriving. Your transformation starts the moment you click below.",
    ctaText: "Yes, I'm Ready to Transform My Life",
    guaranteeText:
      "Instant digital access. Lifetime updates included. Secure payment processing.",
    urgencyMessage:
      "The price increases to $118 soon. Get lifetime access at today's special price.",
    stats: [
      "15,247 women helped",
      "4.9/5 star rating",
      "98% recommend to friends",
    ],
  },

  stickyBar: {
    enabled: true,
    text: "Get the Complete Bundle - Only $27 (77% OFF)",
    ctaText: "Get Instant Access",
    showTimer: true,
  },

  settings: {
    theme: "default",
    colors: {
      primary: "#7C3AED",
      secondary: "#EC4899",
      accent: "#10B981",
    },
    showCountdown: true,
    countdownEnd: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    currency: "USD",
  },
};

export default adhdWomenConfig;

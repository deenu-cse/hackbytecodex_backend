const JWT = {
    SUPER_ADMIN_SECRET: process.env.SUPER_ADMIN_SECRET,
    CORE_TEAM_SECRET: process.env.CORE_TEAM_SECRET,
    COLLEGE_LEAD_SECRET: process.env.COLLEGE_LEAD_SECRET,
    CLUB_ADMIN_SECRET: process.env.CLUB_ADMIN_SECRET,
    MENTOR_SECRET: process.env.MENTOR_SECRET,
    STUDENT_SECRET: process.env.STUDENT_SECRET,
    EPU_SECRET: process.env.EPU_SECRET,
    API_JUDGE_SECRET: process.env.API_JUDGE_SECRET,

    EXPIRE_IN: process.env.JWT_EXPIRE_IN || "7d",
    EPU_EXPIRE_IN: process.env.EPU_JWT_EXPIRE_IN || "30d",
    API_JUDGE_EXPIRE_IN: process.env.API_JUDGE_JWT_EXPIRE_IN || "1d"
};

const USER_TYPE = {
    SUPER_ADMIN: "SUPER_ADMIN",
    CORE_TEAM: "CORE_TEAM",
    COLLEGE_LEAD: "COLLEGE_LEAD",
    CLUB_ADMIN: "CLUB_ADMIN",
    MENTOR: "MENTOR",
    STUDENT: "STUDENT",
    EVENT_PLATFORM_USER: "EVENT_PLATFORM_USER",
    API_JUDGE: "API_JUDGE"
};

const ROLE_JWT_SECRET_MAP = {
    [USER_TYPE.SUPER_ADMIN]: JWT.SUPER_ADMIN_SECRET,
    [USER_TYPE.CORE_TEAM]: JWT.CORE_TEAM_SECRET,
    [USER_TYPE.COLLEGE_LEAD]: JWT.COLLEGE_LEAD_SECRET,
    [USER_TYPE.CLUB_ADMIN]: JWT.CLUB_ADMIN_SECRET,
    [USER_TYPE.MENTOR]: JWT.MENTOR_SECRET,
    [USER_TYPE.STUDENT]: JWT.STUDENT_SECRET,
    [USER_TYPE.EVENT_PLATFORM_USER]: JWT.EPU_SECRET,
    [USER_TYPE.API_JUDGE]: JWT.API_JUDGE_SECRET
};

const API_TIER = {
    BASIC: "BASIC",
    PRO: "PRO",
    ENTERPRISE: "ENTERPRISE"
};

const API_TIER_LIMITS = {
    [API_TIER.BASIC]: {
        eventsPerMonth: 5,
        regsPerEvent: 100,
        judgesPerEvent: 3,
        analyticsLevel: "BASIC",
        rateLimit: 30,
        keyExpiryDays: 30
    },
    [API_TIER.PRO]: {
        eventsPerMonth: 25,
        regsPerEvent: 1000,
        judgesPerEvent: 15,
        analyticsLevel: "FULL",
        rateLimit: 120,
        keyExpiryDays: 90
    },
    [API_TIER.ENTERPRISE]: {
        eventsPerMonth: null,
        regsPerEvent: null,
        judgesPerEvent: null,
        analyticsLevel: "FULL",
        rateLimit: 500,
        keyExpiryDays: 365
    }
};

const API_PLAN_PRICING = {
    [API_TIER.BASIC]: { monthly: 49900, yearly: 499900 },
    [API_TIER.PRO]: { monthly: 199900, yearly: 1999900 },
    [API_TIER.ENTERPRISE]: { monthly: 599900, yearly: 5999900 }
};

const ANALYTICS_LEVEL_HIERARCHY = {
    BASIC: 1,
    FULL: 2
};

const PERFORMANCE_RULES = {
  EVENT_CREATED: 5,
  HACKATHON_HOSTED: 15,
  INTER_COLLEGE_EVENT: 10,
  COLLEGE_ONBOARDED: 20,

  MONTHLY_REPORT_SUBMITTED: 5,
  LATE_REPORT_PENALTY: -5
};

const BADGES = {
  TOP_PERFORMER: "Top Performer",
  BEST_HACKATHON_HOST: "Best Hackathon Host",
  FASTEST_GROWING_CHAPTER: "Fastest Growing Chapter",
  COMMUNITY_BUILDER: "Community Builder",
  WOMEN_IN_TECH: "Women in Tech Champion"
};

const REWARD_TIERS = {
    BRONZE: {
        name: "BRONZE",
        minPoints: 0,
        maxPoints: 40,
        perks: [
            "Certificate of Participation",
            "Community Badge"
        ]
    },

    SILVER: {
        name: "SILVER",
        minPoints: 41,
        maxPoints: 70,
        perks: [
            "HackByteCodex Swag",
            "Priority Event Access",
            "LinkedIn Shoutout"
        ]
    },

    GOLD: {
        name: "GOLD",
        minPoints: 71,
        maxPoints: 85,
        perks: [
            "Internship Eligibility",
            "Letter of Recommendation",
            "Paid Workshop Access"
        ]
    },

    PLATINUM: {
        name: "PLATINUM",
        minPoints: 86,
        maxPoints: 100,
        perks: [
            "National Leadership Role",
            "Stipend / Revenue Share",
            "CSR Project Ownership"
        ]
    }
};

const LEADERBOARD_TYPE = {
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  YEARLY: "YEARLY"
};


const getRewardTierByPoints = (points = 0) => {
  return Object.values(REWARD_TIERS).find(
    tier => points >= tier.minPoints && points <= tier.maxPoints
  )?.name || "BRONZE";
};

module.exports = {
    JWT,
    ROLE_JWT_SECRET_MAP,
    USER_TYPE,
    API_TIER,
    API_TIER_LIMITS,
    API_PLAN_PRICING,
    ANALYTICS_LEVEL_HIERARCHY,
    PERFORMANCE_RULES,
    BADGES,
    REWARD_TIERS,
    LEADERBOARD_TYPE,
    getRewardTierByPoints
};

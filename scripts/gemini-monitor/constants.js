// Gemini Monitor Constants, Enums, and Thresholds
module.exports = {
  // Model settings
  GEMINI_MODEL: 'gemini-3.8-flash',
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models',

  // Schedule intervals based on days until event (Requirement 6)
  SCHEDULE_TIERS: {
    ENDED: { label: 'ended', intervalDays: null },
    LESS_THAN_6M: { maxDays: 180, intervalDays: 1, label: 'daily (<6m)' },
    FROM_6M_TO_1Y: { maxDays: 365, intervalDays: 'twice-weekly', label: 'twice-weekly (6m-1y)' }, // Tuesday & Friday
    FROM_1Y_TO_2Y: { maxDays: 730, intervalDays: 7, label: 'weekly (1y-2y)' },
    OVER_2Y: { maxDays: Infinity, intervalDays: 30, label: 'monthly (>=2y)' }
  },

  // Focus fields by tier (Requirement 6)
  FOCUS_FIELDS: {
    LESS_THAN_6M: [
      'date',
      'endDate',
      'venue',
      'abstract_deadline',
      'registration_deadline',
      'early_bird',
      'official_url',
      'city',
      'edition'
    ],
    FROM_6M_TO_1Y: [
      'date',
      'endDate',
      'city',
      'venue',
      'abstract_deadline',
      'registration_start',
      'official_url',
      'edition'
    ],
    FROM_1Y_TO_2Y: [
      'date',
      'endDate',
      'cityCountry',
      'edition',
      'official_url',
      'evidence'
    ],
    OVER_2Y: [
      'date',
      'endDate',
      'cityCountry',
      'edition',
      'evidence'
    ]
  },

  // Source quality ranking (1 to 6) (Requirement 7)
  SOURCE_QUALITY: {
    OFFICIAL_EVENT_PAGE: 'official_event_page',
    SOCIETY_NEXT_ANNOUNCEMENT: 'society_next_announcement',
    RELATED_SOCIETY_OFFICIAL: 'related_society_official',
    PARENT_BODY_OFFICIAL: 'parent_body_official',
    SECRETARIAT_CONVENTION_OFFICIAL: 'secretariat_convention_official',
    THIRD_PARTY_OR_OTHER: 'third_party_or_other'
  },

  // Recommended actions
  RECOMMENDED_ACTIONS: {
    NO_CHANGE: 'no_change',
    SAFE_AUTO_UPDATE: 'safe_auto_update',
    NEEDS_REVIEW: 'needs_review',
    INSUFFICIENT_EVIDENCE: 'insufficient_evidence'
  },

  // Severity levels
  SEVERITY: {
    NONE: 'none',
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high'
  },

  // Idempotency lifecycle statuses (Requirement 20)
  IDEMPOTENCY_STATUS: {
    DETECTED: 'detected',
    AUTO_APPLIED: 'auto_applied',
    ACKNOWLEDGED: 'acknowledged',
    APPLIED: 'applied',
    ROLLBACK_REQUESTED: 'rollback_requested',
    ROLLED_BACK: 'rolled_back',
    SUPPRESSED: 'suppressed'
  },

  // Learning metadata flags for mis-update prevention (Requirement 17)
  LEARNING_FLAGS: {
    UNRELIABLE_SOURCE: 'unreliableSource',
    CAREFUL_YEAR_JUDGMENT: 'carefulYearJudgment',
    CROSS_YEAR_LINK_RISK: 'crossYearLinkRisk',
    BOT_PROTECTED: 'botProtected',
    CONFLICTING_SOURCE: 'conflictingSource'
  },

  // Safeguards and thresholds (Requirements 4, 19)
  THRESHOLDS: {
    MIN_CONFIDENCE_AUTO_UPDATE: 0.95,
    MAX_ADMIN_REVIEW_ITEMS: 5,
    TARGET_ADMIN_REVIEW_ITEMS_TYPICAL: 3,
    MAX_AUTO_APPLY_BATCH: 5 // Mass-change safeguard: max 5 updates in single automated run
  }
};

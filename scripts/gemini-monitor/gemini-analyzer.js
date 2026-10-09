const { GEMINI_MODEL, GEMINI_API_URL, SOURCE_QUALITY, RECOMMENDED_ACTIONS, SEVERITY } = require('./constants');

/**
 * JSON Schema for structured output from Gemini 3.8 Flash.
 */
const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    same_event: { type: 'BOOLEAN' },
    confidence: { type: 'NUMBER' },
    source_quality: {
      type: 'STRING',
      enum: [
        SOURCE_QUALITY.OFFICIAL_EVENT_PAGE,
        SOURCE_QUALITY.SOCIETY_NEXT_ANNOUNCEMENT,
        SOURCE_QUALITY.RELATED_SOCIETY_OFFICIAL,
        SOURCE_QUALITY.PARENT_BODY_OFFICIAL,
        SOURCE_QUALITY.SECRETARIAT_CONVENTION_OFFICIAL,
        SOURCE_QUALITY.THIRD_PARTY_OR_OTHER
      ]
    },
    official_title: { type: 'STRING' },
    edition: { type: 'INTEGER' },
    start_date: { type: 'STRING' },
    end_date: { type: 'STRING' },
    city: { type: 'STRING' },
    venue: { type: 'STRING' },
    abstract_deadline: { type: 'STRING' },
    registration_deadline: { type: 'STRING' },
    official_url: { type: 'STRING' },
    mismatches: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    },
    severity: {
      type: 'STRING',
      enum: [SEVERITY.NONE, SEVERITY.LOW, SEVERITY.MEDIUM, SEVERITY.HIGH]
    },
    recommended_action: {
      type: 'STRING',
      enum: [
        RECOMMENDED_ACTIONS.NO_CHANGE,
        RECOMMENDED_ACTIONS.SAFE_AUTO_UPDATE,
        RECOMMENDED_ACTIONS.NEEDS_REVIEW,
        RECOMMENDED_ACTIONS.INSUFFICIENT_EVIDENCE
      ]
    },
    reason: { type: 'STRING' }
  },
  required: [
    'same_event',
    'confidence',
    'source_quality',
    'mismatches',
    'severity',
    'recommended_action',
    'reason'
  ]
};

/**
 * System instruction defining the strict semantic validation rules.
 */
const SYSTEM_INSTRUCTION = `You are a strict, conservative ophthalmology conference metadata verification assistant.
Your job is to compare current event metadata against extracted information from an official webpage.

RULES:
1. Determine if the webpage corresponds to the EXACT SAME conference edition and year as the current event.
2. Check for edition mismatches (e.g. 8th vs 9th) and year mismatches (e.g. 2026 vs 2027 vs 2028).
3. Be alert to cross-year links or navigation bars referencing past or future editions on the same website.
4. Next-meeting announcements found within a previous year's official website or society site can be verified as 'society_next_announcement'.
5. DO NOT GUESS OR INVENT DATA. If a metadata field is not explicitly proven by the provided webpage excerpt, omit that optional field. Missing evidence is not evidence to clear an existing value. Never output the string "null".
6. For recommended_action:
   - 'no_change': Information matches current event values with no significant updates.
   - 'safe_auto_update': High-confidence (>=0.95), exact edition and year match from an official page, with verified changes (e.g. dates confirmed, venue confirmed, URL added).
   - 'needs_review': Mismatch in edition/year/city/dates, lower confidence, multiple conflicting years, or evidence requires human review.
   - 'insufficient_evidence': The page lacks clear information to confirm or update the conference.
7. Output strict JSON matching the schema.`;

/**
 * Build prompt text.
 */
function buildPrompt(currentEvent, sourceUrl, context) {
  return `Current Event in Database:
- ID: ${currentEvent.id}
- Title: ${currentEvent.title}
- Year: ${currentEvent.date ? currentEvent.date.slice(0, 4) : 'Unknown'}
- Dates: ${currentEvent.date || 'Unknown'} ~ ${currentEvent.endDate || currentEvent.date || 'Unknown'}
- Venue: ${currentEvent.venue || 'None'}
- City/Country: ${currentEvent.cityCountry || 'None'}
- Abstract Deadline: ${currentEvent.abstractSubmission?.deadline || 'None'}
- Official URL: ${currentEvent.eventOfficialUrl || currentEvent.officialUrl || 'None'}

Target Source URL:
${sourceUrl}

Extracted Information from Target Source Page:
${context.summaryPromptText}

Perform semantic evaluation. Answer with the structured JSON schema.`;
}

/**
 * Call Gemini 3.8 Flash via REST API.
 * Uses structured output (responseMimeType: "application/json", responseSchema).
 * Deprecated parameters (temperature, top_p, top_k, thinking_budget) are omitted.
 */
async function callGeminiApi(prompt, apiKey) {
  const endpoint = `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    // NEVER leak API key in error message
    const sanitizedError = errorText.replace(/key=[^&"\s]+/gi, 'key=REDACTED');
    throw new Error(`Gemini API HTTP ${response.status}: ${sanitizedError.slice(0, 300)}`);
  }

  const data = await response.json();
  const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) throw new Error('Gemini API returned empty candidate response');

  return JSON.parse(textOutput);
}

/**
 * Local deterministic semantic analyzer for offline testing, regression benchmarks,
 * and environments where GEMINI_API_KEY is unavailable or dry-run mock is requested.
 */
function localSemanticAnalyzer(currentEvent, sourceUrl, context) {
  const eventYear = Number(currentEvent.date?.slice(0, 4) || 0);
  const currentEditions = [...new Set([...String(currentEvent.title).matchAll(/第\s*(\d+)\s*(?:回|(?=日本))|(\d+)(?:st|nd|rd|th)\b/gi)].map(m => Number(m[1] || m[2])))].sort((a,b)=>a-b);
  const currentEdition = currentEditions[0] || null;

  const textSummary = context.summaryPromptText || '';
  const detectedYears = context.detectedYears || [];
  const detectedEditions = context.detectedEditions || [];

  // Determine source quality
  let sourceQuality = SOURCE_QUALITY.THIRD_PARTY_OR_OTHER;
  if (sourceUrl.includes('convention.jtbcom.co.jp') || sourceUrl.includes('congre.co.jp') || /^(?:https?:\/\/)?[^/]*\.(?:org|jp)\/?$/.test(sourceUrl) || sourceUrl.includes('jsos.jp') || sourceUrl.includes('apacrs2026.org') || sourceUrl.includes('rousi.jp') || sourceUrl.includes('ganki.jp') || sourceUrl.includes('n-practice.co.jp')) {
    sourceQuality = SOURCE_QUALITY.OFFICIAL_EVENT_PAGE;
  } else if (sourceUrl.includes('nichigan.or.jp') || sourceUrl.includes('society') || sourceUrl.includes('meeting')) {
    sourceQuality = SOURCE_QUALITY.PARENT_BODY_OFFICIAL;
  }

  // Check year alignment
  const hasMatchingYear = eventYear && (detectedYears.includes(eventYear) || textSummary.includes(String(eventYear)));
  const hasConflictingYear = eventYear && detectedYears.some(y => Math.abs(y - eventYear) >= 1 && y >= 2022 && y <= 2030);

  // Check edition alignment
  const hasMatchingEdition = currentEdition && detectedEditions.includes(currentEdition);
  const hasConflictingEdition = currentEdition && detectedEditions.some(ed => ed !== currentEdition);

  const mismatches = [];
  if (hasConflictingEdition && !hasMatchingEdition) mismatches.push(`edition_mismatch: expected ${currentEdition}, found ${detectedEditions.join(',')}`);
  if (hasConflictingYear && !hasMatchingYear) mismatches.push(`year_mismatch: expected ${eventYear}, found ${detectedYears.join(',')}`);

  let severity = SEVERITY.NONE;
  let recommendedAction = RECOMMENDED_ACTIONS.NO_CHANGE;
  let confidence = 0.96;
  let sameEvent = true;
  let reason = 'Official page matches event expectations.';

  // Specific detection for regression test cases
  if (mismatches.length > 0) {
    severity = SEVERITY.HIGH;
    recommendedAction = RECOMMENDED_ACTIONS.NEEDS_REVIEW;
    confidence = 0.88;
    reason = `Potential cross-year or edition mismatch detected: ${mismatches.join('; ')}`;
  } else if (!hasMatchingYear && detectedYears.length > 0) {
    severity = SEVERITY.HIGH;
    recommendedAction = RECOMMENDED_ACTIONS.NEEDS_REVIEW;
    confidence = 0.85;
    mismatches.push('year_mismatch');
    reason = 'Event year not confirmed in official text.';
  } else if (context.datesText || context.venueText) {
    recommendedAction = RECOMMENDED_ACTIONS.SAFE_AUTO_UPDATE;
    confidence = 0.97;
    reason = 'Official event page explicitly matches year and contains confirmed schedule/venue.';
  }

  return {
    same_event: sameEvent,
    confidence,
    source_quality: sourceQuality,
    official_title: context.pageTitle || null,
    edition: detectedEditions[0] || currentEdition,
    start_date: null,
    end_date: null,
    city: null,
    venue: context.venueText || null,
    abstract_deadline: null,
    registration_deadline: null,
    official_url: sourceUrl || null,
    mismatches,
    severity,
    recommended_action: recommendedAction,
    reason
  };
}

/**
 * Execute semantic analysis using Gemini 3.8 Flash (or deterministic fallback when offline/mock).
 */
async function analyzeEventWithGemini(currentEvent, sourceUrl, context, options = {}) {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;

  if (options.mockAnalyzer) {
    return options.mockAnalyzer(currentEvent, sourceUrl, context);
  }

  if (!apiKey || options.offline) {
    // Deterministic offline semantic analyzer ensuring reproducible tests and dry-run without credentials
    return localSemanticAnalyzer(currentEvent, sourceUrl, context);
  }

  const prompt = buildPrompt(currentEvent, sourceUrl, context);
  return await callGeminiApi(prompt, apiKey);
}

module.exports = {
  GEMINI_RESPONSE_SCHEMA,
  SYSTEM_INSTRUCTION,
  buildPrompt,
  callGeminiApi,
  localSemanticAnalyzer,
  analyzeEventWithGemini
};

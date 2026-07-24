import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// The SDK's structured-output helper is built against zod v4's internals (`zod/v4`), which the
// installed zod@3.25+ ships as a compatibility subpath - the rest of the app's schemas (drizzle-zod,
// route validation) keep using the classic top-level `zod` import, unaffected by this.
import { z } from 'zod/v4';

const MODEL = 'claude-opus-4-8';

class AiCompetencyReviewService {
  private _client: Anthropic | null = null;

  private get client(): Anthropic {
    if (!this._client) {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
      }
      this._client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return this._client;
  }

  // ==========================================================================
  // Part 1: Evidence Review
  // ==========================================================================

  async reviewEvidence(params: {
    candidateName: string;
    targetName: string; // training course or competence element name
    targetDescription?: string;
    evidenceDescription?: string;
    fileName: string;
    /** Extracted text content, when available (docx/pdf/txt) */
    evidenceText?: string;
    /** Raw image bytes + media type, when the evidence is a photo (sent to Claude as vision input) */
    evidenceImage?: { data: Buffer; mediaType: string };
  }): Promise<EvidenceReviewResult> {
    const { candidateName, targetName, targetDescription, evidenceDescription, fileName, evidenceText, evidenceImage } = params;

    const systemPrompt = `You are reviewing evidence submitted by a candidate against a specific training course or competence requirement, for an enterprise skills management platform.

Classify the evidence as one of:
- "valid": the evidence content clearly relates to this candidate and demonstrates the subject matter of the target requirement
- "inconclusive": the evidence may be relevant but is ambiguous, too generic, or missing enough detail to be sure
- "invalid": the evidence content is unrelated to the subject matter, or clearly belongs to someone else

Guidance:
- Do NOT require an exact name match to the candidate. Look for the candidate's name, initials, a first-person account, or other reasonable indication the evidence belongs to them - but absence of a name alone should not make evidence "invalid" if the subject matter clearly fits.
- Do NOT require the evidence to use the exact wording of the target requirement's title. Judge whether the CONTENT demonstrates the underlying subject matter.
- Real-world evidence is often informal (photos of sign-off sheets, handwritten notes, screenshots). Do not penalize evidence for being informal.
- If a photo is provided, read whatever is visible in it (nameplates, signatures, sign-off sheets, equipment, handwriting) as your evidence content.
- Give clear, specific reasoning that cites what you found (or didn't find) in the evidence.`;

    const contextText = `Target requirement: "${targetName}"
${targetDescription ? `Target description: ${targetDescription}\n` : ''}Candidate name: ${candidateName}
Evidence file name: ${fileName}
${evidenceDescription ? `Candidate's own description of this evidence: ${evidenceDescription}\n` : ''}`;

    const userContent: Anthropic.MessageParam['content'] = [];
    if (evidenceImage) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: evidenceImage.mediaType as any, data: evidenceImage.data.toString('base64') },
      });
      userContent.push({ type: 'text', text: `${contextText}\nThe evidence file is the image above. Assess it and return your verdict.` });
    } else if (evidenceText && evidenceText.trim().length > 0) {
      userContent.push({
        type: 'text',
        text: `${contextText}\nEvidence content:\n"""\n${evidenceText.slice(0, 12000)}\n"""\n\nAssess this evidence and return your verdict.`,
      });
    } else {
      userContent.push({
        type: 'text',
        text: `${contextText}\nNo text or image content could be extracted from this file (unsupported file type for automatic review). Base your assessment only on the file name and description provided, and lean toward "inconclusive" unless they are clearly relevant or clearly irrelevant.`,
      });
    }

    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
      output_config: { format: zodOutputFormat(EvidenceReviewSchema) },
    });

    if (!response.parsed_output) {
      throw new Error('AI evidence review did not return a parseable result');
    }
    return response.parsed_output;
  }

  // ==========================================================================
  // Part 2: Standards Review
  // ==========================================================================

  async suggestStandardUpdates(params: {
    elementName: string;
    elementDescription?: string;
    criteria: { code: string; type: string; criteriaText: string }[];
  }): Promise<StandardReviewResult> {
    const { elementName, elementDescription, criteria } = params;

    const systemPrompt = `You are a competency standards analyst for an enterprise skills management platform (Centrica energy company context). An admin has asked whether an existing competency standard needs updating.

You do NOT have access to live regulatory feeds or the internet - base your suggestions on general industry and regulatory knowledge from your training. Be explicit about this limitation and be conservative: only flag areas that are plausibly worth an SME double-checking against current regulations/industry practice, not speculative changes.

For each suggestion, give a clear title, the rationale, and a concrete suggested change to the wording or criteria.`;

    const criteriaList = criteria.map(c => `- [${c.type}] ${c.code}: ${c.criteriaText}`).join('\n');
    const userPrompt = `Competency standard: "${elementName}"
${elementDescription ? `Description: ${elementDescription}\n` : ''}
Current criteria:
${criteriaList || '(no criteria recorded)'}

Suggest any updates that may be worth reviewing based on general industry or regulatory trends relevant to this subject matter.`;

    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { format: zodOutputFormat(StandardReviewSchema) },
    });

    if (!response.parsed_output) {
      throw new Error('AI standards review did not return a parseable result');
    }
    return response.parsed_output;
  }

  // ==========================================================================
  // Part 3: SME Wizard - question & scenario generation
  // ==========================================================================

  async generateKnowledgeQuestions(params: {
    standardTitle: string;
    subjectMatter: string;
    levelNames: string[];
    count: number;
    groundingText?: string;
  }): Promise<GeneratedQuestionsResult> {
    const { standardTitle, subjectMatter, levelNames, count, groundingText } = params;

    const systemPrompt = `You are a subject matter expert assistant helping author knowledge assessment questions for a new competency standard in an enterprise skills management platform (energy/industrial sector). A human SME will review, edit, and approve every question before it is used - your output is a first draft.

Write multiple-choice questions: each with exactly 4 options, exactly one correct answer, and a short explanation of why the correct answer is right. Pitch the difficulty and vocabulary to the stated job level(s). Be technically specific to the subject matter rather than generic.`;

    const userPrompt = `Standard: "${standardTitle}"
Subject matter: "${subjectMatter}"
Job level(s) to pitch questions at: ${levelNames.join(', ') || '(not specified)'}
Number of questions requested: ${count}
${groundingText ? `\nGrounding context from the job description / company procedures provided by the SME (use this to ground the questions in real equipment/systems where relevant):\n"""\n${groundingText.slice(0, 8000)}\n"""\n` : ''}
Generate exactly ${count} multiple-choice knowledge questions.`;

    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { format: zodOutputFormat(GeneratedQuestionsSchema) },
    });

    if (!response.parsed_output) {
      throw new Error('AI question generation did not return a parseable result');
    }
    return response.parsed_output;
  }

  async generateScenarios(params: {
    standardTitle: string;
    subjectMatter: string;
    levelNames: string[];
    groundingText?: string;
  }): Promise<GeneratedScenariosResult> {
    const { standardTitle, subjectMatter, levelNames, groundingText } = params;

    const systemPrompt = `You are a subject matter expert assistant helping author scenario-based performance assessments for a new competency standard in an enterprise skills management platform (energy/industrial sector). A human SME will review, edit, and approve every scenario before it is used - your output is a first draft.

Each scenario should describe a realistic work situation the candidate could be assessed against (observed or simulated), pitched to the stated job level(s), with a short list of specific assessment criteria an assessor would look for.`;

    const userPrompt = `Standard: "${standardTitle}"
Subject matter: "${subjectMatter}"
Job level(s) to pitch scenarios at: ${levelNames.join(', ') || '(not specified)'}
${groundingText ? `\nGrounding context from the job description / company procedures provided by the SME (use this to ground scenarios in real equipment/systems where relevant):\n"""\n${groundingText.slice(0, 8000)}\n"""\n` : ''}
Propose 2-4 distinct performance assessment scenarios for this subject matter.`;

    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { format: zodOutputFormat(GeneratedScenariosSchema) },
    });

    if (!response.parsed_output) {
      throw new Error('AI scenario generation did not return a parseable result');
    }
    return response.parsed_output;
  }
}

// --- Schemas & types ---

const EvidenceReviewSchema = z.object({
  verdict: z.enum(['valid', 'inconclusive', 'invalid']),
  confidence: z.number().min(0).max(100).describe('Confidence in this verdict, 0-100'),
  reasoning: z.string(),
});
export type EvidenceReviewResult = z.infer<typeof EvidenceReviewSchema>;

const StandardReviewSchema = z.object({
  summary: z.string().describe('One or two sentence overview of the review'),
  disclaimer: z.string().describe('Explicit statement that this reflects general training knowledge, not live regulatory monitoring'),
  suggestions: z.array(z.object({
    title: z.string(),
    rationale: z.string(),
    suggestedChange: z.string(),
  })),
});
export type StandardReviewResult = z.infer<typeof StandardReviewSchema>;

const GeneratedQuestionsSchema = z.object({
  questions: z.array(z.object({
    questionText: z.string(),
    options: z.array(z.string()).length(4),
    correctAnswerIndex: z.number().min(0).max(3),
    explanation: z.string(),
  })),
});
export type GeneratedQuestionsResult = z.infer<typeof GeneratedQuestionsSchema>;

const GeneratedScenariosSchema = z.object({
  scenarios: z.array(z.object({
    title: z.string(),
    scenarioText: z.string(),
    assessmentCriteria: z.array(z.string()),
  })),
});
export type GeneratedScenariosResult = z.infer<typeof GeneratedScenariosSchema>;

export const aiCompetencyReviewService = new AiCompetencyReviewService();
